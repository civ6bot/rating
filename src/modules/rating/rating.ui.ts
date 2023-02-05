import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ColorResolvable, EmbedBuilder, Guild, ModalBuilder, TextInputStyle, User } from "discord.js";
import { EntityPendingRatingNote } from "../../database/entities/entity.PendingRatingNote";
import { EntityRatingNote } from "../../database/entities/entity.RatingNote";
import { EntityUserRating } from "../../database/entities/entity.UserRating";
import { UtilsGeneratorButton } from "../../utils/generators/utils.generator.button";
import { UtilsGeneratorEmbed } from "../../utils/generators/utils.generator.embed";
import { UtilsGeneratorModal } from "../../utils/generators/utils.generator.modal";
import { ModuleBaseUI } from "../base/base.ui";

export class RatingUI extends ModuleBaseUI {
    private thumbnailVictoryImages: string[] = [
        "https://media.discordapp.net/attachments/795265098159357953/1051199855172792372/Science_Victory.png",
        "https://media.discordapp.net/attachments/795265098159357953/1051199855550275584/Culture_Victory.png",
        "https://cdn.discordapp.com/attachments/795265098159357953/1051199855852269698/Domination_Victory.png",
        "https://media.discordapp.net/attachments/795265098159357953/1051199857899077743/Religious_Victory.png",
        "https://media.discordapp.net/attachments/795265098159357953/1051199858226241687/Diplomatic_Victory.png"
    ];

    private getVictoryObjectLine(gameType: string|null, victoryType: string|null, victoryLines: string[]): string {
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

    private getHeaderDescription(
        descriptionHeaders: string[],
        values: string[],
        isRequiredArray: boolean[]
    ): string {
        return descriptionHeaders
            .map((descriptionHeader: string, index: number): string => `${descriptionHeader}: **${(values[index].length) ? values[index] : "—"}**`)
            .filter((value: string, index: number): boolean => isRequiredArray[index] ?? true)
            .join("\n");
    }

    private getUserDescriptionFromNotes(
        ratingNotes: (EntityRatingNote|EntityPendingRatingNote)[],
        usersRating: EntityUserRating[],
        civLines: string[]
    ): string {
        let description: string = "";
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
            placeLines.push(" -- ");
        
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
            userCivLines.push((ratingNote.isSubOut) 
                ? "" 
                : civLines[ratingNote.civilizationID ?? -1]?.replaceAll(/\([\wА-Яа-я ]+\)/g, "")?.trim() || ""
            );
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

    // Более простой вариант
    // Без мест, цивилизаций и эмодзи
    private getUserCancelDescriptionFromNotes(
        ratingNotes: (EntityRatingNote|EntityPendingRatingNote)[],
        usersRating: EntityUserRating[]
    ): string {
        let description: string = "";
        let spacesString: string = "    ";
        ratingNotes.forEach((ratingNote: EntityRatingNote|EntityPendingRatingNote, index: number) => {
            if((index !== 0) && (ratingNote.isSubOut) && (!ratingNotes[index-1].isSubOut))
                description += "\n";
            description += `\`${spacesString.concat(`${ratingNote.typedRating*-1 >= 0 ? "+" : ""}${ratingNote.typedRating*-1}`).slice(-4)}\`  \`${spacesString.concat(`(${ratingNote.gameType === "FFA" ? usersRating[index].ffaRating : usersRating[index].teamersRating})`).slice(-6)}\`  <@${ratingNote.userID}>\n`;
        });
        return description;
    }



    public reportBrightEmbed(
        author: User,
        isModerator: boolean,

        usersRating: EntityUserRating[],
        ratingNotes: (EntityRatingNote|EntityPendingRatingNote)[],

        title: string,
        description: string,                // pre-description

        descriptionHeaders: string[],       // 4: ID, type, host, victoryName
        descriptionHeadersFlags: boolean[],
        victoryLines: string[],
        civLines: string[],

        moderatorPrefix: string
    ): EmbedBuilder[] {
        let values: string[] = [
            String(ratingNotes[0].gameID),
            ratingNotes[0].gameType || "",
            (ratingNotes.filter(ratingNote => ratingNote.isHost)[0]?.userID) ? `<@${ratingNotes.filter(ratingNote => ratingNote.isHost)[0].userID}>` : "",
            this.getVictoryObjectLine(ratingNotes[0].gameType, ratingNotes[0].victoryType, victoryLines)
        ];
        description = description + 
            ((description.length) ? "\n\n" : "") + 
            this.getHeaderDescription(descriptionHeaders, values, descriptionHeadersFlags) + 
            "\n\n" + 
            this.getUserDescriptionFromNotes(ratingNotes, usersRating, civLines);
        let color: ColorResolvable = ((ratingNotes[0].gameType === "FFA") ? "#389FFF" : "#00FF40");

        return UtilsGeneratorEmbed.getSingle(
            title,
            color,
            description,
            [],
            `${isModerator ? moderatorPrefix + " " : ""}${author.tag}`,
            author.avatarURL()
        );
    }

    public reportDarkShortEmbed(
        author: User,

        usersRating: EntityUserRating[],
        ratingNotes: (EntityRatingNote|EntityPendingRatingNote)[],

        title: string,
        description: string,                // pre-description

        descriptionHeaders: string[],       // 4: ID, type, host, victoryName
        descriptionHeadersFlags: boolean[],

        moderatorPrefix: string
    ): EmbedBuilder[] {
        let values: string[] = [
            String(ratingNotes[0].gameID),
            ratingNotes[0].gameType || "",
            (ratingNotes.filter(ratingNote => ratingNote.isHost)[0]?.userID) ? `<@${ratingNotes.filter(ratingNote => ratingNote.isHost)[0].userID}>` : "",
            ""
        ];
        description = description + 
            ((description.length) ? "\n\n" : "") + 
            this.getHeaderDescription(descriptionHeaders, values, descriptionHeadersFlags) + 
            "\n\n" + 
            this.getUserCancelDescriptionFromNotes(ratingNotes, usersRating);
        let color: ColorResolvable = ((ratingNotes[0].gameType === "FFA") ? "#1F578C" : "#008221");

        return UtilsGeneratorEmbed.getSingle(
            title,
            color,
            description,
            [],
            `${moderatorPrefix} ${author.tag}`,
            author.avatarURL()
        );
    }

    public reportDangerEmbed(
        author: User|Guild,
        isModerator: boolean,

        usersRating: EntityUserRating[],
        ratingNotes: (EntityRatingNote|EntityPendingRatingNote)[],

        title: string,
        description: string,                // pre-description

        descriptionHeaders: string[],       // 4: ID, type, host, victoryName
        descriptionHeadersFlags: boolean[],
        victoryLines: string[],
        civLines: string[],

        moderatorPrefix: string
    ): EmbedBuilder[] {
        let values: string[] = [
            String(ratingNotes[0].gameID),
            ratingNotes[0].gameType || "",
            (ratingNotes.filter(ratingNote => ratingNote.isHost)[0]?.userID) ? `<@${ratingNotes.filter(ratingNote => ratingNote.isHost)[0].userID}>` : "",
            this.getVictoryObjectLine(ratingNotes[0].gameType, ratingNotes[0].victoryType, victoryLines)
        ];
        description = description + 
            ((description.length) ? "\n\n" : "") + 
            this.getHeaderDescription(descriptionHeaders, values, descriptionHeadersFlags) + 
            "\n\n" + 
            this.getUserDescriptionFromNotes(ratingNotes, usersRating, civLines);
        
        return UtilsGeneratorEmbed.getSingle(
            title,
            "#DD2E44",
            description,
            [],
            (author.constructor.name === "Guild") ? (author as Guild).name : `${(isModerator) ? moderatorPrefix + " " : ""}${(author as User).tag}`,
            (author.constructor.name === "Guild") ? (author as Guild).iconURL() : (author as User).avatarURL()
        );
    }



    // Предложение перейти из личных сообщений на сообщение с отчётом
    // Проверяющийся или подтверждённый
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
            [""],
            [TextInputStyle.Short],
            true
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
