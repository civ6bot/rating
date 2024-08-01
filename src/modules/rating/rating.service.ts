import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, CommandInteraction, EmbedBuilder, Guild, GuildMember, Message, ModalSubmitInteraction, PermissionFlagsBits, TextChannel } from "discord.js";
import { discordClient } from "../../client/client";
import { EntityRatingNote } from "../../database/entities/entity.RatingNote";
import { EntityUserRating } from "../../database/entities/entity.UserRating";
import { DatabaseServiceRatingNote } from "../../database/services/service.RatingNote";
import { DatabaseServiceUserRating } from "../../database/services/service.UserRating";
import { UtilsGeneratorTimestamp } from "../../utils/generators/utils.generator.timestamp";
import { UtilsDataCivilizations } from "../../utils/data/utils.data.civilizations";
import { UtilsServiceEmojis } from "../../utils/services/utils.service.emojis";
import { UtilsServicePM } from "../../utils/services/utils.service.PM";
import { ModuleBaseService } from "../base/base.service";
import { RatingChatMessageData } from "./rating.models";
import { RatingUI } from "./rating.ui";
import { UtilsServiceSyntax } from "../../utils/services/utils.service.syntax";
import { RatingAdapter } from "./rating.adapter";

export class RatingService extends ModuleBaseService {                                      // messageID, ratingModelData, ID в зависимости от типа команды:
    public static processingMessagesData: Map<string, RatingChatMessageData> = new Map();   // slashCommand=botMessageID | userMessage=userMessageID
    
    private ratingUI: RatingUI = new RatingUI();
    private ratingAdapter: RatingAdapter = new RatingAdapter();
    private databaseServiceUserRating: DatabaseServiceUserRating = new DatabaseServiceUserRating();
    private databaseServiceRatingNote: DatabaseServiceRatingNote = new DatabaseServiceRatingNote();

    public static async cleanProcessingData(botMessageInteraction: ButtonInteraction | null = null): Promise<void> {
        let databaseServiceRatingNote: DatabaseServiceRatingNote = new DatabaseServiceRatingNote();

        if(botMessageInteraction !== null) {
            let botMessageID: string = botMessageInteraction.message.id;
            let data: RatingChatMessageData|undefined = RatingService.processingMessagesData.get(botMessageID);
            let guildID: string = botMessageInteraction.guild?.id as string;
            let pendingGameID: number;
            RatingService.processingMessagesData.delete(botMessageID);
            if(data) {
                clearTimeout(data.timeout);
                pendingGameID = data.pendingGameID;
            } else {
                pendingGameID = Number(botMessageInteraction.customId.split("-")[4]);
            }
            let ratingNotes: EntityRatingNote[] = await databaseServiceRatingNote.getAllByGameID(guildID, pendingGameID);
            if((ratingNotes.length > 0) && (ratingNotes[0].isPending))
                databaseServiceRatingNote.deleteAllByGameID(guildID, pendingGameID);
            botMessageInteraction.message.delete().catch();
            return;
        }

        for(let key of RatingService.processingMessagesData.keys()) {
            let data: RatingChatMessageData|undefined = RatingService.processingMessagesData.get(key);
            if(!data || data.timeOfDelete > Date.now())
                continue;
            RatingService.processingMessagesData.delete(key);
            clearTimeout(data.timeout);
            try {
                let message: Message = await data.botMessage.fetch();
                if(message?.components?.length > 0)
                    message.delete().catch();
            } catch {}
            let ratingNotes: EntityRatingNote[] = await databaseServiceRatingNote.getAllByGameID(data.botMessage.guild?.id as string, data.pendingGameID);
            if((ratingNotes.length > 0) && (ratingNotes[0].isPending))
                databaseServiceRatingNote.deleteAllByGameID(data.botMessage.guild?.id as string, data.pendingGameID);
            // Не нужно удалять сообщение пользователя.
        }
    }

    private isOwner(interaction: ButtonInteraction): boolean {
        return interaction.customId.split("-").pop() === interaction.user.id;
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
    ): Promise<void> {     // Нужно ХОТЯ БЫ очков, чтобы получить роль
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
                member.roles.add(addRatingRoleID).catch();
            member.roles.remove(ratingRolesID.filter(ratingRoleID => ratingRoleID !== addRatingRoleID)).catch();
        });
    }

    // Принимает на вход текст сообщения пользователя (или аргумент команды)
    // Генерирует и возвращает RatingNote[]
    // с назначенным ID и статусом игры isActive=false, isPending=true.
    // Сгенерированный массив может быть пустым, в таком случае пользователем не были указаны игроки.
    public async generateRatingNotes(
        interaction: CommandInteraction | ButtonInteraction | string, 
        msg: string, gameType: string|null = null
    ): Promise<EntityRatingNote[]> {
        let guildID: string = (typeof interaction === "string") ? interaction : interaction.guild?.id as string;
        let ratingNotes: EntityRatingNote[] = [];

        // ======================== ПАРСИНГ КЛЮЧЕВЫХ СЛОВ 
        // ======================== В процессе создаются объекты EntityRatingNote и заполняются
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
        let newLinesIndex: number = msg.indexOf("\n\n\n");
        if(newLinesIndex === -1)
            newLinesIndex = msg.length;
        let words: string[] = msg
            .concat("\n")
            .slice(0, newLinesIndex)            // Все данные за 3 переносами строки игнорируются
            .replaceAll(/[.,;\-\n]/g, " ")
            .replaceAll("<", " <")
            .replaceAll(">", "> ")
            .replaceAll(": ", " ")
            .toLowerCase()
            .split(" ")
            .filter(str => str.length > 0);
        let synonyms: string[][] = (await this.getManyText(guildID, textKeywords)).map(synonym => synonym.split(", "));
        let civEmojis: string[] = await this.getManySettingString(interaction, ...UtilsDataCivilizations.civilizationsTags.map((str: string): string => str+"_EMOJI"));
        let civLines: string[] = (await this.getManyText(interaction, UtilsDataCivilizations.civilizationsTags, civEmojis.map(str => [str])));
        let baseLanguageCivLines: string[] = [];
        if(!isBaseLanguage) {
            let englishSynonyms: string[][] = (await this.getManyText("DEFAULT", textKeywords)).map(synonym => synonym.split(", "));
            synonyms = synonyms.map((synonym: string[], index: number): string[] => synonym.concat(englishSynonyms[index]));
            let baseCivEmojis: string[] = await this.getManySettingString("DEFAULT", ...UtilsDataCivilizations.civilizationsTags.map((str: string): string => str+"_EMOJI"));
            baseLanguageCivLines = await this.getManyText("DEFAULT", UtilsDataCivilizations.civilizationsTags, baseCivEmojis.map(str => [str]));
        }

        let regexUserID: RegExp = new RegExp(/<@\d+>/);
        let tempIsSubOutFlag: boolean = false, 
            tempIsHostFlag: boolean = false, 
            tempIsTieFlag: boolean = false,
            tempHostUserID: string = "";
        words.forEach((word: string, index: number) => {
            let parseResult: boolean[] = synonyms.map(synonym => UtilsServiceSyntax.searchExactlyTexts(word, synonym).length > 0);
            let synonymIndex: number = parseResult.indexOf(true);
            if(synonymIndex !== -1) 
                switch(synonymIndex) {
                    case 0:
                        if(ratingNotes.length > 0)
                            ratingNotes[ratingNotes.length-1].isHost = true;
                        else
                            tempIsHostFlag = true;
                        return;
                    case 1:
                        if(ratingNotes.length > 0) {
                            ratingNotes[ratingNotes.length-1].isSubIn = true;
                            tempIsSubOutFlag = true;
                        }
                        return;
                    case 2:
                        tempIsTieFlag = true; return;
                    case 3:
                        if(ratingNotes.length > 0)
                            ratingNotes[ratingNotes.length-1].isLeave = true;
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
                let newRatingNote: EntityRatingNote = new EntityRatingNote();
                newRatingNote.userID = userID;
                newRatingNote.isLeave = false;
                newRatingNote.place = ratingNotes.filter(ratingNote => !ratingNote.isSubOut).length+1;
                if(tempIsSubOutFlag) {
                    tempIsSubOutFlag = false;
                    newRatingNote.isSubOut = true;
                    newRatingNote.place = (ratingNotes[ratingNotes.length-1]?.place || 1);
                    if((ratingNotes.length > 0) && Number.isInteger(ratingNotes[ratingNotes.length-1].civilizationID))
                        newRatingNote.civilizationID = ratingNotes[ratingNotes.length-1].civilizationID;
                } else {
                    newRatingNote.isSubOut = false;
                }
                if(tempIsTieFlag) {
                    tempIsTieFlag = false;
                    newRatingNote.place = (ratingNotes[ratingNotes.length-1]?.place || 1);
                }
                if(userID === tempHostUserID) {
                    tempHostUserID = "";
                    newRatingNote.isHost = true;
                }
                ratingNotes.push(newRatingNote);
                return;
            }

            let wordsToParseCivilization: string[] = words.slice(index, index+3);
            for(let i: number = 0; i < wordsToParseCivilization.length; i++) 
                if(wordsToParseCivilization[i].indexOf("@") !== -1) 
                    wordsToParseCivilization.splice(i);
            let bans: number[] = UtilsServiceSyntax.parseBans(wordsToParseCivilization.join(" "), baseLanguageCivLines).bans        // Если это упоминание цивилизации
                .concat(UtilsServiceSyntax.parseBans(wordsToParseCivilization.join(" "), civLines).bans);                          // (сначала на английском, потом на другом)
            if((bans.length > 0) && (ratingNotes.length > 0) && (ratingNotes[ratingNotes.length-1].civilizationID === undefined)) {   // Если ещё не указана цивилизация,
                ratingNotes[ratingNotes.length-1].civilizationID = bans[0];                                                   // то выдать её игроку
                if(ratingNotes[ratingNotes.length-1].isSubOut && ratingNotes[ratingNotes.length-2].isSubIn)     // Заменяющий тоже получает цивилизацию
                    ratingNotes[ratingNotes.length-2].civilizationID = bans[0];
            }
        });
        if((gameType === "FFA") && ((victoryType === "GG") || (victoryType === null)))
            victoryType = "CC";
        else if((gameType === "Teamers") && ((victoryType === "CC") || (victoryType === null)))
            victoryType = "GG";
    
        // ======================== ПЕРЕСЧЁТ МЕСТ ИГРОКОВ
        // ======================== Важно для режима Teamers (возможна будущая реализация для режима 2x2x2x2)
        // ======================== Если тип игры не указан, то данная операция не имеет смысла

        ratingNotes.sort((a, b): number => Number(a.isSubOut)-Number(b.isSubOut) || a.place-b.place || -1);  // для всех заменённых игроков: место = 0
        ratingNotes.forEach(ratingNote => {
            if(ratingNote.isSubOut)
                ratingNote.place = 0;
        });
        let playersTotal: number = ratingNotes.filter(ratingNote => !ratingNote.isSubOut).length;
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
                if(ratingNotes[i*playersPerTeam].place < i*playersPerTeam+1)     // Если первый игрок в команде имеет место меньше, чем положенное
                    currentPlace = ratingNotes[i*playersPerTeam-1].place;        // (например, для 2x2x2x2: 1, 2, 2 (не 3?), 4, 5, 6, 7, 8)
                for(let j: number = 0; j < playersPerTeam; j++)                         // тогда для всех игроков в данной команде нужно поставить места как в предыдущей команде,
                    ratingNotes[i*playersPerTeam+j].place = currentPlace;        // иначе поставить номер команды
            }
        
        // ======================== ЗАПОЛНЕНИЕ ОБЩИМИ ДАННЫМИ
        // ======================== nextGameID объявлен в конце, чтобы была меньше вероятность повтора ID.
        // ======================== Для первого места (не заменённого игрока) дополнительно тип победы
        // ======================== Умножение рейтинга для других типов побед

        let nextGameID: number = await this.databaseServiceRatingNote.getNextGameID(guildID);
        ratingNotes.forEach(ratingNote => {
            if((ratingNote.place === 1) && (!ratingNote.isSubOut))
                ratingNote.victoryType = victoryType;
            ratingNote.guildID = guildID;
            ratingNote.gameID = nextGameID;
            ratingNote.gameType = gameType || "";        // Если не был указан тип игры, то по умолчанию пустая строка
            ratingNote.date = new Date();
            ratingNote.placeTotal = teamsTotal;
            ratingNote.rating = 0;
            ratingNote.typedRating = 0;
            ratingNote.isActive = false;        // Объявление о состоянии
            ratingNote.isPending = true;        // сгенерированного отчёта.
        });

        // ======================== ВОЗВРАТ РЕЗУЛЬТАТА

        return ratingNotes;
    }

    private getLinearRatingChange(
        ratingsWin: number[], ratingsLose: number[],
        linearB: number, linearK: number, linearMaxPoints: number, linearMinPoints: number
    ): number {
        return Math.round(Math.max(Math.min(
            linearB + 10/linearK*(ratingsLose.reduce((a, b) => a+b, 0) - ratingsWin.reduce((a, b) => a+b, 0)/ratingsLose.length), 
        linearMaxPoints), linearMinPoints));
    }

    public calculateRatingNotesLinear(
        ratingNotes: EntityRatingNote[],
        usersRating: EntityUserRating[],
        linearB: number, linearK: number, linearMaxPoints: number, linearMinPoints: number
    ): void {
        let gameType: string|null = ratingNotes[0]?.gameType || null;
        let playersTotal: number = ratingNotes.filter(ratingNote => !ratingNote.isSubOut).length;

        ratingNotes.forEach(ratingNote => {
            ratingNote.rating = 0;
            ratingNote.typedRating = 0;
        });
        let teamsTotal: number = 2, playersPerTeam: number = playersTotal/teamsTotal;
        if((gameType === null) || (playersPerTeam % 1)) {     // Если дробное, т.е. не делится
            return; 
        }

        let linearDelta: number = this.getLinearRatingChange(
            usersRating.slice(0, playersPerTeam).map(userRating => userRating.rating),
            usersRating.slice(playersPerTeam, teamsTotal*playersPerTeam).map(userRating => userRating.rating),
            linearB, linearK, linearMaxPoints, linearMinPoints
        );
        let linearDeltaTyped: number = this.getLinearRatingChange(
            usersRating.slice(0, playersPerTeam).map(userRating => userRating.teamersRating),
            usersRating.slice(playersPerTeam, teamsTotal*playersPerTeam).map(userRating => userRating.teamersRating),
            linearB, linearK, linearMaxPoints, linearMinPoints
        );

        for(let i: number = 0; i < playersPerTeam; i++) {
            ratingNotes[i].rating += linearDelta;
            ratingNotes[i].typedRating += linearDeltaTyped;
            ratingNotes[i+playersPerTeam].rating -= linearDelta;
            ratingNotes[i+playersPerTeam].typedRating -= linearDeltaTyped;
        }
    }

    // Принимает на вход RatingNote[], сооответствующие UserRating[] и параметры.
    // Подсчитывает рейтинг для данных заметок по Эло.
    public calculateRatingNotesElo(
        ratingNotes: EntityRatingNote[],
        usersRating: EntityUserRating[],
        eloK: number, eloD: number, victoryMultiplierPercent: number
    ): void {
        let gameType: string|null = ratingNotes[0]?.gameType || null;
        let playersTotal: number = ratingNotes.filter(ratingNote => !ratingNote.isSubOut).length;
        let victoryType: string|null = ratingNotes[0]?.victoryType || null;

        ratingNotes.forEach(ratingNote => {
            ratingNote.rating = 0;
            ratingNote.typedRating = 0;
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
        
        for(let i: number = 0; i < teamsTotal-1; i++)           // Основные игроки
            for(let j: number = 0; j < playersPerTeam; j++) 
                for(let k: number = (i+1)*playersPerTeam; k < playersTotal; k++) {
                    let winnerIndex: number = i*playersPerTeam+j;
                    let eloIsTie: boolean = (ratingNotes[winnerIndex].place === ratingNotes[k].place);
                    
                    let eloDelta: number = this.getEloRatingChange(
                        usersRating[winnerIndex].rating, usersRating[k].rating,
                        eloK, eloD, eloIsTie
                    );
                    ratingNotes[winnerIndex].rating += eloDelta;
                    ratingNotes[k].rating -= eloDelta;

                    let eloDeltaTyped: number = this.getEloRatingChange(
                        (gameType === "FFA") ? usersRating[winnerIndex].ffaRating : usersRating[winnerIndex].teamersRating,
                        (gameType === "FFA") ? usersRating[k].ffaRating : usersRating[k].teamersRating,
                        eloK, eloD, eloIsTie
                    );
                    ratingNotes[winnerIndex].typedRating += eloDeltaTyped;
                    ratingNotes[k].typedRating -= eloDeltaTyped;
                }
        let subOutIndex: number = 0;
        ratingNotes.forEach((ratingNote: EntityRatingNote, index: number) => {
            if(!ratingNote.isSubIn)
                return;
            while((subOutIndex < ratingNotes.length) && !ratingNotes[subOutIndex].isSubOut)
                subOutIndex++;
            if((subOutIndex >= ratingNotes.length) || !ratingNote.isSubIn || !ratingNotes[subOutIndex].isSubOut)
                return;
            let eloDelta: number = this.getEloRatingChange(
                usersRating[index].rating, usersRating[subOutIndex].rating,
                eloK, eloD
            );
            ratingNote.rating += eloDelta;
            ratingNotes[subOutIndex].rating -= eloDelta;    
            if(ratingNotes[subOutIndex].isLeave && ratingNote.rating < 0){
                ratingNotes[subOutIndex].rating += ratingNote.rating;
                ratingNote.rating = 0;
            }

            let eloDeltaTyped: number = this.getEloRatingChange(
                (gameType === "FFA") ? usersRating[index].ffaRating : usersRating[index].teamersRating,
                (gameType === "FFA") ? usersRating[subOutIndex].ffaRating : usersRating[subOutIndex].teamersRating,
                eloK, eloD
            );
            ratingNote.typedRating += eloDeltaTyped;
            ratingNotes[subOutIndex].typedRating -= eloDeltaTyped; 
            if(ratingNotes[subOutIndex].isLeave && ratingNote.typedRating < 0){
                ratingNotes[subOutIndex].typedRating += ratingNote.typedRating;
                ratingNote.typedRating = 0;
            }
            subOutIndex++;
        });
        if(!!victoryType && (victoryType !== "CC") && (victoryType !== "GG")) {
            ratingNotes.forEach(ratingNote => {
                ratingNote.rating = Math.round(ratingNote.rating*(1+victoryMultiplierPercent/100));
                ratingNote.typedRating = Math.round(ratingNote.typedRating*(1+victoryMultiplierPercent/100));
            });
        } 
    }

    // Принимает на вход заполненные RatingNote[].
    // Возвращает список возникших ошибок и предупреждений.
    public async checkRatingNotes(
        ratingNotes: EntityRatingNote[],
        interaction: CommandInteraction | ButtonInteraction | string,
    ) {
        let errorTags: string[] = [],  warningTags: string[] = [];
        let guildID: string = (typeof interaction === "string") ? interaction : interaction.guild?.id as string;
        let [isReportHost, isReportCivs]: boolean[] = (await this.getManySettingNumber(
            guildID, 
            "RATING_REPORTS_HOST", "RATING_REPORTS_CIVS"
        )).map(value => Boolean(value));
        let playersTotal: number = ratingNotes.filter(ratingNote => !ratingNote.isSubOut).length;
        let teamsTotal: number = ratingNotes[0]?.placeTotal || 0;

        if(ratingNotes[0]?.gameType === null)
            errorTags.push("RATING_REPORT_ERROR_GAME_TYPE");
        if(!ratingNotes.map(ratingNote => ratingNote.userID).every((userID: string, index: number, array: string[]) => array.indexOf(userID) === index))
            errorTags.push("RATING_REPORT_ERROR_SAME_USERS");
        if(playersTotal > 16)
            errorTags.push("RATING_REPORT_ERROR_TOO_MUCH_USERS");
        
        if(ratingNotes[0]?.gameType === "FFA") {
            if(playersTotal < 2)
                errorTags.push("RATING_REPORT_ERROR_NOT_ENOUGH_USERS");
        } else if(ratingNotes[0]?.gameType) {
            if(playersTotal < 4)
                errorTags.push("RATING_REPORT_ERROR_NOT_ENOUGH_USERS");
            else if((teamsTotal > 0) && (playersTotal % teamsTotal))
                errorTags.push("RATING_REPORT_ERROR_TEAMERS_DIVIDE");
        }
        
        if(ratingNotes.every(ratingNote => !ratingNote.isHost)) {
            (isReportHost) 
                ? errorTags.push("RATING_REPORT_ERROR_HOST")
                : warningTags.push("RATING_REPORT_WARNING_HOST");
        }
        if(ratingNotes.some(ratingNote => ratingNote.civilizationID === undefined)) {    // Может быть undefined
            (isReportCivs) 
                ? errorTags.push("RATING_REPORT_ERROR_CIVILIZATIONS")
                : warningTags.push("RATING_REPORT_WARNING_CIVILIZATIONS");
        }

        return {errors: errorTags, warnings: warningTags};        
    }

    // Принимает на вход заполненные RatingNote[] и сооответствующие UserRating[].
    // Добавляет (или отнимает при isCancel) соответствующие параметры.
    public applyRating(
        usersRating: EntityUserRating[],
        ratingNotes: EntityRatingNote[],
        isCancel: boolean = false
    ): void {
        let type: string = ratingNotes[0].gameType;
        let cancelMultiplier: number = (isCancel) ? -1 : 1;
        for(let i in usersRating) {
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
    
    public async onMessage(message: Message, isCreated: boolean) {
        if(message.author.id === discordClient.user?.id)
            return;
        let guildID: string|null = message.guildId;
        if(guildID === null)
            return;
        let userChannelID = await this.getOneSettingString(message.guild?.id as string, "RATING_USER_REPORTS_CHANNEL_ID");
        if(userChannelID !== message.channel.id)
            return;
        
        let ratingNotes: EntityRatingNote[];
        let botMessage: Message|null = null;
        let previousGameID: number|null = null;
        if(isCreated) {
            if(!message.guild?.members.cache
                .get(discordClient.user?.id as string)
                ?.permissionsIn(userChannelID)
                ?.has(PermissionFlagsBits.SendMessages)
            )
                return;
            ratingNotes = await this.generateRatingNotes(guildID, message.content);
            // Если сообщение создано не для рейтинга, то оно игнорируется.
            if(ratingNotes.length === 0)
                return;
        } else {
            let data: RatingChatMessageData|undefined = Array.from(RatingService.processingMessagesData.values())
                .filter((data: RatingChatMessageData) => data.userMessage?.id === message.id)[0];
            if(!data)
                return;
            clearTimeout(data.timeout);
            previousGameID = data.pendingGameID;
            botMessage = data.botMessage;
            ratingNotes = await this.generateRatingNotes(guildID, message.content);
            // Если изменённое сообщение ничего не содержит, то оно игнорируется.
            if(ratingNotes.length === 0)
                return;
            // Если всё ОК, то можно не удалять data из processingMessagesData,
            // потому что в конце алгоритма оно обновится.
            if(previousGameID !== 0)                                                                // Если ID был равен 0,
                ratingNotes.forEach(ratingNote => ratingNote.gameID = previousGameID as number);    // то отчёт был с ошибками, и его нет в БД.
        }                                                                                           // Ему как раз требуется новый ID, который получен в generateRatingNotes.

        let gameID: number = ratingNotes[0].gameID;
        let isModerator: boolean = await this.isModerator(message.member as GuildMember);

        let usersRating: EntityUserRating[] = await this.databaseServiceUserRating.getMany(guildID, ratingNotes.map(note => note.userID));
        let [isEloSystem, isLinearSystem] = await this.getManySettingNumber(guildID, "RATING_ELO_ENABLED", "RATING_LINEAR_ENABLED");
        if(isLinearSystem && (ratingNotes[0].gameType === "Teamers")) {
            let [linearB, linearK, linearMaxPoints, linearMinPoints] = await this.getManySettingNumber(guildID, "RATING_LINEAR_B", "RATING_LINEAR_K", "RATING_LINEAR_MAX", "RATING_LINEAR_MIN");
            this.calculateRatingNotesLinear(ratingNotes, usersRating, linearB, linearK, linearMaxPoints, linearMinPoints);
        } else {
            let [eloK, eloD, victoryMultiplierPercent] = await this.getManySettingNumber(guildID, "RATING_ELO_K", "RATING_ELO_D", "RATING_VICTORY_MULTIPLIER_PERCENT");
            this.calculateRatingNotesElo(ratingNotes, usersRating, eloK, eloD, victoryMultiplierPercent);
        }
        
        let {errors, warnings} = await this.checkRatingNotes(ratingNotes, guildID);
        this.applyRating(usersRating, ratingNotes);
        if(errors.length === 0) {
            await this.databaseServiceRatingNote.deleteAllByGameID(guildID, gameID);
            await this.databaseServiceRatingNote.insertOrUpdateAll(ratingNotes);
        } 
        // Если количество ошибок больше 0, но сообщение только создали,
        // то записи в БД не происходит, потому что там уже что-то лежит, следовательно
        // ID игры зарезервирован.
        // См. также в начале и в конце этой функции.

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
        let moderatorPrefix: string = await this.getOneText(message.guild?.id as string, "RATING_MODERATOR_PREFIX_BOTTOM");
        let civEmojis: string[] = await this.getManySettingString(guildID, ...UtilsDataCivilizations.civilizationsTags.map((str: string): string => str+"_EMOJI"));
        let civLines: string[] = (await this.getManyText(guildID, UtilsDataCivilizations.civilizationsTags, civEmojis.map(str => [str])))
            .map(str => str.slice(str.indexOf("<")));
        let warningsDescription: string = await this.getOneText(guildID, "RATING_REPORT_WARNINGS_TITLE");
        let warningDescriptionLines: string[] = await this.getManyText(guildID, warnings);
        let title: string = await this.getOneText(guildID, "RATING_REPORT_TITLE");
        let labels: string[] = await this.getManyText(guildID, [
            isModerator 
                ? "RATING_CONFIRM_BUTTON" 
                : "RATING_SEND_BUTTON", 
            "RATING_CANCEL_BUTTON" 
        ]);

        let ratingProcessingTimeoutMs = await this.getOneSettingNumber(guildID, "RATING_REPORTS_TIME_MS");
        let embeds: EmbedBuilder[], buttons: ActionRowBuilder<ButtonBuilder>[];
        if(errors.length > 0) {
            let errorsDescription: string = await this.getOneText(guildID, "RATING_REPORT_ERRORS_PROCESSING_TITLE", UtilsGeneratorTimestamp.getRelativeTime(ratingProcessingTimeoutMs));
            let errorDescriptionLines: string[] = await this.getManyText(guildID, errors);
            let descriptionHeadersFlags: boolean[] = [false, true, true, true];
            let description: string = [errorsDescription].concat(errorDescriptionLines, (warningDescriptionLines.length) ? [warningsDescription] : [], warningDescriptionLines).join("\n");
            embeds = this.ratingUI.reportDangerEmbed(
                message.author, isModerator,
                usersRating, ratingNotes, 
                title, description,
                descriptionHeaders, descriptionHeadersFlags,
                victoryLines, civLines, 
                moderatorPrefix
            );
            buttons = this.ratingUI.reportProcessingButtons(message.author.id, gameID, labels, true)
        } else {
            let readyDescription: string = await this.getOneText(guildID, "RATING_REPORT_OK_PROCESSING_TITLE", UtilsGeneratorTimestamp.getRelativeTime(ratingProcessingTimeoutMs));
            let description: string = [readyDescription].concat((warningDescriptionLines.length) ? [warningsDescription] : [], warningDescriptionLines).join("\n");
            let descriptionHeadersFlags: boolean[] = [false, true, true, true];
            embeds = this.ratingUI.reportBrightEmbed(
                message.author, isModerator,
                usersRating, ratingNotes,
                title, description,
                descriptionHeaders, descriptionHeadersFlags,
                victoryLines, civLines,
                moderatorPrefix
            );
            buttons = this.ratingUI.reportProcessingButtons(message.author.id, gameID, labels);
        }
        
        botMessage = (isCreated)
            ? await message.reply({embeds: embeds, components: buttons})
            : await (botMessage as Message).edit({embeds: embeds, components: buttons});
        RatingService.processingMessagesData.set(botMessage.id, {
            botMessage: botMessage,
            userMessage: message,
            timeOfDelete: Date.now()+ratingProcessingTimeoutMs,
            timeout: setTimeout(RatingService.cleanProcessingData, ratingProcessingTimeoutMs),
            pendingGameID: ((isCreated || (previousGameID === 0)) && (errors.length !== 0)) ? 0 : gameID
            // Если ID=0, то такого отчёта в БД нет, потому что он был записан в ошибками.
            // Если ошибочный отчёт снова исправят на ошибочный, то мы сможем это понять по
            // переменной previousGame.
            // Нужно проверять, ID=0? в шагах в начале функции.
        });
    }

    public async report(interaction: CommandInteraction, type: string, msg: string) {
        let isModerator: boolean = await this.isModerator(interaction);
        let moderatorReportChannelID: string = await this.getOneSettingString(interaction, "RATING_MODERATOR_REPORTS_CHANNEL_ID");
        if(!isModerator && (moderatorReportChannelID === "")) {
            let textLines: string[] = await this.getManyText(interaction, [
                "BASE_ERROR_TITLE", "RATING_ERROR_NO_REPORT_CHANNEL"
            ]);
            return interaction.reply({embeds: this.ratingUI.error(textLines[0], textLines[1]), ephemeral: true});
        }

        let ratingNotes: EntityRatingNote[] = await this.generateRatingNotes(interaction, msg, type);
        let usersRating: EntityUserRating[] = await this.databaseServiceUserRating.getMany(interaction.guild?.id as string, ratingNotes.map(note => note.userID));
        let [isEloSystem, isLinearSystem] = await this.getManySettingNumber(interaction, "RATING_ELO_ENABLED", "RATING_LINEAR_ENABLED");
        if(isLinearSystem && (ratingNotes[0].gameType === "Teamers")) {
            let [linearB, linearK, linearMaxPoints, linearMinPoints] = await this.getManySettingNumber(interaction, "RATING_LINEAR_B", "RATING_LINEAR_K", "RATING_LINEAR_MAX", "RATING_LINEAR_MIN");
            this.calculateRatingNotesLinear(ratingNotes, usersRating, linearB, linearK, linearMaxPoints, linearMinPoints);
        } else {
            let [eloK, eloD, victoryMultiplierPercent] = await this.getManySettingNumber(interaction, "RATING_ELO_K", "RATING_ELO_D", "RATING_VICTORY_MULTIPLIER_PERCENT");
            this.calculateRatingNotesElo(ratingNotes, usersRating, eloK, eloD, victoryMultiplierPercent);
        }

        let {errors, warnings} = await this.checkRatingNotes(ratingNotes, interaction);
        this.applyRating(usersRating, ratingNotes);
        if(errors.length === 0)
            this.databaseServiceRatingNote.insertOrUpdateAll(ratingNotes);
        let gameID: number = ratingNotes[0]?.gameID || 0;

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
        let civEmojis: string[] = await this.getManySettingString(interaction, ...UtilsDataCivilizations.civilizationsTags.map((str: string): string => str+"_EMOJI"));
        let civLines: string[] = (await this.getManyText(interaction, UtilsDataCivilizations.civilizationsTags, civEmojis.map(str => [str])))
            .map(str => str.slice(str.indexOf("<")));
        let warningsDescription: string = await this.getOneText(interaction, "RATING_REPORT_WARNINGS_TITLE");
        let warningDescriptionLines: string[] = await this.getManyText(interaction, warnings);

        if(errors.length > 0) {
            let title: string = await this.getOneText(interaction, "BASE_ERROR_TITLE");
            let errorsDescription: string = await this.getOneText(interaction, "RATING_REPORT_ERRORS_TITLE");
            let errorDescriptionLines: string[] = await this.getManyText(interaction, errors);
            let description: string = [errorsDescription].concat(errorDescriptionLines, (warningDescriptionLines.length) ? [warningsDescription] : [], warningDescriptionLines).join("\n");
            let descriptionHeadersFlags: boolean[] = [false, true, true ,true];
            return interaction.reply({
                embeds: this.ratingUI.reportDangerEmbed(
                    interaction.user, isModerator,
                    usersRating, ratingNotes, 
                    title, description,
                    descriptionHeaders, descriptionHeadersFlags,
                    victoryLines, civLines, 
                    moderatorPrefix
                ),
                ephemeral: true
            });
        }
        
        let ratingProcessingTimeoutMs = await this.getOneSettingNumber(interaction, "RATING_REPORTS_TIME_MS");
        let readyDescription: string = await this.getOneText(interaction, "RATING_REPORT_OK_TITLE", UtilsGeneratorTimestamp.getRelativeTime(ratingProcessingTimeoutMs));
        let title: string = await this.getOneText(interaction, "RATING_REPORT_TITLE");
        let labels: string[] = await this.getManyText(interaction, [
            (isModerator) 
                ? "RATING_CONFIRM_BUTTON" 
                : "RATING_SEND_BUTTON",
            "RATING_CANCEL_BUTTON" 
        ]);
        let description: string = [readyDescription].concat((warningDescriptionLines.length) ? [warningsDescription] : [], warningDescriptionLines).join("\n");
        let descriptionHeadersFlags: boolean[] = [false, true, true, true];
    
        let message: Message = await interaction.reply({
            embeds: this.ratingUI.reportBrightEmbed(
                interaction.user, isModerator,
                usersRating, ratingNotes,
                title, description,
                descriptionHeaders, descriptionHeadersFlags,
                victoryLines, civLines,
                moderatorPrefix
            ), components: this.ratingUI.reportProcessingButtons(interaction.user.id, gameID, labels),
            fetchReply: true
        });
        RatingService.processingMessagesData.set(message.id, {
            botMessage: message,
            userMessage: undefined,
            timeOfDelete: Date.now()+ratingProcessingTimeoutMs,
            timeout: setTimeout(RatingService.cleanProcessingData, ratingProcessingTimeoutMs),
            pendingGameID: gameID
        });
    }

    public async reportUserDeleteButton(interaction: ButtonInteraction) {
        await interaction.deferUpdate();
        if(this.isOwner(interaction))
            await RatingService.cleanProcessingData(interaction);
    }

    public async reportUserConfirmButton(interaction: ButtonInteraction) {
        if(!this.isOwner(interaction))
            return interaction.deferUpdate();
        if(await this.isModerator(interaction))
            return this.reportModeratorAcceptButton(interaction);
        clearTimeout(RatingService.processingMessagesData.get(interaction.message.id)?.timeout);
        RatingService.processingMessagesData.delete(interaction.message.id);
        await interaction.update({components: []});       // Чтобы пользователь не нажал дважды
        let moderatorReportChannelID: string = await this.getOneSettingString(interaction, "RATING_MODERATOR_REPORTS_CHANNEL_ID");
        let pendingGameID: number = Number(interaction.customId.split("-")[4]);
        let ratingNotes: EntityRatingNote[] = await this.databaseServiceRatingNote.getAllByGameID(interaction.guild?.id as string, pendingGameID);
        if(ratingNotes.length === 0) {
            let textLines: string[] = await this.getManyText(interaction, [
                "BASE_ERROR_TITLE", "RATING_ERROR_REPORT_NOT_FOUND"
            ]);
            return interaction.message.edit({embeds: this.ratingUI.error(textLines[0], textLines[1])});
        }
        let channel: TextChannel|null = (await interaction.guild?.channels?.fetch?.(moderatorReportChannelID)) as TextChannel|null;
            if(channel === null) {
                let textLines: string[] = await this.getManyText(interaction, [
                    "BASE_ERROR_TITLE", "RATING_ERROR_NO_REPORT_CHANNEL"
                ]);
                return interaction.message.edit({embeds: this.ratingUI.error(textLines[0], textLines[1])});
            }
        let usersID: string[] = ratingNotes.map(note => note.userID);
        let usersRating: EntityUserRating[] = await this.databaseServiceUserRating.getMany(interaction.guild?.id as string, usersID);
        this.applyRating(usersRating, ratingNotes);

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
        let civEmojis: string[] = await this.getManySettingString(interaction, ...UtilsDataCivilizations.civilizationsTags.map((str: string): string => str+"_EMOJI"));
        let civLines: string[] = (await this.getManyText(interaction, UtilsDataCivilizations.civilizationsTags, civEmojis.map(str => [str])))
            .map(str => str.slice(str.indexOf("<")));
        let labels: string[] = await this.getManyText(interaction, [
            "RATING_CONFIRM_BUTTON", "RATING_CANCEL_BUTTON" 
        ]);
        let [isReportReactEmojis, isReportAllNotify] = await this.getManySettingNumber(interaction, "RATING_REPORT_MODERATION_EMOJIS", "RATING_REPORT_ALL_PM_NOTIFY");
        let description: string = (isReportReactEmojis) ? await this.getOneText(interaction, "RATING_REPORT_CHECK_EMOJI_VOTE_DESCRIPTION") : "";
        let descriptionHeadersFlags: boolean[] = [false, true, true, true];
        let reportMessage: Message;
        try {
            reportMessage = await channel.send({
                embeds: this.ratingUI.reportBrightEmbed(
                    interaction.user, false,                        // Это сообщение может появиться только
                    usersRating, ratingNotes,                       // из-за игрока (без прав), поэтому:
                    title, description,                             // isModerator = false,
                    descriptionHeaders, descriptionHeadersFlags,    // moderatorPrefix = ""
                    victoryLines, civLines, 
                    ""
                ), components: this.ratingUI.reportModeratorButtons(interaction.user.id, pendingGameID, labels)
            });
        } catch {
            this.databaseServiceRatingNote.deleteAllByGameID(interaction.guild?.id as string, pendingGameID);
            let textLines: string[] = await this.getManyText(interaction, [
                "BASE_ERROR_TITLE", "RATING_ERROR_NO_REPORT_CHANNEL"
            ]);
            return interaction.message.edit({embeds: this.ratingUI.error(textLines[0], textLines[1])});
        }
        let textLines: string[] = await this.getManyText(interaction, [
            "BASE_NOTIFY_TITLE", "RATING_REPORT_SUCCESS_DESCRIPTION"
        ]);
        interaction.message.edit({embeds: this.ratingUI.notify(textLines[0], textLines[1])});
        
        if(isReportReactEmojis) 
            UtilsServiceEmojis.reactOrder(reportMessage, ["<:Yes:808418109710794843>", "<:No:808418109319938099>"]);
        if(isReportAllNotify) {
            let gameType: string = ratingNotes[0].gameType as string;
            let textLines: string[] = await this.getManyText(interaction, [
                "RATING_REPORT_MODERATION_PM_NOTIFY_TITLE", "RATING_REPORT_MODERATION_PM_NOTIFY_DESCRIPTION"
            ], [[gameType], [reportMessage.url]]);
            let embed: EmbedBuilder[] = this.ratingUI.reportPMEmbed(
                gameType, textLines[0], textLines[1], interaction.guild
            );
            usersID.filter(userID => userID !== interaction.user.id)
                .forEach(userID => UtilsServicePM.send(userID, embed));
        }     
    }

    // Тут производится удаление отчёта, который был подтверждён игроком.
    // Значит он не стоит в очереди processingMessagesData, и метод cleanProcessingData() не нужен.
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

        this.databaseServiceRatingNote.deleteAllByGameID(interaction.guild?.id as string, pendingGameID);
        await interaction.deferUpdate();
        RatingService.cleanProcessingData(interaction);
    }

    // Тут производится удаление отчёта, который был подтверждён игроком.
    // Значит он не стоит в очереди processingMessagesData, и метод cleanProcessingData не нужен.
    public async reportModeratorRejectModal(interaction: ModalSubmitInteraction) {
        if(!(await this.isModerator(interaction))) {
            let textLines: string[] = await this.getManyText(interaction, [
                "BASE_ERROR_TITLE", "RATING_ERROR_NO_PERMISSION"
            ]);
            return interaction.reply({embeds: this.ratingUI.error(textLines[0], textLines[1]), ephemeral: true});
        }

        await interaction.deferUpdate();
        let rejectDescription: string = Array.from(interaction.fields.fields.values())[0].value || "";
        let pendingGameID: number = Number(interaction.customId.split("-")[5]);
        let ratingNotes: EntityRatingNote[] = await this.databaseServiceRatingNote.getAllByGameID(interaction.guild?.id as string, pendingGameID);
        this.databaseServiceRatingNote.deleteAllByGameID(interaction.guild?.id as string, pendingGameID);
        await interaction.message?.delete();

        if(ratingNotes.length > 0) {
            let authorID: string = interaction.customId.split("-").pop() as string;
            let usersRating: EntityUserRating[] = await this.databaseServiceUserRating.getMany(interaction.guild?.id as string, ratingNotes.map(note => note.userID));
            let title: string = await this.getOneText(interaction, "RATING_REPORT_REJECT_TITLE");
            let description: string = await this.getOneText(interaction, 
                (rejectDescription.length > 0) ? "RATING_REPORT_REJECT_DESCRIPTION" : "RATING_REPORT_REJECT_NO_REASON_DESCRIPTION",
                interaction.user.username, rejectDescription
            );
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
            let civEmojis: string[] = await this.getManySettingString(interaction, ...UtilsDataCivilizations.civilizationsTags.map((str: string): string => str+"_EMOJI"));
            let civLines: string[] = (await this.getManyText(interaction, UtilsDataCivilizations.civilizationsTags, civEmojis.map(str => [str])))
                .map(str => str.slice(str.indexOf("<")));
            let descriptionHeadersFlags: boolean[] = [false, true, true, true];
            UtilsServicePM.send(authorID, this.ratingUI.reportDangerEmbed(
                interaction.guild as Guild, false,                  // Это сообщение может появиться только из-за модератора,
                usersRating, ratingNotes,                           // но присылается от лица сервера, поэтому:
                title, description,                                 // author = interaction.guild,
                descriptionHeaders, descriptionHeadersFlags,        // isModerator = false,
                victoryLines, civLines,                             // moderatorPrefix = ""
                ""
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

        await interaction.deferReply({ephemeral: true});
        await interaction.message.edit({components: []});       // Чтобы пользователь не нажал дважды
        await interaction.message.reactions.removeAll().catch();

        let pendingGameID: number = Number(interaction.customId.split("-")[4]);
        let ratingNotes: EntityRatingNote[] = await this.databaseServiceRatingNote.getAllByGameID(interaction.guild?.id as string, pendingGameID);
        if(
            (ratingNotes.length === 0) || 
            (ratingNotes[0].isActive) || 
            (!ratingNotes[0].isPending)
        ) {
            let textLines: string[] = await this.getManyText(interaction, [
                "BASE_ERROR_TITLE", "RATING_ERROR_REPORT_NOT_FOUND"
            ]);
            return interaction.editReply({embeds: this.ratingUI.error(textLines[0], textLines[1])});
        }

        let usersID: string[] = ratingNotes.map(note => note.userID);
        let usersRating: EntityUserRating[] = await this.databaseServiceUserRating.getMany(interaction.guild?.id as string, usersID);
        let [isEloSystem, isLinearSystem] = await this.getManySettingNumber(interaction, "RATING_ELO_ENABLED", "RATING_LINEAR_ENABLED");
        if(isLinearSystem && (ratingNotes[0].gameType === "Teamers")) {
            let [linearB, linearK, linearMaxPoints, linearMinPoints] = await this.getManySettingNumber(interaction, "RATING_LINEAR_B", "RATING_LINEAR_K", "RATING_LINEAR_MAX", "RATING_LINEAR_MIN");
            this.calculateRatingNotesLinear(ratingNotes, usersRating, linearB, linearK, linearMaxPoints, linearMinPoints);
        } else {
            let [eloK, eloD, victoryMultiplierPercent] = await this.getManySettingNumber(interaction, "RATING_ELO_K", "RATING_ELO_D", "RATING_VICTORY_MULTIPLIER_PERCENT");
            this.calculateRatingNotesElo(ratingNotes, usersRating, eloK, eloD, victoryMultiplierPercent);
        }

        this.applyRating(usersRating, ratingNotes);
        ratingNotes.forEach(ratingNote => {
            ratingNote.isActive = true;             // Изменение статуста раннее
            ratingNote.isPending = false;           // сохранённого в БД отчёта.
        });
        this.databaseServiceRatingNote.insertOrUpdateAll(ratingNotes);
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
        let civEmojis: string[] = await this.getManySettingString(interaction, ...UtilsDataCivilizations.civilizationsTags.map((str: string): string => str+"_EMOJI"));
        let civLines: string[] = (await this.getManyText(interaction, UtilsDataCivilizations.civilizationsTags, civEmojis.map(str => [str])))
            .map(str => str.slice(str.indexOf("<")));
        let moderatorPrefix: string = await this.getOneText(interaction, "RATING_MODERATOR_PREFIX_BOTTOM");
        let descriptionHeadersFlags: boolean[] = [true, true, ratingNotes.some(ratingNote => ratingNote.isHost), true];
        let embed: EmbedBuilder[] = this.ratingUI.reportBrightEmbed(
            interaction.user, true,
            usersRating, ratingNotes,
            title, "",
            descriptionHeaders, descriptionHeadersFlags,
            victoryLines, civLines,
            moderatorPrefix
        );
        let botReportChannelID: string = await this.getOneSettingString(interaction, "RATING_BOT_REPORTS_CHANNEL_ID");
        let channel: TextChannel|null = (await interaction.guild?.channels.fetch(botReportChannelID)) as TextChannel|null;

        let pmTitle: string = await this.getOneText(interaction, "RATING_REPORT_ACCEPT_TITLE", ratingNotes[0].gameType);
        let pmModeratorDescription: string = await this.getOneText(interaction, "RATING_REPORT_ACCEPT_MODERATOR_DESCRIPTION");

        let reportMessage: Message|undefined;
        try {
            if(!channel)
                throw "ChannelIsNull";
            reportMessage = await channel.send({embeds: embed});
        } catch {
            reportMessage = undefined;
        }
        if(!reportMessage) {
            reportMessage = interaction.message;
            interaction.message.edit({embeds: embed}).catch();
        }
        await interaction.editReply({embeds: this.ratingUI.notify(pmTitle, pmModeratorDescription + "\n\n" + reportMessage.url)});

        let pmDescription: string = await this.getOneText(interaction, "RATING_REPORT_ACCEPT_DESCRIPTION", interaction.user.username, reportMessage.url);
        let pmEmbed: EmbedBuilder[] = this.ratingUI.reportPMEmbed(ratingNotes[0].gameType, pmTitle, pmDescription, interaction.guild);
        let [isAuthorNotify, isAllNotify] = await this.getManySettingNumber(interaction, "RATING_ACCEPT_AUTHOR_PM_NOTIFY", "RATING_ACCEPT_ALL_PM_NOTIFY");
        let authorID: string = interaction.customId.split("-")[5];
        usersID.filter(userID => (userID !== interaction.user.id) && (isAllNotify || (isAuthorNotify && (userID === authorID))))
            .forEach(userID => UtilsServicePM.send(userID, pmEmbed));
        this.ratingAdapter.callLeaderboardStaticUpdate(interaction.guild?.id as string, ratingNotes[0].gameType);
    }



    public async cancel(interaction: CommandInteraction, gameID: number) {
        if(!(await this.isModerator(interaction))) {
            let textLines: string[] = await this.getManyText(interaction, [
                "BASE_ERROR_TITLE", "RATING_ERROR_NO_PERMISSION"
            ]);
            return interaction.reply({embeds: this.ratingUI.error(textLines[0], textLines[1]), ephemeral: true});
        }
        let ratingNotes: EntityRatingNote[] = await this.databaseServiceRatingNote.getAllByGameID(interaction.guild?.id as string, gameID);
        if((ratingNotes.length === 0) || (ratingNotes[0].isPending)) {
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
        this.databaseServiceRatingNote.insertOrUpdateAll(ratingNotes);
        this.databaseServiceUserRating.update(usersRating);
        this.setRatingRole(
            interaction.guild?.id as string, 
            usersRating.map(userRating => userRating.userID), 
            usersRating.map(userRating => userRating.rating)
        );

        let title: string = await this.getOneText(interaction, "RATING_CANCEL_TITLE");
        let descriptionHeaders: string[] = await this.getManyText(interaction, [
            "RATING_DESCRIPTION_ID_HEADER", "RATING_DESCRIPTION_GAME_TYPE_HEADER",
            "RATING_DESCRIPTION_HOST_HEADER", "RATING_DESCRIPTION_VICTORY_TYPE_HEADER"
        ]);
        let moderatorPrefix: string = await this.getOneText(interaction, "RATING_MODERATOR_PREFIX_BOTTOM");
        let descriptionHeadersFlags: boolean[] = [true, true, false, false];
        let embed: EmbedBuilder[] = this.ratingUI.reportDarkShortEmbed(
            interaction.user,
            usersRating, ratingNotes,
            title, "",
            descriptionHeaders, descriptionHeadersFlags,
            moderatorPrefix
        );
        interaction.reply({embeds: embed});

        let channelID: string = await this.getOneSettingString(interaction, "RATING_BOT_REPORTS_CHANNEL_ID");
        if(channelID !== "") {
            let channel: TextChannel|null = (await interaction.guild?.channels.fetch(channelID)) as (TextChannel|null);
            channel?.send?.({embeds: embed})?.catch();
        }
        this.ratingAdapter.callLeaderboardStaticUpdate(interaction.guild?.id as string, ratingNotes[0].gameType);
    }

    public async revert(interaction: CommandInteraction, gameID: number) {
        if(!(await this.isModerator(interaction))) {
            let textLines: string[] = await this.getManyText(interaction, [
                "BASE_ERROR_TITLE", "RATING_ERROR_NO_PERMISSION"
            ]);
            return interaction.reply({embeds: this.ratingUI.error(textLines[0], textLines[1]), ephemeral: true});
        }
        let ratingNotes: EntityRatingNote[] = await this.databaseServiceRatingNote.getAllByGameID(interaction.guild?.id as string, gameID);
        if((ratingNotes.length === 0) || (ratingNotes[0].isPending)) {
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
        this.databaseServiceRatingNote.insertOrUpdateAll(ratingNotes);
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
        let civEmojis: string[] = await this.getManySettingString(interaction, ...UtilsDataCivilizations.civilizationsTags.map((str: string): string => str+"_EMOJI"));
        let civLines: string[] = (await this.getManyText(interaction, UtilsDataCivilizations.civilizationsTags, civEmojis.map(str => [str])))
            .map(str => str.slice(str.indexOf("<")));
        let moderatorPrefix: string = await this.getOneText(interaction, "RATING_MODERATOR_PREFIX_BOTTOM");
        let descriptionHeadersFlags: boolean[] = [true, true, ratingNotes.some(ratingNote => ratingNote.isHost), true];
        let embed: EmbedBuilder[] = this.ratingUI.reportBrightEmbed(
            interaction.user, true,
            usersRating, ratingNotes,
            title, "",
            descriptionHeaders, descriptionHeadersFlags,
            victoryLines, civLines,
            moderatorPrefix
        );
        interaction.reply({embeds: embed});

        let channelID: string = await this.getOneSettingString(interaction, "RATING_BOT_REPORTS_CHANNEL_ID");
        if(channelID !== "") {
            let channel: TextChannel|null = (await interaction.guild?.channels.fetch(channelID)) as (TextChannel|null);
            channel?.send?.({embeds: embed})?.catch();
        }
        this.ratingAdapter.callLeaderboardStaticUpdate(interaction.guild?.id as string, ratingNotes[0].gameType);
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
            ((type === "Total") && (userRating.rating === amount)) 
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
            ((type === "Total") && (userRating.rating+amount < 0))
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
        if(type !== "Total")
            this.ratingAdapter.callLeaderboardStaticUpdate(interaction.guild?.id as string, type);
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
        interaction.message.delete().catch();
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
        this.ratingAdapter.callLeaderboardStaticUpdate(interaction.guild?.id as string, "FFA");
        this.ratingAdapter.callLeaderboardStaticUpdate(interaction.guild?.id as string, "Teamers");
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
            components: this.ratingUI.resetAllButtons(interaction.user.id, labels)
        });
    }

    public async resetAllCancelButton(interaction: ButtonInteraction) {
        interaction.deferUpdate();
        if(!this.isOwner(interaction))
            return;
        interaction.message.delete().catch();
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
        this.ratingAdapter.callLeaderboardStaticUpdate(interaction.guild?.id as string, "FFA");
        this.ratingAdapter.callLeaderboardStaticUpdate(interaction.guild?.id as string, "Teamers");
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
        interaction.message.delete().catch();
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
        this.databaseServiceRatingNote.deleteAllByUserID(interaction.guild?.id as string, userID);
        this.setRatingRole(interaction.guild?.id as string, userID, -1);

        let textLines: string[] = await this.getManyText(interaction, [
            "BASE_NOTIFY_TITLE", "RATING_WIPE_USER_NOTIFICATION_DESCRIPTION"
        ], [null, [userID]]);
        await interaction.reply({embeds: this.ratingUI.notify(textLines[0], textLines[1]), ephemeral: true});
        await interaction.message.delete();
        this.ratingAdapter.callLeaderboardStaticUpdate(interaction.guild?.id as string, "FFA");
        this.ratingAdapter.callLeaderboardStaticUpdate(interaction.guild?.id as string, "Teamers");
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
        interaction.message.delete().catch();
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

        this.databaseServiceRatingNote.deleteAllByGuildID(interaction.guild?.id as string);
        let usersRating: EntityUserRating[] = await this.databaseServiceUserRating.deleteAll(interaction.guild?.id as string);
        this.setRatingRole(interaction.guild?.id as string, usersRating.map(userRating => userRating.userID), new Array<number>(usersRating.length).fill(-1));    // Убрать роли

        let textLines: string[] = await this.getManyText(interaction, [
            "BASE_NOTIFY_TITLE", "RATING_WIPE_ALL_NOTIFICATION_DESCRIPTION"
        ], [null, [usersRating.length]]);
        await interaction.reply({embeds: this.ratingUI.notify(textLines[0], textLines[1]), ephemeral: true});
        await interaction.message.delete();
        this.ratingAdapter.callLeaderboardStaticUpdate(interaction.guild?.id as string, "FFA");
        this.ratingAdapter.callLeaderboardStaticUpdate(interaction.guild?.id as string, "Teamers");
    }
}
