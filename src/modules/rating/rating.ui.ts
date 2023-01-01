import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputStyle, User } from "discord.js";
import { EntityRatingNote } from "../../database/entities/entity.RatingNote";
import { EntityUserRating } from "../../database/entities/entity.UserRating";
import { UtilsGeneratorButton } from "../../utils/generators/utils.generator.button";
import { UtilsGeneratorEmbed } from "../../utils/generators/utils.generator.embed";
import { UtilsGeneratorModal } from "../../utils/generators/utils.generator.modal";
import { ModuleBaseUI } from "../base/base.ui";

export class RatingUI extends ModuleBaseUI {
    public report(
        author: User,
        isModerator: boolean,

        usersRating: EntityUserRating[],
        ratingNotes: EntityRatingNote[],
        tieIndexes: number[][],

        title: string,
        descriptionHeaders: string[],       // 4 // ID, type, victoryName, host
        victoryLines: string[],
        civLines: string[],
        moderatorPrefix: string
    ): EmbedBuilder[] {          
        let thumbnailVictoryImages: string[] = [
            "https://media.discordapp.net/attachments/795265098159357953/1051199855172792372/Science_Victory.png",
            "https://media.discordapp.net/attachments/795265098159357953/1051199855550275584/Culture_Victory.png",
            "https://cdn.discordapp.com/attachments/795265098159357953/1051199855852269698/Domination_Victory.png",
            "https://media.discordapp.net/attachments/795265098159357953/1051199857899077743/Religious_Victory.png",
            "https://media.discordapp.net/attachments/795265098159357953/1051199858226241687/Diplomatic_Victory.png"
        ];
        let thumbnailImageURL: string = "";

        let description: string = `${descriptionHeaders[0]}: **__${ratingNotes[0].gameID}__**\n${descriptionHeaders[1]}: ${ratingNotes[0].gameType}\n`;
        let victoryIndex: number;
        switch(ratingNotes[0].victoryType) {
            case "Science":
                victoryIndex = 0; break;
            case "Culture":
                victoryIndex = 1; break;
            case "Domination":
                victoryIndex = 2; break;
            case "Religious":
                victoryIndex = 3; break;
            case "Diplomatic":
                victoryIndex = 4; break;
            default:
                victoryIndex = (ratingNotes[0].gameType === "FFA") ? 5 : 6;
        }
        description += `${descriptionHeaders[2]}: ${victoryLines[victoryIndex]}\n`;
        thumbnailImageURL = thumbnailVictoryImages[victoryIndex] || "";
        for(let i in ratingNotes)
            if(ratingNotes[i].isHost) {
                description += `${descriptionHeaders[3]}: <@${ratingNotes[i].userID}>\n`;
                break;
            }
        description += "\n";

        let placeLines: string[] = [];
        let ratingChangeLines: string[] = [];
        let ratingEmojiLines: string[] = [];
        let ratingTotalLines: string[] = [];
        let statusEmojiLines: string[] = [];
        let userLines: string[] = [];
        let userCivLines: string[] = [];
        let spacesString: string = "    ";

        ratingNotes.forEach((ratingNote: EntityRatingNote, index: number) => {
            let placeLine: string = ` ${index+1}:`;
            if(ratingNote.isSubOut)
                placeLine = " - ";
            else
                for(let i in tieIndexes) 
                    if(tieIndexes[i].some(tieIndex => tieIndex === index))
                        placeLine = `${tieIndexes[i][0]+1}..${tieIndexes[i][tieIndexes[i].length-1]+1}:`;
            placeLines.push(placeLine);
            ratingChangeLines.push(spacesString.concat(`${ratingNote.typedRating >= 0 ? "+" : ""}${ratingNote.typedRating}`).slice(-4));
            if(ratingNote.isSubIn)
                ratingEmojiLines.push("🔄");
            else if(ratingNote.typedRating >= 0)
                ratingEmojiLines.push("📈");
            else
                ratingEmojiLines.push("📉");
            ratingTotalLines.push(spacesString.concat(`(${ratingNote.gameType === "FFA" ? usersRating[index].ffaRating : usersRating[index].teamersRating})`).slice(-4));
            if(ratingNote.isHost)
                statusEmojiLines.push("🖥️");
            else if(ratingNote.isLeave)
                statusEmojiLines.push("💨");
            else
                statusEmojiLines.push("<:EmptySpace:1057693249776660552>");
            userLines.push(`<@${ratingNote.userID}>`);
            userCivLines.push(civLines[ratingNote.civilizationID || -1] || "");
        });
        let placeLineMaxLength: number = Math.max(...placeLines.map(str => str.length));
        placeLines.map(str => Array<string>(placeLineMaxLength-str.length).fill(" ").join("")+str);
        for(let i: number = 0; i < placeLines.length; i++) {
            if((i !== 0) && (ratingNotes[i].isSubOut) && (!ratingNotes[i-1].isSubOut))
                description += "\n";
            description += `\`${placeLines[i]}\`  \`${ratingChangeLines[i]}\` ${ratingEmojiLines[i]} \`${ratingTotalLines[i]}\` ${statusEmojiLines[i]} ${userLines} ${userCivLines}\n`;
        }
            
        return UtilsGeneratorEmbed.getSingle(
            title,
            (ratingNotes[0].gameType === "FFA") ? "#389FFF" : "#00FF40",
            description,
            [],
            `${isModerator ? moderatorPrefix + " " : ""}${author.tag}`,
            author.avatarURL(),
            thumbnailImageURL
        );
    }

    public rejectModal(
        pendingGameID: number,
        title: string,
        label: string
    ): ModalBuilder {
        return UtilsGeneratorModal.build(
            `rating-report-moderator-reject-modal-${pendingGameID}`,
            title,
            ["rating-report-moderator-reject-modal-description"],
            [label],
            [],
            [TextInputStyle.Short]
        );
    }

    public reportCancel(
        author: User,

        usersRating: EntityUserRating[],
        ratingNotes: EntityRatingNote[],

        title: string,
        descriptionHeaders: string[],       // 3 // ID, type, host
        moderatorPrefix: string
    ): EmbedBuilder[] {
        let description: string = `${descriptionHeaders[0]}: **__${ratingNotes[0].gameID}__** <:No:808418109319938099>\n${descriptionHeaders[1]}: ${ratingNotes[0].gameType}\n`;
        for(let i in ratingNotes)
                if(ratingNotes[i].isHost) {
                    description += `${descriptionHeaders[3]}: <@${ratingNotes[i].userID}>\n`;
                    break;
                }
        description += "\n";

        let spacesString: string = "    ";
        ratingNotes.forEach((ratingNote: EntityRatingNote, index: number) => {
            if((index !== 0) && (ratingNote.isSubOut) && (!ratingNotes[index-1].isSubOut))
                description += "\n";
            description += `\`${spacesString.concat(`${ratingNote.typedRating*-1 >= 0 ? "+" : ""}${ratingNote.typedRating*-1}`).slice(-4)}\`  \`${spacesString.concat(`(${ratingNote.gameType === "FFA" ? usersRating[index].ffaRating : usersRating[index].teamersRating})`).slice(-4)}\`  <@${ratingNote.userID}>`;
        });

        return UtilsGeneratorEmbed.getSingle(
            title,
            (ratingNotes[0].gameType === "FFA") ? "#1F578C" : "#008221",
            description,
            [],
            `${moderatorPrefix} ${author.tag}`,
            author.avatarURL(),
        );
    }

    public addUser(
        author: User,
        userRating: EntityUserRating,
        type: string,
        ratingChange: number,
        title: string,
        headers: string[],
        moderatorPrefix: string
    ): EmbedBuilder[] {
        return UtilsGeneratorEmbed.getSingle(
            title,
            "#00FFFF",
            "",
            [
                {name: headers[0], value: `<@${userRating.userID}>`},
                {name: headers[1], value: type},
                {name: headers[2], value: `${ratingChange >= 0 ? "+" : ""}${ratingChange} (${(type === "FFA" ? userRating.ffaRating : userRating.teamersRating)})`}
            ],
            `${moderatorPrefix} ${author.tag}`,
            author.avatarURL()
        );
    }

    public resetUserButtons(
        authorID: string,
        userID: string,
        labels: string[]
    ): ActionRowBuilder<ButtonBuilder>[] {
        return UtilsGeneratorButton.getList(
            labels,
            [],
            [ButtonStyle.Success, ButtonStyle.Danger],
            [`rating-reset-user-confirm-${userID}-${authorID}`, `rating-reset-user-cancel-${authorID}`]
        );
    }

    public resetAllButtons(
        authorID: string,
        labels: string[],
        emojis: string[]
    ): ActionRowBuilder<ButtonBuilder>[] {
        return UtilsGeneratorButton.getList(
            labels,
            emojis,
            [ButtonStyle.Success, ButtonStyle.Danger],
            [`rating-reset-all-confirm-${authorID}`, `rating-reset-all-cancel-${authorID}`]
        );
    }

    public wipeUserButtons(
        authorID: string,
        userID: string,
        labels: string[],
    ): ActionRowBuilder<ButtonBuilder>[] {
        return UtilsGeneratorButton.getList(
            labels,
            [],
            [ButtonStyle.Success, ButtonStyle.Danger],
            [`rating-wipe-user-confirm-${userID}-${authorID}`, `rating-wipe-user-cancel-${userID}-${authorID}`]
        );
    }

    public wipeAllButtons(
        authorID: string, 
        labels: string[],
    ): ActionRowBuilder<ButtonBuilder>[] {
        return UtilsGeneratorButton.getList(
            labels,
            [],
            [ButtonStyle.Success, ButtonStyle.Danger],
            [`rating-wipe-all-confirm-${authorID}`, `rating-wipe-all-cancel-${authorID}`]
        );
    }
}
