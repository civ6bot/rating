import { ActionRowBuilder, APIEmbedField, ButtonBuilder, ButtonStyle, ColorResolvable, EmbedBuilder, Message, User } from "discord.js";
import { EntityUserRating } from "../../database/entities/entity.UserRating";
import { UtilsGeneratorButton } from "../../utils/generators/utils.generator.button";
import { UtilsGeneratorEmbed } from "../../utils/generators/utils.generator.embed";
import { ModuleBaseUI } from "../base/base.ui";

export class LeaderboardUI extends ModuleBaseUI {
    private lineURL: string = "https://cdn.discordapp.com/attachments/795265098159357953/1070652459564945500/line.png";

    private getFieldArray(
        type: string,
        userRatings: EntityUserRating[],
        fieldHeaders: string[],
        pageCurrent: number,
        playersPerPage: number,
    ): APIEmbedField[] {
        let usersFieldValue: string = userRatings.slice((pageCurrent-1)*playersPerPage, pageCurrent*playersPerPage)
            .map((userRating: EntityUserRating, index: number): string => `${ function(index: number, pageCurrent: number, playersPerPage: number){
                let place: number = (pageCurrent-1)*playersPerPage+index+1;
                switch(place) {
                    case 1:
                        return "🥇";
                    case 2:
                        return "🥈";
                    case 3:
                        return "🥉";
                    case 4:
                        return `\n**${place}**.`;
                    default:
                        return `**${place}**.`;
                }
            }(index, pageCurrent, playersPerPage)} <@${userRating.userID}>`)
            .join("\n");
        let ratingFieldValue: string = userRatings.slice((pageCurrent-1)*playersPerPage, pageCurrent*playersPerPage)
            .map((userRating: EntityUserRating, index: number): string => 
                ((type === "FFA") ? String(userRating.ffaRating) : String(userRating.teamersRating)) + 
                (((pageCurrent-1)*playersPerPage+index+1 === 3) ? "\n\n" : "\n")
            ).join("");
        let gamesFieldValue: string = userRatings.map((userRating: EntityUserRating, index: number): string =>
            ((type === "FFA") ? String(userRating.ffaTotal) : String(userRating.teamersTotal)) + 
            (((pageCurrent-1)*playersPerPage+index+1 === 3) ? "\n\n" : "\n")
        ).join("");
        return [
            {name: fieldHeaders[0], value: usersFieldValue},
            {name: fieldHeaders[1], value: ratingFieldValue},
            {name: fieldHeaders[2], value: gamesFieldValue}
        ];
    }

    public leaderboardEmbed(
        author: User,
        type: string,
        userRatings: EntityUserRating[],
        isGamesRequired: boolean,
        title: string,
        emptyDescription: string,
        fieldHeaders: string[],
        pageCurrent: number,
        playersPerPage: number
    ): EmbedBuilder[] {
        let description: string;
        description = (userRatings.length === 0) ? emptyDescription : "";
        return UtilsGeneratorEmbed.getSingle(
            title,
            (type === "FFA") ? "#389fff" : "#00ff40",
            description,
            this.getFieldArray(type, userRatings, fieldHeaders, pageCurrent, playersPerPage).slice(0, (isGamesRequired) ? 3 : 2),
            author.tag,
            author.avatarURL(),
            null,
            this.lineURL
        );
    }

    public leaderboardButtons(
        type: string,
        authorID: string,
        label: string,
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
            `leaderboard-${type}-${authorID}-99`,
            `leaderboard-${type}-${authorID}-${pageCurrent-1}`,
            `leaderboard-${type}-${authorID}-${pageCurrent+1}`,
            `leaderboard-${type}-${authorID}-100`,
            `leaderboard-delete-${authorID}`
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

    public leaderboardStaticInfoEmbed(
        messages: (Message|null)[],
        title: string,
        headers: string[],
        linkValue: string,
        description: string
    ): EmbedBuilder[] {
        return UtilsGeneratorEmbed.getSingle(
            title,
            "#AAAAAA",
            headers.map((header: string, index: number): string => `${header}: ${
                (messages[index] === null) ? "—" : `[${linkValue}](${messages[index]?.url})`
            }`).join("\n") + `\n\n${description}`
        );
    }

    public leaderboardStaticEmbed(
        userRatings: EntityUserRating[],
        type: string,
        playersPerPage: number,
        isGamesRequired: boolean,
        title: string,
        emptyDescription: string,
        fieldHeaders: string[]
    ): EmbedBuilder[] {
        let embedsLength: number = Math.ceil(userRatings.length/playersPerPage);
        let userRatingGroups: EntityUserRating[][] = [];
        while(userRatings.length > 0)
            userRatingGroups.push(userRatings.splice(0, playersPerPage));
        return UtilsGeneratorEmbed.getList(
            [title],
            Array<ColorResolvable>(embedsLength).fill((type === "FFA") ? "#389fff" : "#00ff40"),
            (embedsLength === 0) ? [emptyDescription] : [],
            userRatingGroups.map((userRatingGroup: EntityUserRating[], index: number): APIEmbedField[] => this.getFieldArray(
                type, userRatingGroup, fieldHeaders, index+1, playersPerPage
            )).slice(0, (isGamesRequired) ? 3 : 2),
            null,
            null,
            [],
            (embedsLength > 0) ? Array<string>(embedsLength).fill(this.lineURL) : []
        );
    }
}
