import { ActionRowBuilder, APIEmbedField, ButtonBuilder, ButtonStyle, ColorResolvable, EmbedBuilder, User } from "discord.js";
import { EntityRatingNote } from "../../database/entities/entity.RatingNote";
import { EntityUserRating } from "../../database/entities/entity.UserRating";
import { UtilsGeneratorButton } from "../../utils/generators/utils.generator.button";
import { UtilsGeneratorEmbed } from "../../utils/generators/utils.generator.embed";
import { UtilsGeneratorTimestamp } from "../../utils/generators/utils.generator.timestamp";
import { ModuleBaseUI } from "../base/base.ui";
import { BestCivsEntity } from "./profile.models";

export class ProfileUI extends ModuleBaseUI {
    private lineURL: string = "https://cdn.discordapp.com/attachments/795265098159357953/1070652459564945500/line.png";
    
    public profileEmbed(
        user: User,
        author: User,
        entityUserRating: EntityUserRating,
        title: string,
        fieldsHeaders: string[],

        generalLines: string[],
        ffaLines: string[],
        teamersLines: string[],
    ): EmbedBuilder[] {
        let emptyField: APIEmbedField = {name: "⠀", value: "⠀"};
        let generalDescription: string =  `${generalLines[0]}: ${entityUserRating.rating}\n` +
        `🖥️ ${generalLines[1]}: ${entityUserRating.host}\n` +
        `🔄 ${generalLines[2]}: ${entityUserRating.subIn}/${entityUserRating.subOut}\n` +
        `💨 ${generalLines[3]}: ${entityUserRating.leave}\n` +
        `🗓️ ${generalLines[4]}: ${entityUserRating.lastGame ? UtilsGeneratorTimestamp.getFormattedDate(entityUserRating.lastGame) : "—"}\n⠀`;

        let description: string[] = [
            `${ffaLines[0]}: ${entityUserRating.ffaRating}\n` +
            `${ffaLines[1]}: ${entityUserRating.ffaTotal}\n` +
            `${ffaLines[2]}: ${entityUserRating.ffaWin}/${entityUserRating.ffaLose}\n` +
            `${ffaLines[3]}: ${entityUserRating.ffaFirst}`,

            `<:Science_Victory:1051205348574375946> / <:Culture_Victory:1051205338172502077>⠀⠀⠀${entityUserRating.ffaVictoryScience} / ${entityUserRating.ffaVictoryCulture}\n` +
            `<:Domination_Victory:1051205343444729906> / <:Religious_Victory:1051205346179420260>⠀⠀⠀${entityUserRating.ffaVictoryDomination} / ${entityUserRating.ffaVictoryReligious}\n` +
            `<:Diplomatic_Victory:1051205340861038702> / <:Victory_FFA_CC:1051205350692491356>⠀⠀⠀${entityUserRating.ffaVictoryDiplomatic} / ${entityUserRating.ffaVictoryCC}`,

            `${teamersLines[0]}: ${entityUserRating.teamersRating}\n` +
            `${teamersLines[1]}: ${entityUserRating.teamersTotal}\n` +
            `${teamersLines[2]}: ${entityUserRating.teamersWin}/${entityUserRating.teamersLose}`,

            `<:Science_Victory:1051205348574375946> / <:Culture_Victory:1051205338172502077>⠀⠀⠀${entityUserRating.teamersVictoryScience} / ${entityUserRating.teamersVictoryCulture}\n` +
            `<:Domination_Victory:1051205343444729906> / <:Religious_Victory:1051205346179420260>⠀⠀⠀${entityUserRating.teamersVictoryDomination} / ${entityUserRating.teamersVictoryReligious}\n` +
            `<:Diplomatic_Victory:1051205340861038702> / <:Victory_Teamers_GG:1051205352558972999>⠀⠀⠀${entityUserRating.teamersVictoryDiplomatic} / ${entityUserRating.teamersVictoryGG}`
        ];

        let fields: APIEmbedField[] = fieldsHeaders.map((header: string, index: number) => { return {name: header, value: description[index]}; });
        fields = fields.slice(0, 1).concat(emptyField, ...fields.slice(1, 3), emptyField, ...fields.slice(3, 4));
        if(entityUserRating.ffaFirst === 0)
            fields[2] = emptyField;
        if(entityUserRating.ffaTotal === 0)
            fields.splice(0, 3);
        if(entityUserRating.teamersWin === 0)
            fields[fields.length-1] = emptyField;
        if(entityUserRating.teamersTotal === 0)
            fields.splice(fields.length-3, 3);

        return UtilsGeneratorEmbed.getSingle(
            title,
            "#004080",
            generalDescription,
            fields,
            author.tag,
            author.avatarURL(),
            user.avatarURL()
        );
    }

    public profileButtons(
        labels: string[],    // history, delete
        authorID: string,
        userID: string
    ): ActionRowBuilder<ButtonBuilder>[] {
        return UtilsGeneratorButton.getList(
            labels,
            ["📜", "✖️"],
            [ButtonStyle.Secondary, ButtonStyle.Danger],
            [`profile-showHistory-${authorID}-${userID}`, `profile-delete-${authorID}`]
        );
    }

    public historyEmbed(
        author: User,
        ratingNotes: EntityRatingNote[],
        title: string,
        fieldTitles: string[],
        otherLines: string[],
        civLines: string[]
    ): EmbedBuilder[] {
        let values: string[] = [
            ratingNotes.map((ratingNote: EntityRatingNote): string => `<t:${Math.round(ratingNote.date.getTime()/1000)}:D>, ${ratingNote.gameType}`).join("\n"),
            ratingNotes.map((ratingNote: EntityRatingNote): string => {
                if(ratingNote.isSubOut)
                    return otherLines[3];
                let result: string = "";
                if(ratingNote.place === 1) {
                    // Этот кусок кода необходим из-за найденного бага в
                    // отправленных отчётах (в БД может стоять null даже на 1 месте)
                    if((ratingNote.gameType === "FFA") && (ratingNote.victoryType === null))
                        ratingNote.victoryType = "CC";
                    else if((ratingNote.gameType === "Teamers") && (ratingNote.victoryType === null))
                        ratingNote.victoryType = "GG";
                    // Конец странного кода
                    switch(ratingNote.victoryType) {
                        case "Science":
                            result += "<:Science_Victory:1051205348574375946>"; break;
                        case "Culture":
                            result += "<:Culture_Victory:1051205338172502077>"; break;
                        case "Domination":
                            result += "<:Domination_Victory:1051205343444729906>"; break;
                        case "Religious":
                            result += "<:Religious_Victory:1051205346179420260>"; break;
                        case "Diplomatic":
                            result += "<:Diplomatic_Victory:1051205340861038702>"; break;
                        case "GG":
                            result += "<:Victory_Teamers_GG:1051205352558972999>"; break;
                        case "CC":
                            result += "<:Victory_FFA_CC:1051205350692491356>"; break;
                    }
                    result += " ";
                }
                if(ratingNote.gameType === "FFA") 
                    result += `${ratingNote.place}/${ratingNote.placeTotal}`;
                else if(ratingNote.gameType === "Teamers") 
                    result += (ratingNote.place === 1) ? otherLines[2] : otherLines[1];
                if((ratingNote.place !== 1) && (ratingNote.gameType === "FFA"))
                    result += "<:EmptySpace:1057693249776660552>";
                return result;
            }).join("\n"),
            ratingNotes.map(
                (ratingNote: EntityRatingNote): string => (ratingNote.civilizationID !== null) 
                    ? civLines[ratingNote.civilizationID]?.replaceAll(/\([\wА-Яа-я ]+\)/g, "")?.trim()
                    : "—"
            ).join("\n")
        ];
        return UtilsGeneratorEmbed.getSingle(
            title,
            "#999999",
            (ratingNotes.length === 0) ? otherLines[0] : "",
            fieldTitles.map((title: string, index: number) => { return {name: title, value: values[index]}; }),
            author.tag,
            author.avatarURL(),
            "",
            this.lineURL
        );
    }

    public historyButtons(
        labels: string[],       // delete, profile
        authorID: string,
        userID: string,
        pageCurrent: number,
        pageTotal: number
    ): ActionRowBuilder<ButtonBuilder>[] {
        let indexes: number[];
        if(pageTotal <= 1)
            indexes = [4, 5];
        else if(pageTotal === 2)
            indexes = [1, 2, 4, 5];
        else
            indexes = [0, 1, 2, 3, 4, 5];
        let filterFunction = (value: any, index: number): boolean => (indexes.indexOf(index) !== -1);

        labels = new Array(4).fill("").concat(labels).filter(filterFunction);
        let styles = [
            ButtonStyle.Secondary, ButtonStyle.Secondary,
            ButtonStyle.Secondary, ButtonStyle.Secondary,
            ButtonStyle.Secondary, ButtonStyle.Danger
        ].filter(filterFunction);
        let emojis = ["⏮", "◀", "▶", "⏭", "👤", "✖️"].filter(filterFunction);
        let customIDArray: string[] = [
            `history-${userID}-${authorID}-99`,
            `history-${userID}-${authorID}-${pageCurrent-1}`,
            `history-${userID}-${authorID}-${pageCurrent+1}`,
            `history-${userID}-${authorID}-100`,
            `history-showProfile-${authorID}-${userID}`,
            `history-delete-${authorID}`
        ].filter(filterFunction);
        let isDisabledArray: boolean[] = [
            pageCurrent === 1,
            pageCurrent === 1,
            pageCurrent === pageTotal,
            pageCurrent === pageTotal,
            false,
            false
        ].filter(filterFunction);

        return UtilsGeneratorButton.getList(
            labels,
            emojis,
            styles,
            customIDArray,
            isDisabledArray
        );
    }

    public lobbyRatingEmbed(
        author: User,
        userRatings: EntityUserRating[],
        eloK: number,
        title: string,
        fieldTitles: string[],
        fieldValues: string[]
    ): EmbedBuilder[] {
        const dMax: number = 4;                 // Середина
        const minColorBright: number = 102;     // #66 HEX

        let ratingPoints: number[] = userRatings.map(userRating => userRating.rating);
        let averageRating: number = ratingPoints.reduce((a, b) => a+b, 0)/ratingPoints.length;
        let avgSquareDeviation: number = Math.sqrt(      // Среднеквадратичное отклонение
            ratingPoints.map(ratingPoint => Math.pow(ratingPoint-averageRating, 2)).reduce((a, b) => a+b, 0)/ratingPoints.length
        );
        let d: number = Math.min(2*dMax, avgSquareDeviation/eloK);
        
        let color: ColorResolvable;
        if(d <= dMax) {
            color = `#${
                // Красный
                "0".concat(Math.round(
                    minColorBright*d/dMax
                ).toString(16)).slice(-2)
            }00${
                // Синий
                "0".concat(Math.round(
                    255 - (255-minColorBright)*(d/dMax)
                ).toString(16)).slice(-2)
            }`;
        } else {
            d -= dMax;
            color = `#${
                // Красный
                "0".concat(Math.round(
                    minColorBright + (255-minColorBright)*d/dMax
                ).toString(16)).slice(-2)
            }00${
                // Синий
                "0".concat(Math.round(
                    minColorBright*(1 - d/dMax)
                ).toString(16)).slice(-2)
            }`
        }
        let values: string[] = [
            userRatings.map(userRating => `<@${userRating.userID}>\n\n\n`).join("\n").trim(),
            userRatings.map(userRating => `${fieldValues[0]}: ${userRating.rating}\n— ${fieldValues[1]}: ${userRating.ffaRating}\n— ${fieldValues[2]}: ${userRating.teamersRating}\n`).join("\n")
        ];
        return UtilsGeneratorEmbed.getSingle(
            title,
            color,
            "",
            fieldTitles.map((fieldTitle: string, index: number) => {return {name: fieldTitle, value: values[index]}}),
            author.tag,
            author.avatarURL()
        );
    }

    public bestCivsEmbed(
        author: User,
        gameType: string,
        bestCivsEntites: BestCivsEntity[],
        title: string,
        emptyDescription: string,
        fieldTitles: string[],
        civLines: string[]
    ): EmbedBuilder[] {
        (gameType === "FFA") ? fieldTitles.splice(2, 1) : fieldTitles.splice(3, 1);
        let values: string[] = [
            bestCivsEntites.map((bestCivsEntity) => {
                let civLine: string = civLines[bestCivsEntity.id];
                return civLine.slice(civLine.indexOf("<")).replaceAll(/\([\wА-Яа-я ]+\)/g, "")?.trim();     // Из-за удаления части перед эмодзи
            }).join("\n"),
            bestCivsEntites.map((bestCivsEntity) => `${bestCivsEntity.victories} / ${bestCivsEntity.defeats}<:EmptySpace:1057693249776660552>`)
                .join("\n"),
            (gameType === "FFA")
                ? bestCivsEntites.map((bestCivsEntity) => `${bestCivsEntity.averagePlace.toLocaleString(
                    undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                )}<:EmptySpace:1057693249776660552>`).join("\n")
                : bestCivsEntites.map((bestCivsEntity) => `${bestCivsEntity.winrate} %<:EmptySpace:1057693249776660552>`).join("\n")
        ];

        return UtilsGeneratorEmbed.getSingle(
            title,
            "#ffe97d",
            (bestCivsEntites.length !== 0) ? "" : emptyDescription,
            (bestCivsEntites.length !== 0)
                ? fieldTitles.map((fieldTitle: string, index: number) => { return {name: fieldTitle, value: values[index]}; })
                : [],
            author.tag,
            author.avatarURL(),
            "",
            this.lineURL
        );
    }

    //player, server, global
    public bestCivsButtons(
        labels: string[],
        authorID: string,
        userID: string,
        listType: string,
        gameType: string,
        pageCurrent: number,
        pageTotal: number
    ): ActionRowBuilder<ButtonBuilder>[] {
        let indexes: number[];
        if(pageTotal <= 1)
            indexes = [4];
        else if(pageTotal === 2)
            indexes = [1, 2, 4];
        else
            indexes = [0, 1, 2, 3, 4];
        let filterFunction = (value: any, index: number): boolean => (indexes.indexOf(index) !== -1);

        let upperLabels: string[] = new Array(4).fill("").concat(labels[0]).filter(filterFunction);
        let upperStyles: ButtonStyle[] = [
            ButtonStyle.Secondary, ButtonStyle.Secondary,
            ButtonStyle.Secondary, ButtonStyle.Secondary,
            ButtonStyle.Danger
        ].filter(filterFunction);
        let upperEmojis = ["⏮", "◀", "▶", "⏭", "✖️"].filter(filterFunction);
        let upperCustomIDArray: string[] = [
            `bestcivs-${listType}-${authorID}-${gameType}-${userID}-99`,
            `bestcivs-${listType}-${authorID}-${gameType}-${userID}-${pageCurrent-1}`,
            `bestcivs-${listType}-${authorID}-${gameType}-${userID}-${pageCurrent+1}`,
            `bestcivs-${listType}-${authorID}-${gameType}-${userID}-100`,
            `bestcivs-delete-${authorID}`
        ].filter(filterFunction);
        let upperIsDisabledArray: boolean[] = [
            pageCurrent === 1,
            pageCurrent === 1,
            pageCurrent === pageTotal,
            pageCurrent === pageTotal,
            false
        ].filter(filterFunction);
        let upperButtons =  UtilsGeneratorButton.getList(
            upperLabels,
            upperEmojis,
            upperStyles,
            upperCustomIDArray,
            upperIsDisabledArray
        );
        
        indexes = (listType === "Player") ? [2, 3, 4] : [0, 1, 2, 3, 4];
        let lowerLabels: string[] = labels.slice(1).filter(filterFunction);
        let lowerEmojis: string[] = ["🏆", "🌍", "🗿", "🐲", ""].filter(filterFunction);
        let lowerStyles: ButtonStyle[] = [
            ButtonStyle.Secondary, ButtonStyle.Secondary,
            ButtonStyle.Primary, ButtonStyle.Success,
            ButtonStyle.Secondary
        ].filter(filterFunction);
        let lowerIsDisabledArray: boolean[] = [
            listType === "Server",
            listType === "Global",
            gameType === "FFA",
            gameType === "Teamers",
            gameType === "Total"
        ].filter(filterFunction);
        let lowerCustomIDArray: string[] = [
            `bestcivs-Server-${authorID}-${gameType}-${userID}-1`,
            `bestcivs-Global-${authorID}-${gameType}-${userID}-1`,
            `bestcivs-${listType}-${authorID}-FFA-${userID}-1`,
            `bestcivs-${listType}-${authorID}-Teamers-${userID}-1`,
            `bestcivs-${listType}-${authorID}-Total-${userID}-1`
        ].filter(filterFunction).map((str, index) => lowerIsDisabledArray[index] ? String(index) : str);
        // Чтобы убрать дубликаты, нужно использовать map; на неактивные кнопки всё равно нельзя нажать.

        return upperButtons.concat(UtilsGeneratorButton.getList(
            lowerLabels,
            lowerEmojis,
            lowerStyles,
            lowerCustomIDArray,
            lowerIsDisabledArray
        ));
    }
}
