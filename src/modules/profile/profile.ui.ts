import { ActionRowBuilder, APIEmbedField, ButtonBuilder, ButtonStyle, EmbedBuilder, User } from "discord.js";
import { EntityRatingNote } from "../../database/entities/entity.RatingNote";
import { EntityUserRating } from "../../database/entities/entity.UserRating";
import { UtilsGeneratorButton } from "../../utils/generators/utils.generator.button";
import { UtilsGeneratorEmbed } from "../../utils/generators/utils.generator.embed";
import { UtilsGeneratorTimestamp } from "../../utils/generators/utils.generator.timestamp";
import { ModuleBaseUI } from "../base/base.ui";
import { BestCivsEntity } from "./profile.models";

export class ProfileUI extends ModuleBaseUI {
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
            ratingNotes.map((ratingNote: EntityRatingNote): string => `<t:${Math.round(ratingNote.date.getTime()/1000)}:d>, ${ratingNote.gameType}`).join("\n"),
            ratingNotes.map((ratingNote: EntityRatingNote): string => {
                if(ratingNote.isSubOut)
                    return otherLines[3];
                let result: string = "";
                if(ratingNote.place === 1) {
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
                    if(ratingNote.gameType === "FFA")
                        result += "— ";
                }
                result += " ";
                if(ratingNote.gameType === "Teamers") {
                    if(ratingNote.place === 1)
                        result += otherLines[2];
                    else 
                        result += otherLines[1];
                } else if(ratingNote.gameType === "FFA") {
                    result += `\`${ratingNote.place}/${ratingNote.placeTotal}\``;
                }
                return result;
            }).join("\n"),
            ratingNotes.map(
                (ratingNote: EntityRatingNote): string => (ratingNote.civilizationID !== null) 
                    ? civLines[ratingNote.civilizationID] 
                    : "—"
            ).join("\n")
        ];
        return UtilsGeneratorEmbed.getSingle(
            title,
            "#999999",
            (ratingNotes.length === 0) ? otherLines[0] : "",
            fieldTitles.map((title: string, index: number) => { return {name: title, value: values[index]}; }),
            author.tag,
            author.avatarURL()
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

    public bestCivsEmbed(
        author: User,
        bestCivsEntites: BestCivsEntity[],
        title: string,
        emptyDescription: string,
        fieldTitles: string[],
        civLines: string[]
    ): EmbedBuilder[] {
        let values: string[] = [
            bestCivsEntites.map((bestCivsEntity) => {
                let civLine: string = civLines[bestCivsEntity.id];
                return civLine.slice(civLine.indexOf("<"));
            }).join("\n"),
            bestCivsEntites.map((bestCivsEntity) => `${bestCivsEntity.victories} / ${bestCivsEntity.defeats}`)
                .join("\n"),
            bestCivsEntites.map((bestCivsEntity) => `${bestCivsEntity.winrate} %`)
                .join("\n")
        ];

        return UtilsGeneratorEmbed.getSingle(
            title,
            "#ffe97d",
            (bestCivsEntites.length !== 0) ? "" : emptyDescription,
            (bestCivsEntites.length !== 0)
                ? fieldTitles.map((fieldTitle: string, index: number) => { return {name: fieldTitle, value: values[index]}; })
                : [],
            author.tag,
            author.avatarURL()
        );
    }

    public bestCivsButtons(
        label: string,       // delete, profile
        authorID: string,
        userID: string,
        type: string,
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

        let labels: string[] = new Array(4).fill("").concat(label).filter(filterFunction);
        let styles = [
            ButtonStyle.Secondary, ButtonStyle.Secondary,
            ButtonStyle.Secondary, ButtonStyle.Secondary,
            ButtonStyle.Danger
        ].filter(filterFunction);
        let emojis = ["⏮", "◀", "▶", "⏭", "✖️"].filter(filterFunction);
        let customIDArray: string[] = [
            `bestcivs-${type}-${authorID}-${userID}-99`,
            `bestcivs-${type}-${authorID}-${userID}-${pageCurrent-1}`,
            `bestcivs-${type}-${authorID}-${userID}-${pageCurrent+1}`,
            `bestcivs-${type}-${authorID}-${userID}-100`,
            `bestcivs-delete-${authorID}`
        ].filter(filterFunction);
        let isDisabledArray: boolean[] = [
            pageCurrent === 1,
            pageCurrent === 1,
            pageCurrent === pageTotal,
            pageCurrent === pageTotal,
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
}
