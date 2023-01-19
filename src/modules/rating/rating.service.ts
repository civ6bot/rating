import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, CommandInteraction, EmbedBuilder, Guild, GuildMember, Message, ModalSubmitInteraction, TextChannel } from "discord.js";
import { discordClient } from "../../client/client";
import { EntityPendingRatingNote } from "../../database/entities/entity.PendingRatingNote";
import { EntityRatingNote } from "../../database/entities/entity.RatingNote";
import { EntityUserRating } from "../../database/entities/entity.UserRating";
import { DatabaseServicePendingRatingNote } from "../../database/services/service.PendingRatingNote";
import { DatabaseServiceRatingNote } from "../../database/services/service.RatingNote";
import { DatabaseServiceUserRating } from "../../database/services/service.UserRating";
import { UtilsGeneratorTimestamp } from "../../utils/generators/utils.generator.timestamp";
import { UtilsServiceCivilizations } from "../../utils/services/utils.service.civilizations";
import { UtilsServiceEmojis } from "../../utils/services/utils.service.emojis";
import { UtilsServicePM } from "../../utils/services/utils.service.PM";
import { UtilsServiceTime } from "../../utils/services/utils.service.time";
import { UtilsServiceUsers } from "../../utils/services/utils.service.users";
import { ModuleBaseService } from "../base/base.service";
import { RatingChatMessageData } from "./rating.models";
import { RatingUI } from "./rating.ui";

export class RatingService extends ModuleBaseService {
    public static processingSlashMessages: (Message|undefined)[] = [];
    public static processingChatMessages: Map<string, RatingChatMessageData> = new Map<string, RatingChatMessageData>();

    public ratingProcessingTimeoutMs: number = UtilsServiceTime.getMs(300, "s");

    private ratingUI: RatingUI = new RatingUI();

    private databaseServiceUserRating: DatabaseServiceUserRating = new DatabaseServiceUserRating();
    private databaseServiceRatingNote: DatabaseServiceRatingNote = new DatabaseServiceRatingNote();
    private databaseServicePendingRatingNote: DatabaseServicePendingRatingNote = new DatabaseServicePendingRatingNote();

    public static async deleteNextProcessingSlashMessage(): Promise<void> {
        let oldMessage: Message|undefined = RatingService.processingSlashMessages.shift();
        if(!oldMessage)
            return;
        let message: Message|undefined = oldMessage.channel.messages.cache.get(oldMessage.id);
        if(message)
            try {
                if(message.components.length > 0)
                    message.delete();
            } catch {}
    }

    public static async deleteNextProcessingChatMessage(): Promise<void> {
        let databaseServicePendingRatingNote: DatabaseServicePendingRatingNote = new DatabaseServicePendingRatingNote();
        for(let data of RatingService.processingChatMessages.values()) {
            if(data.timeOfDelete > Date.now())
                continue;
            clearTimeout(data.timeout);
            try {
                let message: Message = await data.botMessage.fetch();
                if(message.components.length > 0)
                    message.delete();
            } catch {}
            databaseServicePendingRatingNote.deleteAllByGameID(data.pendingGameID);
            RatingService.processingChatMessages.delete(data.userMessage.id);
        }
    }

    private isOwner(interaction: ButtonInteraction): boolean {
        return interaction.customId.split("-").pop() === interaction.user.id;
    }

    private async isModerator(interaction: CommandInteraction | ButtonInteraction | ModalSubmitInteraction): Promise<boolean> {
        let member: GuildMember = interaction.member as GuildMember;
        if(UtilsServiceUsers.isAdmin(member))
            return true;
        let moderationRolesID: string[] = (await this.getOneSettingString(
            interaction, "MODERATION_ROLE_MODERATORS_ID"
        )).split(" ");
        return member.roles.cache.some((value, key) => (moderationRolesID.indexOf(key) !== -1));
    }

    private getEloRatingChange(
        ratingA: number, ratingB: number,
        eloK: number, eloD: number, isTie: boolean = false
    ): number { 
        return Math.round(eloK * ((isTie ? 0.5 : 1) - 1/(1+Math.pow(10, (ratingB-ratingA)/eloD)))); 
    }

    private async setRatingRole(
        guildID: string, 
        usersID: string|string[], 
        generalRatingValues: number|number[]
    ): Promise<void> {     // Нужно ХОТЯ БЫ, чтобы получить роль
        let guild: Guild|undefined = discordClient.guilds.cache.get(guildID);
        if(!guild)
            return;
        if(!Array.isArray(usersID))
            usersID = [usersID];
        if(!Array.isArray(generalRatingValues))
            generalRatingValues = [generalRatingValues];
        let members: (GuildMember|undefined)[] = usersID.map(userID => guild?.members.cache.get(userID));
        let ratingRolesID: string[] = (await this.getOneSettingString(guildID, "RATING_ROLES_ID")).split(" ");
        let ratingPoints: number[] = (await this.getOneSettingString(guildID, "RATING_POINTS_TO_ROLE")).split(" ").map(str => Number(str));
        members.forEach(async (member: GuildMember|undefined, index: number) => {
            if(!member)
                return;
            let addRatingRoleID: string|undefined = ratingRolesID?.[ratingPoints.indexOf(Math.max(...ratingPoints.filter(ratingPoint => ratingPoint <= (generalRatingValues as Array<number>)[index])))];
            if(addRatingRoleID)
                try {
                    await member.roles.add(addRatingRoleID);
                } catch {}
            try {
                await member.roles.remove(ratingRolesID.filter(ratingRoleID => ratingRoleID !== addRatingRoleID));
            } catch {}
        });
    }

    public async generatePendingRatingNotes(
        interaction: CommandInteraction | ButtonInteraction | string, 
        msg: string, gameType: string|null = null
    ): Promise<EntityPendingRatingNote[]> {
        let guildID: string = (typeof interaction === "string") ? interaction : interaction.guild?.id as string;
        let pendingGameID: number = await this.databaseServicePendingRatingNote.getNextGameID(guildID);
        let pendingRatingNotes: EntityPendingRatingNote[] = [];

        // ======================== ПАРСИНГ КЛЮЧЕВЫХ СЛОВ 
        // ======================== В процессе создаются объекты EntityPendingRatingNotes и заполняются
        // ======================== уникальными для каждого игрока полученными данными (кроме рейтинга)

        let victoryType: string|null = null;
        let isBaseLanguage: boolean = (await this.getOneSettingString(guildID, "BASE_LANGUAGE")) === (await this.getOneSettingString("DEFAULT", "BASE_LANGUAGE"));
        let textKeywords: string[] = [
            "RATING_REPORT_SYNONYMS_HOST", "RATING_REPORT_SYNONYMS_SUB",    // 0, 1
            "RATING_REPORT_SYNONYMS_TIE", "RATING_REPORT_SYNONYMS_LEAVE",
            "RATING_REPORT_SYNONYMS_GAME_TYPE_FFA", "RATING_REPORT_SYNONYMS_GAME_TYPE_TEAMERS",
            "RATING_REPORT_SYNONYMS_VICTORY_SCIENCE", "RATING_REPORT_SYNONYMS_VICTORY_CULTURE",
            "RATING_REPORT_SYNONYMS_VICTORY_DOMINATION", "RATING_REPORT_SYNONYMS_VICTORY_RELIGIOUS",
            "RATING_REPORT_SYNONYMS_VICTORY_DIPLOMATIC", "RATING_REPORT_SYNONYMS_VICTORY_CC",
            "RATING_REPORT_SYNONYMS_VICTORY_GG"                             // 12
        ];

        let words: string[] = msg
            .concat("\n")
            .slice(0, msg.indexOf("\n\n\n"))            // Все данные за 3 переносами строки игнорируются
            .replaceAll(/[.,;\-\n]/g, " ")
            .toLowerCase()
            .split(" ")
            .filter(str => str.length > 0);
        let synonyms: string[][] = (await this.getManyText(guildID, textKeywords)).map(synonym => synonym.split(", "));
        let civLines: string[] = await this.getManyText(guildID, UtilsServiceCivilizations.civilizationsTags);
        let baseLanguageCivLines: string[] = [];
        if(!isBaseLanguage) {
            let englishSynonyms: string[][] = (await this.getManyText("DEFAULT", textKeywords)).map(synonym => synonym.split(", "));
            synonyms = synonyms.map((synonym: string[], index: number): string[] => synonym.concat(englishSynonyms[index]));
            baseLanguageCivLines = await this.getManyText(guildID, UtilsServiceCivilizations.civilizationsTags);
        }

        let regexUserID: RegExp = new RegExp(/<@\d+>/);
        let tempIsSubOutFlag: boolean = false, 
            tempIsHostFlag: boolean = false, 
            tempIsTieFlag: boolean = false,
            tempHostUserID: string = "";
        words.forEach((word: string, index: number) => {
            let parseResult: boolean[] = synonyms.map(synonym => UtilsServiceCivilizations.searchTexts(word, synonym).length > 0);
            let synonymIndex: number = parseResult.indexOf(true);
            if(synonymIndex !== -1) 
                switch(synonymIndex) {
                    case 0:
                        if(pendingRatingNotes.length > 0)
                            pendingRatingNotes[pendingRatingNotes.length-1].isHost = true;
                        else
                            tempIsHostFlag = true;
                        return;
                    case 1:
                        if(pendingRatingNotes.length > 0) {
                            pendingRatingNotes[pendingRatingNotes.length-1].isSubIn = true;
                            tempIsSubOutFlag = true;
                        }
                        return;
                    case 2:
                        tempIsTieFlag = true; return;
                    case 3:
                        if(pendingRatingNotes.length > 0)
                            pendingRatingNotes[pendingRatingNotes.length-1].isLeave = true;
                        return;
                    case 4:
                        gameType = "FFA"; return;
                    case 5:
                        gameType = "Teamers"; return;
                    case 6:
                        victoryType = "Science"; return;
                    case 7:
                        victoryType = "Culture"; return;
                    case 8:
                        victoryType = "Domination"; return;
                    case 9:
                        victoryType = "Religious"; return;
                    case 10:
                        victoryType = "Diplomatic"; return;
                    case 11:
                        victoryType = "CC"; return;
                    case 12:
                        victoryType = "GG"; return;
                    default:
                        return;
                }

            if(regexUserID.test(word)) {                // Если это упоминание игрока
                let userID: string = word.slice(2, -1);
                if(tempIsHostFlag) {
                    tempIsHostFlag = false;
                    tempHostUserID = userID;
                    return;
                }
                let newPendingRatingNote: EntityPendingRatingNote = new EntityPendingRatingNote();
                newPendingRatingNote.userID = userID;
                newPendingRatingNote.isLeave = false;
                newPendingRatingNote.place = pendingRatingNotes.filter(pendingRatingNote => !pendingRatingNote.isSubOut).length+1;
                if(tempIsSubOutFlag) {
                    tempIsSubOutFlag = false;
                    newPendingRatingNote.isSubOut = true;
                    newPendingRatingNote.place = (pendingRatingNotes[pendingRatingNotes.length-1]?.place || 1);
                    if((pendingRatingNotes.length > 0) && Number.isInteger(pendingRatingNotes[pendingRatingNotes.length-1].civilizationID))
                        newPendingRatingNote.civilizationID = pendingRatingNotes[pendingRatingNotes.length-1].civilizationID;
                } else {
                    newPendingRatingNote.isSubOut = false;
                }
                if(tempIsTieFlag) {
                    tempIsTieFlag = false;
                    newPendingRatingNote.place = (pendingRatingNotes[pendingRatingNotes.length-1]?.place || 1);
                }
                if(userID === tempHostUserID) {
                    tempHostUserID = "";
                    newPendingRatingNote.isHost = true;
                }
                pendingRatingNotes.push(newPendingRatingNote);
                return;
            }

            let bans: number[] = UtilsServiceCivilizations.parseBans(words.slice(index, index+2).join(" "), civLines).bans      // Если это упоминание цивилизации
                .concat(UtilsServiceCivilizations.parseBans(words.slice(index, index+2).join(" "), baseLanguageCivLines).bans);
            if((bans.length > 0) && (pendingRatingNotes.length > 0)) {
                pendingRatingNotes[pendingRatingNotes.length-1].civilizationID = bans[0];
                if(pendingRatingNotes[pendingRatingNotes.length-1].isSubOut && pendingRatingNotes[pendingRatingNotes.length-2].isSubIn)     // Заменяющий тоже получает цивилизацию
                    pendingRatingNotes[pendingRatingNotes.length-2].civilizationID = bans[0];
            }
        });
        if((gameType === "FFA") && (victoryType === "GG"))
            victoryType = "CC";
        else if((gameType === "Teamers") && (victoryType === "CC"))
            victoryType = "GG";
    
        // ======================== ПЕРЕСЧЁТ МЕСТ ИГРОКОВ
        // ======================== Важно для режима Teamers (возможна будущая реализация для режима 2x2x2x2)
        // ======================== Если тип игры не указан, то данная операция не имеет смысла

        pendingRatingNotes.sort((a, b): number => Number(a.isSubOut)-Number(b.isSubOut) || a.place-b.place || -1);  // для всех заменённых игроков: место = 0
        pendingRatingNotes.forEach(pendingRatingNote => {
            if(pendingRatingNote.isSubOut)
                pendingRatingNote.place = 0;
        });
        let playersTotal: number = pendingRatingNotes.filter(pendingRatingNote => !pendingRatingNote.isSubOut).length;
        let teamsTotal: number, playersPerTeam: number;
        if(gameType === "Teamers") {
            teamsTotal = 2;
            playersPerTeam = playersTotal/teamsTotal;
        } else {
            teamsTotal = playersTotal;
            playersPerTeam = 1;
        }
        if(playersPerTeam % 1 === 0)                                                    // если дробное => не делятся команды => пропускаем
            for(let i: number = 0; i < teamsTotal; i++) {
                let currentPlace: number = i+1;
                if(pendingRatingNotes[i*playersPerTeam].place < i*playersPerTeam+1)     // Если первый игрок в команде имеет место меньше, чем положенное
                    currentPlace = pendingRatingNotes[i*playersPerTeam-1].place;        // (например, для 2x2x2x2: 1, 2, 2 (не 3?), 4, 5, 6, 7, 8)
                for(let j: number = 0; j < playersPerTeam; j++)                         // тогда для всех игроков в данной команде нужно поставить места как в предыдущей команде,
                    pendingRatingNotes[i*playersPerTeam+j].place = currentPlace;        // иначе поставить номер команды
            }
        
        // ======================== ЗАПОЛНЕНИЕ ОБЩИМИ ДАННЫМИ
        // ======================== Для первого места (не заменённого игрока) дополнительно тип победы
        // ======================== Умножение рейтинга для других типов побед

        pendingRatingNotes.forEach(pendingRatingNote => {
            if((pendingRatingNote.place === 1) && (!pendingRatingNote.isSubOut))
                pendingRatingNote.victoryType = victoryType;
            pendingRatingNote.guildID = guildID;
            pendingRatingNote.gameID = pendingGameID;
            pendingRatingNote.gameType = gameType;
            pendingRatingNote.date = new Date();
            pendingRatingNote.placeTotal = teamsTotal;
            pendingRatingNote.rating = 0;
            pendingRatingNote.typedRating = 0;
        });

        // ======================== ВОЗВРАТ РЕЗУЛЬТАТА

        return pendingRatingNotes;
    }

    public calculateRatingNotes(
        pendingRatingNotes: (EntityRatingNote|EntityPendingRatingNote)[],
        usersRating: EntityUserRating[],
        eloK: number, eloD: number, victoryMultiplier: number
    ): void {
        victoryMultiplier = 1.5;
        // База данных не может хранить дробные числа,
        // но при этом пользователь не может измениять коэффициент,
        // поэтому временно переназначается здесь.

        let gameType: string|null = pendingRatingNotes[0]?.gameType || null;
        let playersTotal: number = pendingRatingNotes.filter(pendingRatingNote => !pendingRatingNote.isSubOut).length;
        let victoryType: string|null = pendingRatingNotes[0]?.victoryType || null;

        pendingRatingNotes.forEach(pendingRatingNote => {
            pendingRatingNote.rating = 0;
            pendingRatingNote.typedRating = 0;
        });
        let teamsTotal: number, playersPerTeam: number;
        if(gameType === "Teamers") {
            teamsTotal = 2;
            playersPerTeam = playersTotal/teamsTotal;
        } else {
            teamsTotal = playersTotal;
            playersPerTeam = 1;
        }
        if((gameType === null) || (playersPerTeam % 1))     // Если дробное, т.е. не делится
            return; 
        if(gameType === "FFA")
            victoryType = "CC";
        else if(gameType === "Teamers")
            victoryType = "GG";
        
        for(let i: number = 0; i < teamsTotal-1; i++)           // Основные игроки
            for(let j: number = 0; j < playersPerTeam; j++) 
                for(let k: number = (i+1)*playersPerTeam; k < playersTotal; k++) {
                    let winnerIndex: number = i*playersPerTeam+j;
                    let eloIsTie: boolean = (pendingRatingNotes[winnerIndex].place === pendingRatingNotes[k].place);
                    
                    let eloDelta: number = this.getEloRatingChange(
                        usersRating[winnerIndex].rating, usersRating[k].rating,
                        eloK, eloD, eloIsTie
                    );
                    pendingRatingNotes[winnerIndex].rating += eloDelta;
                    pendingRatingNotes[k].rating -= eloDelta;

                    let eloDeltaTyped: number = this.getEloRatingChange(
                        (gameType === "FFA") ? usersRating[winnerIndex].ffaRating : usersRating[winnerIndex].teamersRating,
                        (gameType === "FFA") ? usersRating[k].ffaRating : usersRating[k].teamersRating,
                        eloK, eloD, eloIsTie
                    );
                    pendingRatingNotes[winnerIndex].typedRating += eloDeltaTyped;
                    pendingRatingNotes[k].typedRating -= eloDeltaTyped;
                }
        let subOutIndex: number = 0;
        pendingRatingNotes.forEach((pendingRatingNote: EntityPendingRatingNote, index: number) => {
            if(!pendingRatingNote.isSubIn)
                return;
            while((subOutIndex < pendingRatingNotes.length) && !pendingRatingNotes[subOutIndex].isSubOut)
                subOutIndex++;
            if((subOutIndex >= pendingRatingNotes.length) || !pendingRatingNote.isSubIn || !pendingRatingNotes[subOutIndex].isSubOut)
                return;
            let eloDelta: number = this.getEloRatingChange(
                usersRating[index].rating, usersRating[subOutIndex].rating,
                eloK, eloD
            );
            pendingRatingNote.rating += eloDelta;
            pendingRatingNotes[subOutIndex].rating -= eloDelta;    
            if(pendingRatingNotes[subOutIndex].isLeave && pendingRatingNote.rating < 0){
                pendingRatingNotes[subOutIndex].rating += pendingRatingNote.rating;
                pendingRatingNote.rating = 0;
            }

            let eloDeltaTyped: number = this.getEloRatingChange(
                (gameType === "FFA") ? usersRating[index].ffaRating : usersRating[index].teamersRating,
                (gameType === "FFA") ? usersRating[subOutIndex].ffaRating : usersRating[subOutIndex].teamersRating,
                eloK, eloD
            );
            pendingRatingNote.typedRating += eloDeltaTyped;
            pendingRatingNotes[subOutIndex].typedRating -= eloDeltaTyped; 
            if(pendingRatingNotes[subOutIndex].isLeave && pendingRatingNote.typedRating < 0){
                pendingRatingNotes[subOutIndex].typedRating += pendingRatingNote.typedRating;
                pendingRatingNote.typedRating = 0;
            }
            subOutIndex++;
        });
        if(!!victoryType && (victoryType !== "CC") && (victoryType !== "GG"))
            pendingRatingNotes.forEach(pendingRatingNote => {
                pendingRatingNote.rating = Math.round(pendingRatingNote.rating*victoryMultiplier);
                pendingRatingNote.typedRating = Math.round(pendingRatingNote.typedRating*victoryMultiplier);
            });
    }

    public async checkPendingRatingNotes(
        pendingRatingNotes: EntityPendingRatingNote[],
        interaction: CommandInteraction | ButtonInteraction | string,
    ) {
        let errorTags: string[] = [],  warningTags: string[] = [];
        let guildID: string = (typeof interaction === "string") ? interaction : interaction.guild?.id as string;
        let [isReportHost, isReportCivs]: boolean[] = (await this.getManySettingNumber(
            guildID, 
            "RATING_REPORTS_HOST", "RATING_REPORTS_CIVS"
        )).map(value => Boolean(value));
        let playersTotal: number = pendingRatingNotes.filter(pendingRatingNote => !pendingRatingNote.isSubOut).length;
        let teamsTotal: number = pendingRatingNotes[0]?.placeTotal || 0;

        if(pendingRatingNotes[0]?.gameType === null)
            errorTags.push("RATING_REPORT_ERROR_GAME_TYPE");
        if(!pendingRatingNotes.map(pendingRatingNote => pendingRatingNote.userID).every((userID: string, index: number, array: string[]) => array.indexOf(userID) === index))
            errorTags.push("RATING_REPORT_ERROR_SAME_USERS");
        if(playersTotal > 16)
            errorTags.push("RATING_REPORT_ERROR_TOO_MUCH_USERS");
        
        if(pendingRatingNotes[0]?.gameType === "FFA") {
            if(playersTotal < 2)
                errorTags.push("RATING_REPORT_ERROR_NOT_ENOUGH_USERS");
        } else if(pendingRatingNotes[0]?.gameType) {
            if(playersTotal < 4)
                errorTags.push("RATING_REPORT_ERROR_NOT_ENOUGH_USERS");
            else if((teamsTotal > 0) && (playersTotal % teamsTotal))
                errorTags.push("RATING_REPORT_ERROR_TEAMERS_DIVIDE");
        }
        
        if(pendingRatingNotes.every(pendingRatingNote => !pendingRatingNote.isHost)) {
            (isReportHost) 
                ? errorTags.push("RATING_REPORT_ERROR_HOST")
                : warningTags.push("RATING_REPORT_WARNING_HOST");
        }
        if(pendingRatingNotes.some(pendingRatingNote => !pendingRatingNote.civilizationID)) {    // Может быть undefined
            (isReportCivs) 
                ? errorTags.push("RATING_REPORT_ERROR_CIVILIZATIONS")
                : warningTags.push("RATING_REPORT_WARNING_CIVILIZATIONS");
        }

        return {errors: errorTags, warnings: warningTags};        
    }

    public convertToRatingNotes(
        pendingRatingNotes: EntityPendingRatingNote[],
        gameID: number
    ): EntityRatingNote[] {
        return pendingRatingNotes.map((pendingRatingNote: EntityPendingRatingNote): EntityRatingNote => {
            let ratingNote: EntityRatingNote = new EntityRatingNote();
            ratingNote.guildID = pendingRatingNote.guildID;
            ratingNote.gameID = gameID;
            ratingNote.userID = pendingRatingNote.userID;

            ratingNote.date = pendingRatingNote.date;
            ratingNote.isActive = true;

            ratingNote.gameType = pendingRatingNote.gameType as string;
            ratingNote.civilizationID = pendingRatingNote.civilizationID;
            ratingNote.place = pendingRatingNote.place;
            ratingNote.placeTotal = pendingRatingNote.placeTotal;
            ratingNote.victoryType = pendingRatingNote.victoryType;
            ratingNote.rating = pendingRatingNote.rating;
            ratingNote.typedRating = pendingRatingNote.typedRating;

            ratingNote.isHost = pendingRatingNote.isHost;
            ratingNote.isSubIn = pendingRatingNote.isSubIn;
            ratingNote.isSubOut = pendingRatingNote.isSubOut;
            ratingNote.isLeave = pendingRatingNote.isLeave;
            return ratingNote;
        });
    }

    public applyRating(
        usersRating: EntityUserRating[],
        ratingNotes: EntityRatingNote[],
        isCancel: boolean = false
    ): void {
        let type: string = ratingNotes[0].gameType;
        let cancelMultiplier: number = (isCancel) ? -1 : 1;
        for(let i in usersRating) {
            ratingNotes[i].isActive = !isCancel;
            usersRating[i].rating += ratingNotes[i].rating*cancelMultiplier;
            usersRating[i].host = Math.max(usersRating[i].host+Number(ratingNotes[i].isHost)*cancelMultiplier, 0);
            usersRating[i].subIn = Math.max(usersRating[i].subIn+Number(ratingNotes[i].isSubIn)*cancelMultiplier, 0);
            usersRating[i].subOut = Math.max(usersRating[i].subOut+Number(ratingNotes[i].isSubOut)*cancelMultiplier, 0);
            usersRating[i].leave = Math.max(usersRating[i].leave+Number(ratingNotes[i].isLeave)*cancelMultiplier, 0);
            if(!isCancel)
                usersRating[i].lastGame = ratingNotes[i].date;
            if(type === "FFA") {
                usersRating[i].ffaRating += ratingNotes[i].typedRating*cancelMultiplier;
                usersRating[i].ffaTotal = Math.max(usersRating[i].ffaTotal+cancelMultiplier, 0);
                if(!ratingNotes[i].isSubOut) {
                    usersRating[i].ffaWin = Math.max(usersRating[i].ffaWin+(ratingNotes[i].typedRating >= 0 ? 1 : 0)*cancelMultiplier, 0);
                    usersRating[i].ffaLose = Math.max(usersRating[i].ffaLose+(ratingNotes[i].typedRating < 0 ? 1 : 0)*cancelMultiplier, 0);
                    usersRating[i].ffaFirst = Math.max(usersRating[i].ffaFirst+(ratingNotes[i].place === 1 ? 1 : 0)*cancelMultiplier, 0);
                    if(ratingNotes[i].victoryType !== null)
                    switch(ratingNotes[i].victoryType) {
                        case "Science":
                            usersRating[i].ffaVictoryScience = Math.max(usersRating[i].ffaVictoryScience+cancelMultiplier, 0); break;
                        case "Culture":
                            usersRating[i].ffaVictoryCulture = Math.max(usersRating[i].ffaVictoryCulture+cancelMultiplier, 0); break;
                        case "Domination":
                            usersRating[i].ffaVictoryDomination = Math.max(usersRating[i].ffaVictoryDomination+cancelMultiplier, 0); break;
                        case "Religious":
                            usersRating[i].ffaVictoryReligious = Math.max(usersRating[i].ffaVictoryReligious+cancelMultiplier, 0); break;
                        case "Diplomatic":
                            usersRating[i].ffaVictoryDiplomatic = Math.max(usersRating[i].ffaVictoryDiplomatic+cancelMultiplier, 0); break;
                        case "CC":
                            usersRating[i].ffaVictoryCC = Math.max(usersRating[i].ffaVictoryCC+cancelMultiplier, 0); break;
                    }
                }
            } else {
                usersRating[i].teamersRating += ratingNotes[i].typedRating*cancelMultiplier;
                usersRating[i].teamersTotal = Math.max(usersRating[i].teamersTotal+cancelMultiplier, 0);
                if(!ratingNotes[i].isSubOut){
                    usersRating[i].teamersWin = Math.max(usersRating[i].teamersWin+(ratingNotes[i].typedRating >= 0 ? 1 : 0)*cancelMultiplier, 0);
                    usersRating[i].teamersLose = Math.max(usersRating[i].teamersLose+(ratingNotes[i].typedRating < 0 ? 1 : 0)*cancelMultiplier, 0);
                    if(ratingNotes[i].victoryType !== null)
                    switch(ratingNotes[i].victoryType) {
                        case "Science":
                            usersRating[i].teamersVictoryScience = Math.max(usersRating[i].teamersVictoryScience+cancelMultiplier, 0); break;
                        case "Culture":
                            usersRating[i].teamersVictoryCulture = Math.max(usersRating[i].teamersVictoryCulture+cancelMultiplier, 0); break;
                        case "Domination":
                            usersRating[i].teamersVictoryDomination = Math.max(usersRating[i].teamersVictoryDomination+cancelMultiplier, 0); break;
                        case "Religious":
                            usersRating[i].teamersVictoryReligious = Math.max(usersRating[i].teamersVictoryReligious+cancelMultiplier, 0); break;
                        case "Diplomatic":
                            usersRating[i].teamersVictoryDiplomatic = Math.max(usersRating[i].teamersVictoryDiplomatic+cancelMultiplier, 0); break;
                        case "GG":
                            usersRating[i].teamersVictoryGG = Math.max(usersRating[i].teamersVictoryGG+cancelMultiplier, 0); break;
                    }
                }
            }
        }
    }

    public applyPendingRating(
        usersRating: EntityUserRating[],
        ratingNotes: EntityPendingRatingNote[]
    ): void {
        if(ratingNotes.length === 0)
            return;
        let type: string = ratingNotes[0].gameType || "";
        for(let i in usersRating) {
            usersRating[i].rating += ratingNotes[i].rating;
            if(type === "FFA") 
                usersRating[i].ffaRating += ratingNotes[i].typedRating;
            else if(type === "Teamers")
                usersRating[i].teamersRating += ratingNotes[i].typedRating;
        }
    }
    
    public async onMessageCreate(message: Message) {
        let guildID: string|null = message.guildId;
        if(guildID === null)
            return;
        let userChannelID = await this.getOneSettingString(message.guild?.id as string, "RATING_USER_REPORTS_CHANNEL_ID");
        if(userChannelID !== message.channel.id)
            return;
        let pendingRatingNotes: EntityPendingRatingNote[] = await this.generatePendingRatingNotes(guildID, message.content);
        if(pendingRatingNotes.length === 0)
            return;

        let usersRating: EntityUserRating[] = await this.databaseServiceUserRating.getMany(guildID, pendingRatingNotes.map(note => note.userID));
        let [eloK, eloD, victoryMultiplier] = await this.getManySettingNumber(guildID, "RATING_ELO_K", "RATING_ELO_D", "RATING_VICTORY_MULTIPLIER");
        this.calculateRatingNotes(pendingRatingNotes, usersRating, eloK, eloD, victoryMultiplier);
        let {errors, warnings} = await this.checkPendingRatingNotes(pendingRatingNotes, guildID);
        this.applyPendingRating(usersRating, pendingRatingNotes);
        let descriptionHeaders: string[] = await this.getManyText(guildID, [
            "RATING_DESCRIPTION_ID_HEADER", "RATING_DESCRIPTION_GAME_TYPE_HEADER",
            "RATING_DESCRIPTION_HOST_HEADER", "RATING_DESCRIPTION_VICTORY_TYPE_HEADER"
        ]);
        let victoryLines: string[] = await this.getManyText(guildID, [
            "RATING_DESCRIPTION_VICTORY_SCIENCE", "RATING_DESCRIPTION_VICTORY_CULTURE",
            "RATING_DESCRIPTION_VICTORY_DOMINATION", "RATING_DESCRIPTION_VICTORY_RELIGIOUS",
            "RATING_DESCRIPTION_VICTORY_DIPLOMATIC", "RATING_DESCRIPTION_VICTORY_CC",
            "RATING_DESCRIPTION_VICTORY_GG"
        ]);
        let civLines: string[] = (await this.getManyText(guildID, UtilsServiceCivilizations.civilizationsTags))
            .map(str => str.slice(str.indexOf("<")));
        let warningsDescription: string = await this.getOneText(guildID, "RATING_REPORT_WARNINGS_TITLE");
        let warningDescriptionLines: string[] = await this.getManyText(guildID, warnings);
        let title: string = await this.getOneText(guildID, "RATING_REPORT_TITLE");
        let labels: string[] = await this.getManyText(guildID, [
            "RATING_CONFIRM_BUTTON", "RATING_CANCEL_BUTTON" 
        ]);

        if(errors.length === 0)
            this.databaseServicePendingRatingNote.insertAll(pendingRatingNotes);

        let embeds: EmbedBuilder[], buttons: ActionRowBuilder<ButtonBuilder>[];
        if(errors.length > 0) {
            let errorsDescription: string = await this.getOneText(guildID, "RATING_REPORT_ERRORS_PROCESSING_TITLE", UtilsGeneratorTimestamp.getRelativeTime(this.ratingProcessingTimeoutMs));
            let errorDescriptionLines: string[] = await this.getManyText(guildID, errors);
            embeds = this.ratingUI.reportProcessingErrorEmbed(
                message.author, false,
                usersRating, pendingRatingNotes, 
                title, descriptionHeaders, victoryLines, civLines, "",
                errorsDescription, errorDescriptionLines, warningsDescription, warningDescriptionLines
            );
            buttons = this.ratingUI.reportProcessingButtons(message.author.id, pendingRatingNotes[0].gameID, labels, true)
        } else {
            let readyDescription: string = await this.getOneText(guildID, "RATING_REPORT_OK_PROCESSING_TITLE", UtilsGeneratorTimestamp.getRelativeTime(this.ratingProcessingTimeoutMs));
            embeds = this.ratingUI.reportProcessingOKEmbed(
                message.author, false,
                usersRating, pendingRatingNotes,
                title, descriptionHeaders, victoryLines, civLines, "",
                readyDescription, warningsDescription, warningDescriptionLines
            );
            buttons = this.ratingUI.reportProcessingButtons(message.author.id, pendingRatingNotes[0].gameID, labels);
        }
        
        RatingService.processingChatMessages.set(message.id, {
            userMessage: message,
            botMessage: await message.reply({embeds: embeds, components: buttons}),
            timeOfDelete: Date.now()+this.ratingProcessingTimeoutMs,
            timeout: setTimeout(RatingService.deleteNextProcessingChatMessage, this.ratingProcessingTimeoutMs),
            pendingGameID: pendingRatingNotes[0].gameID
        });
    }

    public async onMessageUpdate(message: Message) {
        let guildID: string|null = message.guildId;
        if(guildID === null)
            return;
        let userChannelID = await this.getOneSettingString(message.guild?.id as string, "RATING_USER_REPORTS_CHANNEL_ID");
        if(userChannelID !== message.channel.id)
            return;
        let data: RatingChatMessageData|undefined = RatingService.processingChatMessages.get(message.id);
        if(!data)
            return;
        let pendingRatingNotes: EntityPendingRatingNote[] = await this.generatePendingRatingNotes(guildID, message.content);
        if(pendingRatingNotes.length === 0)
            return;

        clearTimeout(data.timeout);
        this.databaseServicePendingRatingNote.deleteAllByGameID(data.pendingGameID);

        let usersRating: EntityUserRating[] = await this.databaseServiceUserRating.getMany(guildID, pendingRatingNotes.map(note => note.userID));
        let [eloK, eloD, victoryMultiplier] = await this.getManySettingNumber(guildID, "RATING_ELO_K", "RATING_ELO_D", "RATING_VICTORY_MULTIPLIER");
        this.calculateRatingNotes(pendingRatingNotes, usersRating, eloK, eloD, victoryMultiplier);
        let {errors, warnings} = await this.checkPendingRatingNotes(pendingRatingNotes, guildID);
        this.applyPendingRating(usersRating, pendingRatingNotes);
        let descriptionHeaders: string[] = await this.getManyText(guildID, [
            "RATING_DESCRIPTION_ID_HEADER", "RATING_DESCRIPTION_GAME_TYPE_HEADER",
            "RATING_DESCRIPTION_HOST_HEADER", "RATING_DESCRIPTION_VICTORY_TYPE_HEADER"
        ]);
        let victoryLines: string[] = await this.getManyText(guildID, [
            "RATING_DESCRIPTION_VICTORY_SCIENCE", "RATING_DESCRIPTION_VICTORY_CULTURE",
            "RATING_DESCRIPTION_VICTORY_DOMINATION", "RATING_DESCRIPTION_VICTORY_RELIGIOUS",
            "RATING_DESCRIPTION_VICTORY_DIPLOMATIC", "RATING_DESCRIPTION_VICTORY_CC",
            "RATING_DESCRIPTION_VICTORY_GG"
        ]);
        let civLines: string[] = (await this.getManyText(guildID, UtilsServiceCivilizations.civilizationsTags))
            .map(str => str.slice(str.indexOf("<")));
        let warningsDescription: string = await this.getOneText(guildID, "RATING_REPORT_WARNINGS_TITLE");
        let warningDescriptionLines: string[] = await this.getManyText(guildID, warnings);
        let title: string = await this.getOneText(guildID, "RATING_REPORT_TITLE");
        let labels: string[] = await this.getManyText(guildID, [
            "RATING_CONFIRM_BUTTON", "RATING_CANCEL_BUTTON" 
        ]);

        if(errors.length === 0)
            this.databaseServicePendingRatingNote.insertAll(pendingRatingNotes);

        let embeds: EmbedBuilder[], buttons: ActionRowBuilder<ButtonBuilder>[];
        if(errors.length > 0) {
            let errorsDescription: string = await this.getOneText(guildID, "RATING_REPORT_ERRORS_PROCESSING_TITLE", UtilsGeneratorTimestamp.getRelativeTime(this.ratingProcessingTimeoutMs));
            let errorDescriptionLines: string[] = await this.getManyText(guildID, errors);
            embeds = this.ratingUI.reportProcessingErrorEmbed(
                message.author, false,
                usersRating, pendingRatingNotes, 
                title, descriptionHeaders, victoryLines, civLines, "",
                errorsDescription, errorDescriptionLines, warningsDescription, warningDescriptionLines
            );
            buttons = this.ratingUI.reportProcessingButtons(message.author.id, pendingRatingNotes[0].gameID, labels, true)
        } else {
            let readyDescription: string = await this.getOneText(guildID, "RATING_REPORT_OK_PROCESSING_TITLE", UtilsGeneratorTimestamp.getRelativeTime(this.ratingProcessingTimeoutMs));
            embeds = this.ratingUI.reportProcessingOKEmbed(
                message.author, false,
                usersRating, pendingRatingNotes,
                title, descriptionHeaders, victoryLines, civLines, "",
                readyDescription, warningsDescription, warningDescriptionLines
            );
            buttons = this.ratingUI.reportProcessingButtons(message.author.id, pendingRatingNotes[0].gameID, labels);
        }

        RatingService.processingChatMessages.set(message.id, {
            userMessage: message,
            botMessage: await data.botMessage.edit({embeds: embeds, components: buttons}),
            timeOfDelete: Date.now()+this.ratingProcessingTimeoutMs,
            timeout: setTimeout(RatingService.deleteNextProcessingChatMessage, this.ratingProcessingTimeoutMs),
            pendingGameID: pendingRatingNotes[0].gameID
        });
    }

    public async report(interaction: CommandInteraction, type: string, msg: string) {
        let isModedrator: boolean = await this.isModerator(interaction);
        let moderatorReportChannelID: string = await this.getOneSettingString(interaction, "RATING_MODERATOR_REPORTS_CHANNEL_ID");
        if(!isModedrator && (moderatorReportChannelID === "")) {
            let textLines: string[] = await this.getManyText(interaction, [
                "BASE_ERROR_TITLE", "RATING_ERROR_NO_REPORT_CHANNEL"
            ]);
            return interaction.reply({embeds: this.ratingUI.error(textLines[0], textLines[1]), ephemeral: true});
        }

        let pendingRatingNotes: EntityPendingRatingNote[] = await this.generatePendingRatingNotes(interaction, msg, type);
        let usersRating: EntityUserRating[] = await this.databaseServiceUserRating.getMany(interaction.guild?.id as string, pendingRatingNotes.map(note => note.userID));
        let [eloK, eloD, victoryMultiplier] = await this.getManySettingNumber(interaction, "RATING_ELO_K", "RATING_ELO_D", "RATING_VICTORY_MULTIPLIER");
        this.calculateRatingNotes(pendingRatingNotes, usersRating, eloK, eloD, victoryMultiplier);
        let {errors, warnings} = await this.checkPendingRatingNotes(pendingRatingNotes, interaction);
        this.applyPendingRating(usersRating, pendingRatingNotes);
        let descriptionHeaders: string[] = await this.getManyText(interaction, [
            "RATING_DESCRIPTION_ID_HEADER", "RATING_DESCRIPTION_GAME_TYPE_HEADER",
            "RATING_DESCRIPTION_HOST_HEADER", "RATING_DESCRIPTION_VICTORY_TYPE_HEADER"
        ]);
        let victoryLines: string[] = await this.getManyText(interaction, [
            "RATING_DESCRIPTION_VICTORY_SCIENCE", "RATING_DESCRIPTION_VICTORY_CULTURE",
            "RATING_DESCRIPTION_VICTORY_DOMINATION", "RATING_DESCRIPTION_VICTORY_RELIGIOUS",
            "RATING_DESCRIPTION_VICTORY_DIPLOMATIC", "RATING_DESCRIPTION_VICTORY_CC",
            "RATING_DESCRIPTION_VICTORY_GG"
        ]);
        let moderatorPrefix: string = await this.getOneText(interaction, "RATING_MODERATOR_PREFIX_BOTTOM");
        let civLines: string[] = (await this.getManyText(interaction, UtilsServiceCivilizations.civilizationsTags))
            .map(str => str.slice(str.indexOf("<")));
        let warningsDescription: string = await this.getOneText(interaction, "RATING_REPORT_WARNINGS_TITLE");
        let warningDescriptionLines: string[] = await this.getManyText(interaction, warnings);

        if(errors.length > 0) {
            let title: string = await this.getOneText(interaction, "BASE_ERROR_TITLE");
            let errorsDescription: string = await this.getOneText(interaction, "RATING_REPORT_ERRORS_TITLE");
            let errorDescriptionLines: string[] = await this.getManyText(interaction, errors);
            return interaction.reply({
                embeds: this.ratingUI.reportProcessingErrorEmbed(
                    interaction.user, isModedrator,
                    usersRating, pendingRatingNotes, 
                    title, descriptionHeaders, victoryLines, civLines, moderatorPrefix,
                    errorsDescription, errorDescriptionLines, warningsDescription, warningDescriptionLines
                ),
                ephemeral: true
            });
        }

        this.databaseServicePendingRatingNote.insertAll(pendingRatingNotes);

        let readyDescription: string = await this.getOneText(interaction, "RATING_REPORT_OK_TITLE", UtilsGeneratorTimestamp.getRelativeTime(this.ratingProcessingTimeoutMs));
        let title: string = await this.getOneText(interaction, "RATING_REPORT_TITLE");
        let labels: string[] = await this.getManyText(interaction, [
            "RATING_CONFIRM_BUTTON", "RATING_CANCEL_BUTTON" 
        ]);
        RatingService.processingSlashMessages.push(await interaction.reply({
            embeds: this.ratingUI.reportProcessingOKEmbed(
                interaction.user, isModedrator,
                usersRating, pendingRatingNotes,
                title, descriptionHeaders, victoryLines, civLines, moderatorPrefix,
                readyDescription, warningsDescription, warningDescriptionLines
            ), components: this.ratingUI.reportProcessingButtons(interaction.user.id, pendingRatingNotes[0].gameID, labels),
            fetchReply: true
        }));
        setTimeout(RatingService.deleteNextProcessingSlashMessage, this.ratingProcessingTimeoutMs);
    }

    public async reportUserDeleteButton(interaction: ButtonInteraction) {
        interaction.deferUpdate();
        if(!this.isOwner(interaction))
            return;
        let pendingGameID: number = Number(interaction.customId.split("-")[4]);
        interaction.message.delete();
        this.databaseServicePendingRatingNote.deleteAllByGameID(pendingGameID);
    }

    public async reportUserConfirmButton(interaction: ButtonInteraction) {
        interaction.deferUpdate();
        if(!this.isOwner(interaction))
            return;
        if(await this.isModerator(interaction)) 
            return this.reportModeratorAcceptButton(interaction);
        await interaction.message.edit({components: []});
        let moderatorReportChannelID: string = await this.getOneSettingString(interaction, "RATING_MODERATOR_REPORTS_CHANNEL_ID");
        let pendingGameID: number = Number(interaction.customId.split("-")[4]);
        let pendingRatingNotes: EntityPendingRatingNote[] = await this.databaseServicePendingRatingNote.getAllByGameID(interaction.guild?.id as string, pendingGameID);
        if(pendingRatingNotes.length === 0) {
            let textLines: string[] = await this.getManyText(interaction, [
                "BASE_ERROR_TITLE", "RATING_ERROR_REPORT_NOT_FOUND"
            ]);
            return interaction.message.edit({embeds: this.ratingUI.error(textLines[0], textLines[1])});
        }
        try {
            let channel: TextChannel|null = (await interaction.guild?.channels.fetch(moderatorReportChannelID)) as TextChannel|null;
            if(channel === null)
                throw "ChannelIsNull";
            let usersID: string[] = pendingRatingNotes.map(note => note.userID);
            let usersRating: EntityUserRating[] = await this.databaseServiceUserRating.getMany(interaction.guild?.id as string, usersID);
            let title: string = await this.getOneText(interaction, "RATING_MODERATION_TITLE");
            let descriptionHeaders: string[] = await this.getManyText(interaction, [
                "RATING_DESCRIPTION_ID_HEADER", "RATING_DESCRIPTION_GAME_TYPE_HEADER",
                "RATING_DESCRIPTION_HOST_HEADER", "RATING_DESCRIPTION_VICTORY_TYPE_HEADER"
            ]);
            let victoryLines: string[] = await this.getManyText(interaction, [
                "RATING_DESCRIPTION_VICTORY_SCIENCE", "RATING_DESCRIPTION_VICTORY_CULTURE",
                "RATING_DESCRIPTION_VICTORY_DOMINATION", "RATING_DESCRIPTION_VICTORY_RELIGIOUS",
                "RATING_DESCRIPTION_VICTORY_DIPLOMATIC", "RATING_DESCRIPTION_VICTORY_CC",
                "RATING_DESCRIPTION_VICTORY_GG"
            ]);
            let civLines: string[] = (await this.getManyText(interaction, UtilsServiceCivilizations.civilizationsTags))
                .map(str => str.slice(str.indexOf("<")));
            let labels: string[] = await this.getManyText(interaction, [
                "RATING_CONFIRM_BUTTON", "RATING_CANCEL_BUTTON" 
            ]);
            let [isReportReactEmojis, isReportAllNotify] = await this.getManySettingNumber(interaction, "RATING_REPORT_MODERATION_EMOJIS", "RATING_REPORT_ALL_PM_NOTIFY");
            let reportMessage: Message = await channel.send({
                embeds: this.ratingUI.reportAcceptRevertEmbed(
                    interaction.user, false,
                    usersRating, pendingRatingNotes,
                    title, descriptionHeaders, victoryLines, civLines, ""
                ), components: this.ratingUI.reportModeratorButtons(interaction.user.id, pendingGameID, labels)
            });
            let textLines: string[] = await this.getManyText(interaction, [
                "BASE_NOTIFY_TITLE", "RATING_REPORT_SUCCESS_DESCRIPTION"
            ]);
            if(isReportReactEmojis) 
                UtilsServiceEmojis.reactOrder(reportMessage, ["<:Yes:808418109710794843>", "<:No:808418109319938099>"]);
            
            interaction.message.edit({embeds: this.ratingUI.notify(textLines[0], textLines[1])});
            if(isReportAllNotify) {
                let gameType: string = pendingRatingNotes[0].gameType as string;
                let textLines: string[] = await this.getManyText(interaction, [
                    "RATING_REPORT_MODERATION_PM_NOTIFY_TITLE", "RATING_REPORT_MODERATION_PM_NOTIFY_DESCRIPTION"
                ], [[gameType], [reportMessage.url]]);
                let embed: EmbedBuilder[] = this.ratingUI.reportPMEmbed(
                    gameType, textLines[0], textLines[1], interaction.guild
                );
                usersID.filter(userID => userID !== interaction.user.id)
                    .forEach(userID => UtilsServicePM.send(userID, embed));
            }
        } catch {
            let textLines: string[] = await this.getManyText(interaction, [
                "BASE_ERROR_TITLE", "RATING_ERROR_NO_REPORT_CHANNEL"
            ]);
            interaction.message.edit({embeds: this.ratingUI.error(textLines[0], textLines[1])});
        }        
    }

    public async reportModeratorRejectButton(interaction: ButtonInteraction) {
        let isModerator: boolean = await this.isModerator(interaction);

        if(!isModerator && !this.isOwner(interaction)) {
            let textLines: string[] = await this.getManyText(interaction, [
                "BASE_ERROR_TITLE", "RATING_ERROR_NO_PERMISSION"
            ]);
            return interaction.reply({embeds: this.ratingUI.error(textLines[0], textLines[1]), ephemeral: true});
        }
        let pendingGameID: number = Number(interaction.customId.split("-")[4]);

        if(isModerator && (await this.getOneSettingNumber(interaction, "RATING_REJECT_AUTHOR_PM_NOTIFY"))) {
            let textLines: string[] = await this.getManyText(interaction, [
                "RATING_MODAL_REJECT_TITLE", "RATING_MODAL_REJECT_DESCRIPTION"
            ]);
            return interaction.showModal(this.ratingUI.rejectModal(
                interaction.customId.split("-").pop() as string, pendingGameID, textLines[0], textLines[1])
            );
        }

        interaction.message.delete();
        this.databaseServicePendingRatingNote.deleteAllByGameID(pendingGameID);
    }

    public async reportModeratorRejectModal(interaction: ModalSubmitInteraction) {
        if(!(await this.isModerator(interaction))) {
            let textLines: string[] = await this.getManyText(interaction, [
                "BASE_ERROR_TITLE", "RATING_ERROR_NO_PERMISSION"
            ]);
            return interaction.reply({embeds: this.ratingUI.error(textLines[0], textLines[1]), ephemeral: true});
        }
        let rejectDescription: string = Array.from(interaction.fields.fields.values())[0].value || "";
        let pendingGameID: number = Number(interaction.customId.split("-")[5]);
        interaction.message?.delete();
        let pendingRatingNotes: EntityPendingRatingNote[] = await this.databaseServicePendingRatingNote.getAllByGameID(interaction.guild?.id as string, pendingGameID);
        this.databaseServicePendingRatingNote.deleteAllByGameID(pendingGameID);
        if(pendingRatingNotes.length > 0) {
            let authorID: string = interaction.customId.split("-").pop() as string;
            let usersRating: EntityUserRating[] = await this.databaseServiceUserRating.getMany(interaction.guild?.id as string, pendingRatingNotes.map(note => note.userID));
            let textLines: string[] = await this.getManyText(interaction, [
                "RATING_REPORT_REJECT_TITLE", (rejectDescription.length > 0) ? "RATING_REPORT_REJECT_DESCRIPTION" : "RATING_REPORT_REJECT_NO_REASON_DESCRIPTION"
            ], [null, [interaction.user.tag, rejectDescription]]);
            let descriptionHeaders: string[] = await this.getManyText(interaction, [
                "RATING_DESCRIPTION_ID_HEADER", "RATING_DESCRIPTION_GAME_TYPE_HEADER",
                "RATING_DESCRIPTION_HOST_HEADER", "RATING_DESCRIPTION_VICTORY_TYPE_HEADER"
            ]);
            let victoryLines: string[] = await this.getManyText(interaction, [
                "RATING_DESCRIPTION_VICTORY_SCIENCE", "RATING_DESCRIPTION_VICTORY_CULTURE",
                "RATING_DESCRIPTION_VICTORY_DOMINATION", "RATING_DESCRIPTION_VICTORY_RELIGIOUS",
                "RATING_DESCRIPTION_VICTORY_DIPLOMATIC", "RATING_DESCRIPTION_VICTORY_CC",
                "RATING_DESCRIPTION_VICTORY_GG"
            ]);
            let civLines: string[] = (await this.getManyText(interaction, UtilsServiceCivilizations.civilizationsTags))
                .map(str => str.slice(str.indexOf("<")));
            UtilsServicePM.send(authorID, this.ratingUI.reportRejectPMEmbed(
                interaction.guild as Guild, usersRating, pendingRatingNotes,
                textLines[0], textLines[1], descriptionHeaders, victoryLines, civLines
            ));
        }
    }

    public async reportModeratorAcceptButton(interaction: ButtonInteraction) {
        if(!(await this.isModerator(interaction))) {
            let textLines: string[] = await this.getManyText(interaction, [
                "BASE_ERROR_TITLE", "RATING_ERROR_NO_PERMISSION"
            ]);
            return interaction.reply({embeds: this.ratingUI.error(textLines[0], textLines[1]), ephemeral: true});
        }
        let pendingGameID: number = Number(interaction.customId.split("-")[4]);
        let pendingRatingNotes: EntityPendingRatingNote[] = await this.databaseServicePendingRatingNote.getAllByGameID(interaction.guild?.id as string, pendingGameID);
        if(pendingRatingNotes.length === 0) {
            let textLines: string[] = await this.getManyText(interaction, ["BASE_ERROR_TITLE", "RATING_ERROR_REPORT_NOT_FOUND"]);
            return interaction.message.edit({
                embeds: this.ratingUI.error(textLines[0], textLines[1]),
                components: []
            });
        }
        this.databaseServicePendingRatingNote.deleteAllByGameID(pendingGameID);
        let ratingNotes: EntityRatingNote[] = this.convertToRatingNotes(pendingRatingNotes, await this.databaseServiceRatingNote.getNextGameID(interaction.guild?.id as string));
        let usersID: string[] = ratingNotes.map(note => note.userID);
        let usersRating: EntityUserRating[] = await this.databaseServiceUserRating.getMany(interaction.guild?.id as string, usersID);
        let [eloK, eloD, victoryMultiplier] = await this.getManySettingNumber(interaction, "RATING_ELO_K", "RATING_ELO_D", "RATING_VICTORY_MULTIPLIER");
        this.calculateRatingNotes(pendingRatingNotes, usersRating, eloK, eloD, victoryMultiplier);
        this.applyRating(usersRating, ratingNotes);
        this.databaseServiceRatingNote.insertAll(ratingNotes);
        this.databaseServiceUserRating.update(usersRating);
        this.setRatingRole(
            interaction.guild?.id as string, 
            usersRating.map(userRating => userRating.userID), 
            usersRating.map(userRating => userRating.rating)
        );
        
        let title: string = await this.getOneText(interaction, "RATING_REPORT_TITLE");
        let descriptionHeaders: string[] = await this.getManyText(interaction, [
            "RATING_DESCRIPTION_ID_HEADER", "RATING_DESCRIPTION_GAME_TYPE_HEADER",
            "RATING_DESCRIPTION_HOST_HEADER", "RATING_DESCRIPTION_VICTORY_TYPE_HEADER"
        ]);
        let victoryLines: string[] = await this.getManyText(interaction, [
            "RATING_DESCRIPTION_VICTORY_SCIENCE", "RATING_DESCRIPTION_VICTORY_CULTURE",
            "RATING_DESCRIPTION_VICTORY_DOMINATION", "RATING_DESCRIPTION_VICTORY_RELIGIOUS",
            "RATING_DESCRIPTION_VICTORY_DIPLOMATIC", "RATING_DESCRIPTION_VICTORY_CC",
            "RATING_DESCRIPTION_VICTORY_GG"
        ]);
        let civLines: string[] = (await this.getManyText(interaction, UtilsServiceCivilizations.civilizationsTags))
            .map(str => str.slice(str.indexOf("<")));
        let moderatorPrefix: string = await this.getOneText(interaction, "RATING_MODERATOR_PREFIX_BOTTOM");
        let embed: EmbedBuilder[] = this.ratingUI.reportAcceptRevertEmbed(
            interaction.user, true,
            usersRating, ratingNotes,
            title, descriptionHeaders, victoryLines, civLines, moderatorPrefix
        );
        interaction.message.edit({embeds: embed, components: []});

        let botReportChannelID: string = await this.getOneSettingString(interaction, "RATING_BOT_REPORTS_CHANNEL_ID");
        let channel: TextChannel|null = (await interaction.guild?.channels.fetch(botReportChannelID)) as TextChannel|null;
        if(channel !== null)
            try {
                channel.send({embeds: embed});
            } catch {}
        let [isAuthorNotify, isAllNotify] = await this.getManySettingNumber(interaction, "RATING_ACCEPT_AUTHOR_PM_NOTIFY", "RATING_ACCEPT_ALL_PM_NOTIFY");
        let authorID: string = interaction.customId.split("-").pop() as string;
        usersID.filter(userID => isAllNotify || (isAuthorNotify && (userID === authorID)))
            .forEach(userID => UtilsServicePM.send(userID, embed));
    }



    public async cancel(interaction: CommandInteraction, gameID: number) {
        if(!(await this.isModerator(interaction))) {
            let textLines: string[] = await this.getManyText(interaction, [
                "BASE_ERROR_TITLE", "RATING_ERROR_NO_PERMISSION"
            ]);
            return interaction.reply({embeds: this.ratingUI.error(textLines[0], textLines[1]), ephemeral: true});
        }
        let ratingNotes: EntityRatingNote[] = await this.databaseServiceRatingNote.getAllByGameID(interaction.guild?.id as string, gameID);
        if(ratingNotes.length === 0) {
            let textLines: string[] = await this.getManyText(interaction, [
                "BASE_ERROR_TITLE", "RATING_ERROR_WRONG_GAME_ID"
            ]);
            return interaction.reply({embeds: this.ratingUI.error(textLines[0], textLines[1]), ephemeral: true});
        }
        if(!ratingNotes[0].isActive) {
            let textLines: string[] = await this.getManyText(interaction, [
                "BASE_ERROR_TITLE", "RATING_ERROR_ALREADY_CANCELLED"
            ]);
            return interaction.reply({embeds: this.ratingUI.error(textLines[0], textLines[1]), ephemeral: true});
        }
        let usersRating: EntityUserRating[] = await this.databaseServiceUserRating.getMany(interaction.guild?.id as string, ratingNotes.map((ratingNote: EntityRatingNote): string => ratingNote.userID));
        this.applyRating(usersRating, ratingNotes, true);
        this.databaseServiceUserRating.update(usersRating);
        this.databaseServiceRatingNote.updateAll(ratingNotes);
        this.setRatingRole(
            interaction.guild?.id as string, 
            usersRating.map(userRating => userRating.userID), 
            usersRating.map(userRating => userRating.rating)
        );

        let title: string = await this.getOneText(interaction, "RATING_CANCEL_TITLE");
        let descriptionHeaders: string[] = await this.getManyText(interaction, [
            "RATING_DESCRIPTION_ID_HEADER", "RATING_DESCRIPTION_GAME_TYPE_HEADER",
            "RATING_DESCRIPTION_HOST_HEADER"
        ]);
        let moderatorPrefix: string = await this.getOneText(interaction, "RATING_MODERATOR_PREFIX_BOTTOM");
        let embed: EmbedBuilder[] = this.ratingUI.reportCancelEmbed(
            interaction.user,
            usersRating, ratingNotes,
            title, descriptionHeaders, moderatorPrefix
        );
        interaction.reply({embeds: embed});

        let channelID: string = await this.getOneSettingString(interaction, "RATING_BOT_REPORTS_CHANNEL_ID");
        if(channelID !== "")
            try {
                let channel: TextChannel|null = (await interaction.guild?.channels.fetch(channelID)) as (TextChannel|null);
                channel?.send({embeds: embed});
            } catch {}
    }

    public async revert(interaction: CommandInteraction, gameID: number) {
        if(!(await this.isModerator(interaction))) {
            let textLines: string[] = await this.getManyText(interaction, [
                "BASE_ERROR_TITLE", "RATING_ERROR_NO_PERMISSION"
            ]);
            return interaction.reply({embeds: this.ratingUI.error(textLines[0], textLines[1]), ephemeral: true});
        }
        let ratingNotes: EntityRatingNote[] = await this.databaseServiceRatingNote.getAllByGameID(interaction.guild?.id as string, gameID);
        if(ratingNotes.length === 0) {
            let textLines: string[] = await this.getManyText(interaction, [
                "BASE_ERROR_TITLE", "RATING_ERROR_WRONG_GAME_ID"
            ]);
            return interaction.reply({embeds: this.ratingUI.error(textLines[0], textLines[1]), ephemeral: true});
        }
        if(ratingNotes[0].isActive) {
            let textLines: string[] = await this.getManyText(interaction, [
                "BASE_ERROR_TITLE", "RATING_ERROR_ALREADY_REVERTED"
            ]);
            return interaction.reply({embeds: this.ratingUI.error(textLines[0], textLines[1]), ephemeral: true});
        }
        let usersRating: EntityUserRating[] = await this.databaseServiceUserRating.getMany(interaction.guild?.id as string, ratingNotes.map((ratingNote: EntityRatingNote): string => ratingNote.userID));
        this.applyRating(usersRating, ratingNotes);
        this.databaseServiceUserRating.update(usersRating);
        this.databaseServiceRatingNote.updateAll(ratingNotes);
        this.setRatingRole(
            interaction.guild?.id as string, 
            usersRating.map(userRating => userRating.userID), 
            usersRating.map(userRating => userRating.rating)
        );

        let title: string = await this.getOneText(interaction, "RATING_REVERT_TITLE");
        let descriptionHeaders: string[] = await this.getManyText(interaction, [
            "RATING_DESCRIPTION_ID_HEADER", "RATING_DESCRIPTION_GAME_TYPE_HEADER",
            "RATING_DESCRIPTION_HOST_HEADER", "RATING_DESCRIPTION_VICTORY_TYPE_HEADER"
        ]);
        let victoryLines: string[] = await this.getManyText(interaction, [
            "RATING_DESCRIPTION_VICTORY_SCIENCE", "RATING_DESCRIPTION_VICTORY_CULTURE",
            "RATING_DESCRIPTION_VICTORY_DOMINATION", "RATING_DESCRIPTION_VICTORY_RELIGIOUS",
            "RATING_DESCRIPTION_VICTORY_DIPLOMATIC", "RATING_DESCRIPTION_VICTORY_CC",
            "RATING_DESCRIPTION_VICTORY_GG"
        ]);
        let civLines: string[] = (await this.getManyText(interaction, UtilsServiceCivilizations.civilizationsTags))
            .map(str => str.slice(str.indexOf("<")));
        let moderatorPrefix: string = await this.getOneText(interaction, "RATING_MODERATOR_PREFIX_BOTTOM");
        let embed: EmbedBuilder[] = this.ratingUI.reportAcceptRevertEmbed(
            interaction.user, true,
            usersRating, ratingNotes,
            title, descriptionHeaders, victoryLines, civLines, moderatorPrefix
        );
        interaction.reply({embeds: embed});

        let channelID: string = await this.getOneSettingString(interaction, "RATING_BOT_REPORTS_CHANNEL_ID");
        if(channelID !== "")
            try {
                let channel: TextChannel|null = (await interaction.guild?.channels.fetch(channelID)) as (TextChannel|null);
                channel?.send({embeds: embed});
            } catch {}
    }



    public async setUser(interaction: CommandInteraction, member: GuildMember, type: string, amount: number) {
        if(!(await this.isModerator(interaction))) {
            let textLines: string[] = await this.getManyText(interaction, [
                "BASE_ERROR_TITLE", "RATING_ERROR_NO_PERMISSION"
            ]);
            return interaction.reply({embeds: this.ratingUI.error(textLines[0], textLines[1]), ephemeral: true});
        }
        let userRating: EntityUserRating = await this.databaseServiceUserRating.getOne(interaction.guild?.id as string, member.id);
        if(
            ((type === "FFA") && (userRating.ffaRating === amount)) ||
            ((type === "Teamers") && (userRating.teamersRating === amount)) ||
            ((type === "General") && (userRating.rating === amount)) 
        ) {
            let textLines: string[] = await this.getManyText(interaction, [
                "BASE_ERROR_TITLE", "RATING_ERROR_SAME_VALUE"
            ]);
            return interaction.reply({embeds: this.ratingUI.error(textLines[0], textLines[1]), ephemeral: true});
        }
        
        let amountBefore: number;
        if(type === "FFA")
            amountBefore = userRating.ffaRating;
        else if(type === "Teamers")
            amountBefore = userRating.teamersRating;
        else
            amountBefore = userRating.rating;
        this.addUser(interaction, member, type, amount-amountBefore);
    }

    public async addUser(interaction: CommandInteraction, member: GuildMember, type: string, amount: number) {
        if(!(await this.isModerator(interaction))) {
            let textLines: string[] = await this.getManyText(interaction, [
                "BASE_ERROR_TITLE", "RATING_ERROR_NO_PERMISSION"
            ]);
            return interaction.reply({embeds: this.ratingUI.error(textLines[0], textLines[1]), ephemeral: true});
        }
        if(amount === 0) {
            let textLines: string[] = await this.getManyText(interaction, [
                "BASE_ERROR_TITLE", "RATING_ERROR_ZERO_DIFFERENCE"
            ]);
            return interaction.reply({embeds: this.ratingUI.error(textLines[0], textLines[1]), ephemeral: true});
        }
        let userRating: EntityUserRating = await this.databaseServiceUserRating.getOne(interaction.guild?.id as string, member.id);
        if(
            ((type === "FFA") && (userRating.ffaRating+amount < 0)) ||
            ((type === "Teamers") && (userRating.teamersRating+amount < 0)) ||
            ((type === "General") && (userRating.rating+amount < 0))
        ) {
            let textLines: string[] = await this.getManyText(interaction, [
                "BASE_ERROR_TITLE", "RATING_ERROR_NEGATIVE_RESULT"
            ]);
            return interaction.reply({embeds: this.ratingUI.error(textLines[0], textLines[1]), ephemeral: true});
        }
        if(type === "FFA")
            userRating.ffaRating += amount;
        else if(type === "Teamers")
            userRating.teamersRating += amount;
        else {
            userRating.rating += amount;
            this.setRatingRole(interaction.guild?.id as string, member.user.id, userRating.rating);
        }

        this.databaseServiceUserRating.update(userRating);

        let title: string = await this.getOneText(interaction, "RATING_ADD_TITLE");
        let fieldTitles: string[] = await this.getManyText(interaction, [
            "RATING_ADD_FIELD_PLAYER_TITLE", "RATING_ADD_FIELD_TYPE_TITLE",
            "RATING_ADD_FIELD_VALUE_TITLE"
        ]);
        let moderatorPrefix: string = await this.getOneText(interaction, "RATING_MODERATOR_PREFIX_BOTTOM");
        let embed: EmbedBuilder[] = this.ratingUI.addUser(
            interaction.user, userRating, type, amount, 
            title, fieldTitles, moderatorPrefix
        );
        interaction.reply({embeds: embed});

        let channelID: string = await this.getOneSettingString(interaction, "RATING_BOT_REPORTS_CHANNEL_ID");
        if(channelID !== "")
            try {
                let channel: TextChannel|null = (await interaction.guild?.channels.fetch(channelID)) as (TextChannel|null);
                channel?.send({embeds: embed});
            } catch {}
    }



    public async resetUser(interaction: CommandInteraction, member: GuildMember) {
        if(!(await this.isModerator(interaction))) {
            let textLines: string[] = await this.getManyText(interaction, [
                "BASE_ERROR_TITLE", "RATING_ERROR_NO_PERMISSION"
            ]);
            return interaction.reply({embeds: this.ratingUI.error(textLines[0], textLines[1]), ephemeral: true});
        }
        let textLines: string[] = await this.getManyText(interaction, [
            "RATING_RESET_USER_TITLE", "RATING_RESET_USER_DESCRIPTION"
        ], [null, [member.id]]);
        let labels: string[] = await this.getManyText(interaction, [
            "RATING_CONFIRM_BUTTON", "RATING_CANCEL_BUTTON" 
        ]);
        interaction.reply({
            embeds: this.ratingUI.notify(textLines[0], textLines[1]),
            components: this.ratingUI.resetUserButtons(interaction.user.id, member.id, labels)
        });
    }

    public async resetUserCancelButton(interaction: ButtonInteraction) {
        interaction.deferUpdate();
        if(!this.isOwner(interaction))
            return;
        interaction.message.delete();
    }

    public async resetUserConfirmButton(interaction: ButtonInteraction) {
        if(!this.isOwner(interaction))
            return interaction.deferUpdate();
        if(!(await this.isModerator(interaction))) {
            let textLines: string[] = await this.getManyText(interaction, [
                "BASE_ERROR_TITLE", "RATING_ERROR_NO_PERMISSION"
            ]);
            await interaction.reply({embeds: this.ratingUI.error(textLines[0], textLines[1]), ephemeral: true});
            return await interaction.message.delete();
        }
        
        let userID: string = interaction.customId.split("-")[4];
        this.databaseServiceUserRating.resetOne(interaction.guild?.id as string, userID);
        let ratingDefaultPoints: number = await this.getOneSettingNumber(interaction, "RATING_DEFAULT_POINTS");
        this.setRatingRole(interaction.guild?.id as string, userID, ratingDefaultPoints);

        let textLines: string[] = await this.getManyText(interaction, [
            "BASE_NOTIFY_TITLE", "RATING_RESET_USER_NOTIFICATION_DESCRIPTION"
        ], [null, [userID]]);
        await interaction.reply({embeds: this.ratingUI.notify(textLines[0], textLines[1]), ephemeral: true});
        await interaction.message.delete();
    }



    public async resetAll(interaction: CommandInteraction) {
        if(!(await this.isModerator(interaction))) {
            let textLines: string[] = await this.getManyText(interaction, [
                "BASE_ERROR_TITLE", "RATING_ERROR_NO_PERMISSION"
            ]);
            return interaction.reply({embeds: this.ratingUI.error(textLines[0], textLines[1]), ephemeral: true});
        }
        let usersAmount: number = await this.databaseServiceUserRating.getUsersAmount(interaction.guild?.id as string);
        if(usersAmount === 0) {
            let textLines = await this.getManyText(interaction, [
                "BASE_ERROR_TITLE", "RATING_ERROR_ZERO_USERS"
            ]);
            return interaction.reply({embeds: this.ratingUI.error(textLines[0], textLines[1]), ephemeral: true});
        }
        let textLines: string[] = await this.getManyText(interaction, [
            "RATING_RESET_ALL_TITLE", "RATING_RESET_ALL_DESCRIPTION"
        ], [null, [usersAmount]]);
        let labels: string[] = await this.getManyText(interaction, [
            "RATING_CONFIRM_BUTTON", "RATING_CANCEL_BUTTON" 
        ]);
        interaction.reply({
            embeds: this.ratingUI.notify(textLines[0], textLines[1]),
            components: this.ratingUI.wipeAllButtons(interaction.user.id, labels)
        });
    }

    public async resetAllCancelButton(interaction: ButtonInteraction) {
        interaction.deferUpdate();
        if(!this.isOwner(interaction))
            return;
        interaction.message.delete();
    }

    public async resetAllConfirmButton(interaction: ButtonInteraction) {
        if(!this.isOwner(interaction))
            return await interaction.deferUpdate();
        if(!(await this.isModerator(interaction))) {
            let textLines: string[] = await this.getManyText(interaction, [
                "BASE_ERROR_TITLE", "RATING_ERROR_NO_PERMISSION"
            ]);
            await interaction.reply({embeds: this.ratingUI.error(textLines[0], textLines[1]), ephemeral: true});
            return await interaction.message.delete();
        }
        
        let usersRating: EntityUserRating[] = await this.databaseServiceUserRating.resetAll(interaction.guild?.id as string);
        let ratingDefaultPoints: number = await this.getOneSettingNumber(interaction, "RATING_DEFAULT_POINTS");
        this.setRatingRole(interaction.guild?.id as string, usersRating.map(userRating => userRating.userID), Array<number>(usersRating.length).fill(ratingDefaultPoints));

        let textLines: string[] = await this.getManyText(interaction, [
            "BASE_NOTIFY_TITLE", "RATING_RESET_ALL_NOTIFICATION_DESCRIPTION"
        ], [null, [usersRating.length]]);
        await interaction.reply({embeds: this.ratingUI.notify(textLines[0], textLines[1]), ephemeral: true});
        await interaction.message.delete();
    }



    public async wipeUser(interaction: CommandInteraction, member: GuildMember) {
        if(!(await this.isModerator(interaction))) {
            let textLines: string[] = await this.getManyText(interaction, [
                "BASE_ERROR_TITLE", "RATING_ERROR_NO_PERMISSION"
            ]);
            return interaction.reply({embeds: this.ratingUI.error(textLines[0], textLines[1]), ephemeral: true});
        }
        let textLines: string[] = await this.getManyText(interaction, [
            "RATING_WIPE_USER_TITLE", "RATING_WIPE_USER_DESCRIPTION"
        ], [null, [member.id]]);
        let labels: string[] = await this.getManyText(interaction, [
            "RATING_CONFIRM_BUTTON", "RATING_CANCEL_BUTTON" 
        ]);
        interaction.reply({
            embeds: this.ratingUI.notify(textLines[0], textLines[1]),
            components: this.ratingUI.wipeUserButtons(interaction.user.id, member.id, labels)
        });
    }

    public async wipeUserCancelButton(interaction: ButtonInteraction) {
        interaction.deferUpdate();
        if(!this.isOwner(interaction))
            return;
        interaction.message.delete();
    }

    public async wipeUserConfirmButton(interaction: ButtonInteraction) {
        if(!this.isOwner(interaction))
            return interaction.deferUpdate();
        if(!(await this.isModerator(interaction))) {
            let textLines: string[] = await this.getManyText(interaction, [
                "BASE_ERROR_TITLE", "RATING_ERROR_NO_PERMISSION"
            ]);
            await interaction.reply({embeds: this.ratingUI.error(textLines[0], textLines[1]), ephemeral: true});
            return await interaction.message.delete();
        }
        
        let userID: string = interaction.customId.split("-")[4];
        this.databaseServiceUserRating.deleteOne(interaction.guild?.id as string, userID);
        this.setRatingRole(interaction.guild?.id as string, userID, -1);

        let textLines: string[] = await this.getManyText(interaction, [
            "BASE_NOTIFY_TITLE", "RATING_WIPE_USER_NOTIFICATION_DESCRIPTION"
        ], [null, [userID]]);
        await interaction.reply({embeds: this.ratingUI.notify(textLines[0], textLines[1]), ephemeral: true});
        await interaction.message.delete();
    }


    
    public async wipeAll(interaction: CommandInteraction) {
        if(!(await this.isModerator(interaction))) {
            let textLines: string[] = await this.getManyText(interaction, [
                "BASE_ERROR_TITLE", "RATING_ERROR_NO_PERMISSION"
            ]);
            return interaction.reply({embeds: this.ratingUI.error(textLines[0], textLines[1]), ephemeral: true});
        }
        let usersAmount: number = await this.databaseServiceUserRating.getUsersAmount(interaction.guild?.id as string);
        if(usersAmount === 0) {
            let textLines = await this.getManyText(interaction, [
                "BASE_ERROR_TITLE", "RATING_ERROR_ZERO_USERS"
            ]);
            return interaction.reply({embeds: this.ratingUI.error(textLines[0], textLines[1]), ephemeral: true});
        }
        let textLines: string[] = await this.getManyText(interaction, [
            "RATING_WIPE_ALL_TITLE", "RATING_WIPE_ALL_DESCRIPTION"
        ], [null, [usersAmount]]);
        let labels: string[] = await this.getManyText(interaction, [
            "RATING_CONFIRM_BUTTON", "RATING_CANCEL_BUTTON" 
        ]);
        interaction.reply({
            embeds: this.ratingUI.notify(textLines[0], textLines[1]),
            components: this.ratingUI.wipeAllButtons(interaction.user.id, labels)
        });
    }

    public async wipeAllCancelButton(interaction: ButtonInteraction) {
        interaction.deferUpdate();
        if(!this.isOwner(interaction))
            return;
        interaction.message.delete();
    }

    public async wipeAllConfirmButton(interaction: ButtonInteraction) {
        if(!this.isOwner(interaction))
            return await interaction.deferUpdate();
        if(!(await this.isModerator(interaction))) {
            let textLines: string[] = await this.getManyText(interaction, [
                "BASE_ERROR_TITLE", "RATING_ERROR_NO_PERMISSION"
            ]);
            await interaction.reply({embeds: this.ratingUI.error(textLines[0], textLines[1]), ephemeral: true});
            return await interaction.message.delete();
        }

        let usersRating: EntityUserRating[] = await this.databaseServiceUserRating.deleteAll(interaction.guild?.id as string);
        this.setRatingRole(interaction.guild?.id as string, usersRating.map(userRating => userRating.userID), new Array<number>(usersRating.length).fill(-1));    // Убрать роли

        let textLines: string[] = await this.getManyText(interaction, [
            "BASE_NOTIFY_TITLE", "RATING_WIPE_ALL_NOTIFICATION_DESCRIPTION"
        ], [null, [usersRating.length]]);
        await interaction.reply({embeds: this.ratingUI.notify(textLines[0], textLines[1]), ephemeral: true});
        await interaction.message.delete();
    }
}
