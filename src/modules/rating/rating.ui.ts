import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Guild, ModalBuilder, TextInputStyle, User } from "discord.js";
import { EntityPendingRatingNote } from "../../database/entities/entity.PendingRatingNote";
import { EntityRatingNote } from "../../database/entities/entity.RatingNote";
import { EntityUserRating } from "../../database/entities/entity.UserRating";
import { UtilsGeneratorButton } from "../../utils/generators/utils.generator.button";
import { UtilsGeneratorEmbed } from "../../utils/generators/utils.generator.embed";
import { UtilsGeneratorModal } from "../../utils/generators/utils.generator.modal";
import { ModuleBaseUI } from "../base/base.ui";

export class RatingUI extends ModuleBaseUI {
    private getFullDescriptionFromNotes(
        ratingNotes: (EntityRatingNote|EntityPendingRatingNote)[],
        usersRating: EntityUserRating[],

        descriptionHeaders: string[],
        victoryLine: string,
        civLines: string[],

        isRequiredGameID: boolean = true
    ): string {
        let description: string = (isRequiredGameID) ? `${descriptionHeaders[0]}: **__${ratingNotes[0].gameID}__**\n` : "";
        description += `${descriptionHeaders[1]}: ${ratingNotes[0].gameType}\n${descriptionHeaders[2]}: ${victoryLine}\n`;
        if(ratingNotes.filter(ratingNote => ratingNote.isHost).length > 0)
            description += `${descriptionHeaders[3]}: <@${ratingNotes.filter(ratingNote => ratingNote.isHost)[0].userID}>\n`;
        description += "\n";

        let placeLines: string[] = [];
        let ratingChangeLines: string[] = [];
        let ratingEmojiLines: string[] = [];
        let ratingTotalLines: string[] = [];
        let statusEmojiLines: string[] = [];
        let userLines: string[] = [];
        let userCivLines: string[] = [];
        let spacesString: string = "    ";

        let playersTotal: number = ratingNotes.filter(ratingNote => !ratingNote.isSubOut).length;
        let teamsTotal: number = ratingNotes[0].placeTotal;
        let playersPerTeam: number = (playersTotal/teamsTotal)%1 || 1;
        for(let i: number = 0; i < teamsTotal; i++) {
            let currentPlace: number = ratingNotes[i*playersPerTeam].place;
            let minBound: number = -1, maxBound: number = -1;
            for(let j: number = 0; j < playersTotal; j++)
                if(ratingNotes[j].place === currentPlace) 
                    (minBound === -1)
                        ? minBound = j
                        : maxBound = j;
            minBound = (minBound/playersPerTeam)%1 + 1;
            maxBound = (maxBound/playersPerTeam)%1 + 1;
            let placeLine: string = (minBound === maxBound)
                ? `${currentPlace}`
                : `${minBound}..${maxBound}`;
            for(let k: number = 0; k < playersPerTeam; k++) 
                placeLines.push(placeLine);
        }
        for(let i: number = playersTotal; i < ratingNotes.length; i++)
            placeLines.push(" - ");
        
        ratingNotes.forEach((ratingNote: EntityRatingNote|EntityPendingRatingNote, index: number) => {
            ratingChangeLines.push(spacesString.concat(`${ratingNote.typedRating >= 0 ? "+" : ""}${ratingNote.typedRating}`).slice(-4));
            if(ratingNote.isSubIn)
                ratingEmojiLines.push("🔄");
            else if(ratingNote.typedRating >= 0)
                ratingEmojiLines.push("📈");
            else
                ratingEmojiLines.push("📉");
            ratingTotalLines.push(spacesString.concat(`(${ratingNote.gameType === "FFA" ? (usersRating[index].ffaRating) : usersRating[index].teamersRating})`).slice(-4));
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
            if(
                ((i !== 0) && (ratingNotes[i].isSubOut) && (!ratingNotes[i-1].isSubOut)) ||
                ((teamsTotal !== playersTotal) && ((i+1)%playersPerTeam !== 0))
            )
                description += "\n";
            description += `\`${placeLines[i]}\`  \`${ratingChangeLines[i]}\` ${ratingEmojiLines[i]} \`${ratingTotalLines[i]}\` ${statusEmojiLines[i]} ${userLines} ${userCivLines}\n`;
        }
        return description;
    }

    private getCancelDescriptionFromNotes(
        ratingNotes: EntityRatingNote[],
        usersRating: EntityUserRating[],
        descriptionHeaders: string[],       // 3 // ID, type, host
    ): string {
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
        return description;
    }

    private getVictoryObjectLines(gameType: string|null, victoryType: string|null, victoryLines: string[]): string[] {
        let thumbnailVictoryImages: string[] = [
            "https://media.discordapp.net/attachments/795265098159357953/1051199855172792372/Science_Victory.png",
            "https://media.discordapp.net/attachments/795265098159357953/1051199855550275584/Culture_Victory.png",
            "https://cdn.discordapp.com/attachments/795265098159357953/1051199855852269698/Domination_Victory.png",
            "https://media.discordapp.net/attachments/795265098159357953/1051199857899077743/Religious_Victory.png",
            "https://media.discordapp.net/attachments/795265098159357953/1051199858226241687/Diplomatic_Victory.png"
        ];
        let victoryIndex: number;
        switch(victoryType) {
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
                victoryIndex = (gameType === "FFA") ? 5 : 6;
        }
        return [
            victoryLines[victoryIndex],
            thumbnailVictoryImages[victoryIndex] || ""
        ];
    }



    public reportAcceptRevertEmbed(
        author: User,
        isModerator: boolean,

        usersRating: EntityUserRating[],
        ratingNotes: (EntityRatingNote|EntityPendingRatingNote)[],

        title: string,                      // Разные для accept/revert
        descriptionHeaders: string[],       // 4 // ID, type, victoryName, host
        victoryLines: string[],
        civLines: string[],
        moderatorPrefix: string
    ): EmbedBuilder[] {          
        let victoryObjectLines: string[] = this.getVictoryObjectLines(ratingNotes[0].gameType, ratingNotes[0].victoryType, victoryLines);
        let description: string = this.getFullDescriptionFromNotes(
            ratingNotes, usersRating,
            descriptionHeaders, victoryObjectLines[0], civLines
        );
            
        return UtilsGeneratorEmbed.getSingle(
            title,
            (ratingNotes[0].gameType === "FFA") ? "#389FFF" : "#00FF40",
            description,
            [],
            `${isModerator ? moderatorPrefix + " " : ""}${author.tag}`,
            author.avatarURL(),
            victoryObjectLines[1]
        );
    }

    public reportCancelEmbed(
        author: User,

        usersRating: EntityUserRating[],
        ratingNotes: EntityRatingNote[],

        title: string,
        descriptionHeaders: string[],       // 3 // ID, type, host
        moderatorPrefix: string
    ): EmbedBuilder[] {
        let description: string = this.getCancelDescriptionFromNotes(ratingNotes, usersRating, descriptionHeaders);

        return UtilsGeneratorEmbed.getSingle(
            title,
            (ratingNotes[0].gameType === "FFA") ? "#1F578C" : "#008221",
            description,
            [],
            `${moderatorPrefix} ${author.tag}`,
            author.avatarURL(),
        );
    }

    public reportProcessingOKEmbed(
        author: User,
        isModerator: boolean,

        usersRating: EntityUserRating[],
        ratingNotes: (EntityRatingNote|EntityPendingRatingNote)[],

        title: string,
        descriptionHeaders: string[],       // 4 // ID, type, victoryName, host
        victoryLines: string[],
        civLines: string[],
        moderatorPrefix: string,

        readyDescription: string,
        warningDescription: string,
        warningDescriptionLines: string[],
    ): EmbedBuilder[] {
        let victoryObjectLines: string[] = this.getVictoryObjectLines(ratingNotes[0].gameType, ratingNotes[0].victoryType, victoryLines);
        let description: string = this.getFullDescriptionFromNotes(
            ratingNotes, usersRating,
            descriptionHeaders, victoryObjectLines[0], civLines,
            false
        );
        let predescription: string = readyDescription + "\n\n";
        if(warningDescriptionLines.length > 0)
            predescription += warningDescription + "\n" + warningDescriptionLines.map(line => `⚠️ ${line}`).join("\n") + "\n\n";
        description = predescription + description;
            
        return UtilsGeneratorEmbed.getSingle(
            title,
            (ratingNotes[0].gameType === "FFA") ? "#389FFF" : "#00FF40",
            description,
            [],
            `${isModerator ? moderatorPrefix + " " : ""}${author.tag}`,
            author.avatarURL(),
            victoryObjectLines[1]
        );
    }

    public reportProcessingErrorEmbed(
        author: User,
        isModerator: boolean,

        usersRating: EntityUserRating[],
        ratingNotes: (EntityRatingNote|EntityPendingRatingNote)[],

        title: string,
        descriptionHeaders: string[],       // 4 // ID, type, victoryName, host
        victoryLines: string[],
        civLines: string[],
        moderatorPrefix: string,

        errorDescription: string,
        errorDescriptionLines: string[],
        warningDescription: string,
        warningDescriptionLines: string[],
    ): EmbedBuilder[] {
        let victoryObjectLines: string[] = this.getVictoryObjectLines(ratingNotes[0].gameType, ratingNotes[0].victoryType, victoryLines);
        let description: string = this.getFullDescriptionFromNotes(
            ratingNotes, usersRating,
            descriptionHeaders, victoryObjectLines[0], civLines,
            false
        );
        let predescription: string = errorDescription + errorDescriptionLines.map(line => `<:No:808418109319938099> ${line}`).join("\n") + "\n\n";
        if(warningDescriptionLines.length > 0)
            predescription += warningDescription + "\n" + warningDescriptionLines.map(line => `⚠️ ${line}`).join("\n") + "\n\n";
        description = predescription + description;
            
        return UtilsGeneratorEmbed.getSingle(
            title,
            "#DD2E44",
            description,
            [],
            `${isModerator ? moderatorPrefix + " " : ""}${author.tag}`,
            author.avatarURL()
        );
    }

    public reportPMEmbed(
        gameType: string,
        title: string,
        description: string,
        guild: Guild|null
    ): EmbedBuilder[] {
        return UtilsGeneratorEmbed.getSingle(
            title,
            (gameType === "FFA") ? "#389FFF" : "#00FF40",
            description,
            [],
            guild?.name,
            guild?.iconURL()
        );
    }

    public reportRejectPMEmbed(
        guild: Guild,

        usersRating: EntityUserRating[],
        ratingNotes: EntityPendingRatingNote[],

        title: string,
        rejectDescription: string,
        descriptionHeaders: string[],       // 4 // ID, type, victoryName, host
        victoryLines: string[],
        civLines: string[],
    ): EmbedBuilder[] {
        let victoryObjectLines: string[] = this.getVictoryObjectLines(ratingNotes[0].gameType, ratingNotes[0].victoryType, victoryLines);
        let description: string = this.getFullDescriptionFromNotes(
            ratingNotes, usersRating,
            descriptionHeaders, victoryObjectLines[0], civLines
        );

        return UtilsGeneratorEmbed.getSingle(
            title,
            "#DD2E44",
            rejectDescription + "\n\n" + description,
            [],
            guild?.name,
            guild?.iconURL(),
            victoryLines[1]
        );
    }

    public reportProcessingButtons(
        authorID: string,
        pendingGameID: number,
        labels: string[]
    ): ActionRowBuilder<ButtonBuilder>[] {
        return UtilsGeneratorButton.getList(
            labels,
            [],
            [ButtonStyle.Success, ButtonStyle.Danger],
            [`rating-report-user-confirm-${pendingGameID}-${authorID}`, `rating-report-user-delete-${pendingGameID}-${authorID}`]
        );
    }

    public reportModeratorButtons(
        authorID: string,
        pendingGameID: number,
        labels: string[]
    ): ActionRowBuilder<ButtonBuilder>[] {
        return UtilsGeneratorButton.getList(
            labels,
            [],
            [ButtonStyle.Success, ButtonStyle.Danger],
            [`rating-report-moderator-accept-${pendingGameID}`, `rating-report-moderator-reject-${pendingGameID}-${authorID}`]
        );
    }

    public rejectModal(
        reportAuthorID: string,
        pendingGameID: number,
        title: string,
        label: string
    ): ModalBuilder {
        return UtilsGeneratorModal.build(
            `rating-report-moderator-reject-modal-${pendingGameID}-${reportAuthorID}`,
            title,
            ["rating-report-moderator-reject-modal-description"],
            [label],
            [],
            [TextInputStyle.Short]
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
