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

        descriptionHeaders: string[],       // 4 // ID, gameType, host, victory
        victoryLine: string,
        civLines: string[],

        isRequiredGameID: boolean = true
    ): string {
        let description: string = (isRequiredGameID) ? `${descriptionHeaders[0]}: **${ratingNotes[0].gameID}**\n` : "";
        if(ratingNotes[0]?.gameType)
            description += `${descriptionHeaders[1]}: ${ratingNotes[0].gameType}\n`;
        description += `${descriptionHeaders[3]}: ${victoryLine}\n`;
        if(ratingNotes.filter(ratingNote => ratingNote.isHost).length > 0)
            description += `${descriptionHeaders[2]}: <@${ratingNotes.filter(ratingNote => ratingNote.isHost)[0].userID}>\n`;
        description += "\n";
        
        if(ratingNotes.length === 0)
            return description;
        
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
        let playersPerTeam: number = Math.min(Math.floor(playersTotal/teamsTotal), 8) || 1;
        for(let i: number = 0; i < teamsTotal; i++) {
            let currentPlace: number = ratingNotes[i*playersPerTeam].place;
            let minBound: number = -1, maxBound: number = -1;
            for(let j: number = 0; j < playersTotal; j++)
                if(ratingNotes[j].place === currentPlace) 
                    (minBound === -1)
                        ? minBound = j
                        : maxBound = j;
            minBound = Math.floor(minBound/playersPerTeam) + 1;
            maxBound = Math.floor(maxBound/playersPerTeam) + 1;
            let placeLine: string = ((minBound === maxBound) || (maxBound === 0))
                ? ` ${currentPlace}`
                : `${minBound}..${maxBound}`;
            for(let k: number = 0; k < playersPerTeam; k++) 
                placeLines.push(placeLine);
        }
        for(let i: number = playersTotal; i < ratingNotes.length; i++)
            placeLines.push(" - ");
        
        ratingNotes.forEach((ratingNote: EntityRatingNote|EntityPendingRatingNote, index: number) => {
            ratingChangeLines.push(spacesString.concat(`${ratingNote.typedRating >= 0 ? "+" : ""}${ratingNote.typedRating}`).slice(-4));
            if(ratingNote.isSubIn || ratingNote.isSubOut)
                ratingEmojiLines.push("🔄");
            else if(ratingNote.typedRating >= 0)
                ratingEmojiLines.push("📈");
            else
                ratingEmojiLines.push("📉");
            ratingTotalLines.push(spacesString.concat(`(${ratingNote.gameType === "FFA" ? (usersRating[index].ffaRating) : usersRating[index].teamersRating})`).slice(-6));
            if(ratingNote.isHost)
                statusEmojiLines.push("🖥️");
            else if(ratingNote.isLeave)
                statusEmojiLines.push("💨");
            else
                statusEmojiLines.push("<:EmptySpace:1057693249776660552>");
            userLines.push(`<@${ratingNote.userID}>`);
            userCivLines.push((ratingNote.isSubOut) ? "" : civLines[ratingNote.civilizationID || -1] || "");
        });
        let placeLineMaxLength: number = Math.max(...placeLines.map(str => str.length));
        placeLines = placeLines.map(str => Array<string>(placeLineMaxLength-str.length).fill(" ").join("")+str);
        for(let i: number = 0; i < placeLines.length; i++) {
            if((i !== 0) && (
                ((ratingNotes[i].isSubOut) && (!ratingNotes[i-1].isSubOut)) ||                      // Начало списка заменённых игроков
                ((i < playersTotal) && (teamsTotal !== playersTotal) && (i%playersPerTeam === 0))   // для режима Teamers: следующая команда
            ))
                description += "\n";
            description += `\`${placeLines[i]}\`  \`${ratingChangeLines[i]}\` ${ratingEmojiLines[i]} \`${ratingTotalLines[i]}\` ${statusEmojiLines[i]} ${userLines[i]} ${userCivLines[i]}\n`;
        }
        return description;
    }

    private getCancelDescriptionFromNotes(
        ratingNotes: EntityRatingNote[],
        usersRating: EntityUserRating[],
        descriptionHeaders: string[],       // 3 // ID, type, host
    ): string {
        let description: string = `${descriptionHeaders[0]}: **${ratingNotes[0].gameID}** <:No:808418109319938099>\n${descriptionHeaders[1]}: ${ratingNotes[0].gameType}\n`;
        for(let i in ratingNotes)
                if(ratingNotes[i].isHost) {
                    description += `${descriptionHeaders[2]}: <@${ratingNotes[i].userID}>\n`;
                    break;
                }
        description += "\n";

        let spacesString: string = "    ";
        ratingNotes.forEach((ratingNote: EntityRatingNote, index: number) => {
            if((index !== 0) && (ratingNote.isSubOut) && (!ratingNotes[index-1].isSubOut))
                description += "\n";
            description += `\`${spacesString.concat(`${ratingNote.typedRating*-1 >= 0 ? "+" : ""}${ratingNote.typedRating*-1}`).slice(-4)}\`  \`${spacesString.concat(`(${ratingNote.gameType === "FFA" ? usersRating[index].ffaRating : usersRating[index].teamersRating})`).slice(-6)}\`  <@${ratingNote.userID}>\n`;
        });
        return description;
    }

    private getVictoryObjectLine(gameType: string|null, victoryType: string|null, victoryLines: string[]): string {
        /*
        let thumbnailVictoryImages: string[] = [
            "https://media.discordapp.net/attachments/795265098159357953/1051199855172792372/Science_Victory.png",
            "https://media.discordapp.net/attachments/795265098159357953/1051199855550275584/Culture_Victory.png",
            "https://cdn.discordapp.com/attachments/795265098159357953/1051199855852269698/Domination_Victory.png",
            "https://media.discordapp.net/attachments/795265098159357953/1051199857899077743/Religious_Victory.png",
            "https://media.discordapp.net/attachments/795265098159357953/1051199858226241687/Diplomatic_Victory.png"
        ];
        */
        victoryLines.push("—");
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
                if(gameType === "FFA")
                    victoryIndex = 5;
                else if(gameType === "Teamers")
                    victoryIndex = 6;
                else
                    victoryIndex = 7;
                break;
        }
        return victoryLines[victoryIndex];
    }



    public reportAcceptRevertEmbed(
        author: User,
        isModerator: boolean,

        usersRating: EntityUserRating[],
        ratingNotes: (EntityRatingNote|EntityPendingRatingNote)[],

        title: string,                      // Разные для accept/revert
        descriptionHeaders: string[],       // 4 // ID, type, host, victoryName
        victoryLines: string[],
        civLines: string[],
        moderatorPrefix: string
    ): EmbedBuilder[] {          
        let victoryLine: string = this.getVictoryObjectLine(ratingNotes[0].gameType, ratingNotes[0].victoryType, victoryLines);
        let description: string = this.getFullDescriptionFromNotes(
            ratingNotes, usersRating,
            descriptionHeaders, victoryLine, civLines
        );
            
        return UtilsGeneratorEmbed.getSingle(
            title,
            (ratingNotes[0].gameType === "FFA") ? "#389FFF" : "#00FF40",
            description,
            [],
            `${isModerator ? moderatorPrefix + " " : ""}${author.tag}`,
            author.avatarURL(),
            ""
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
            ""
        );
    }

    public reportProcessingOKEmbed(
        author: User,
        isModerator: boolean,

        usersRating: EntityUserRating[],
        ratingNotes: (EntityRatingNote|EntityPendingRatingNote)[],

        title: string,
        descriptionHeaders: string[],       // 4 // ID, type, host, victoryName
        victoryLines: string[],
        civLines: string[],
        moderatorPrefix: string,

        readyDescription: string,
        warningDescription: string,
        warningDescriptionLines: string[],
    ): EmbedBuilder[] {
        let victoryObjectLine: string = this.getVictoryObjectLine(ratingNotes[0].gameType, ratingNotes[0].victoryType, victoryLines);
        let description: string = this.getFullDescriptionFromNotes(
            ratingNotes, usersRating,
            descriptionHeaders, victoryObjectLine, civLines,
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
            ""
        );
    }

    public reportProcessingErrorEmbed(
        author: User,
        isModerator: boolean,

        usersRating: EntityUserRating[],
        ratingNotes: (EntityRatingNote|EntityPendingRatingNote)[],

        title: string,
        descriptionHeaders: string[],       // 4 // ID, type, host, victoryName
        victoryLines: string[],
        civLines: string[],
        moderatorPrefix: string,

        errorDescription: string,
        errorDescriptionLines: string[],
        warningDescription: string,
        warningDescriptionLines: string[],
    ): EmbedBuilder[] {
        let victoryObjectLine: string = this.getVictoryObjectLine(ratingNotes[0]?.gameType || null, ratingNotes[0]?.victoryType || null, victoryLines);
        let description: string = this.getFullDescriptionFromNotes(
            ratingNotes, usersRating,
            descriptionHeaders, victoryObjectLine, civLines,
            false
        );
        let predescription: string = errorDescription + "\n" + errorDescriptionLines.map(line => `<:No:808418109319938099> ${line}`).join("\n") + "\n\n";
        if(warningDescriptionLines.length > 0)
            predescription += warningDescription + "\n" + warningDescriptionLines.map(line => `⚠️ ${line}`).join("\n") + "\n\n";
        description = predescription + description;
            
        return UtilsGeneratorEmbed.getSingle(
            title,
            "#DD2E44",
            description,
            [],
            `${isModerator ? moderatorPrefix + " " : ""}${author.tag}`,
            author.avatarURL(),
            ""
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
        descriptionHeaders: string[],       // 4 // ID, type, host, victoryName
        victoryLines: string[],
        civLines: string[],
    ): EmbedBuilder[] {
        let victoryObjectLine: string = this.getVictoryObjectLine(ratingNotes[0].gameType, ratingNotes[0].victoryType, victoryLines);
        let description: string = this.getFullDescriptionFromNotes(
            ratingNotes, usersRating,
            descriptionHeaders, victoryObjectLine, civLines
        );

        return UtilsGeneratorEmbed.getSingle(
            title,
            "#DD2E44",
            rejectDescription + "\n\n" + description,
            [],
            guild?.name,
            guild?.iconURL(),
            ""
        );
    }

    public reportProcessingButtons(
        authorID: string,
        pendingGameID: number,
        labels: string[],
        isConfirmDisabled: boolean = false
    ): ActionRowBuilder<ButtonBuilder>[] {
        return UtilsGeneratorButton.getList(
            labels,
            [],
            [ButtonStyle.Success, ButtonStyle.Danger],
            [`rating-report-user-confirm-${pendingGameID}-${authorID}`, `rating-report-user-delete-${pendingGameID}-${authorID}`],
            [isConfirmDisabled, false]
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
                {name: headers[2], value: `${ratingChange >= 0 ? "+" : ""}${ratingChange} (${
                    (type === "FFA") ? userRating.ffaRating : 
                    (type === "Teamers") ? userRating.teamersRating : userRating.rating
                })`}
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
