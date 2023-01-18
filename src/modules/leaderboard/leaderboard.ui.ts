import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Message, User } from "discord.js";
import { EntityUserRating } from "../../database/entities/entity.UserRating";
import { UtilsGeneratorButton } from "../../utils/generators/utils.generator.button";
import { UtilsGeneratorEmbed } from "../../utils/generators/utils.generator.embed";
import { ModuleBaseUI } from "../base/base.ui";

export class LeaderboardUI extends ModuleBaseUI {
    public leaderboardEmbed(
        author: User,
        type: string,
        userRatings: EntityUserRating[],
        title: string,
        emptyDescription: string,
        pageCurrent: number,
        pageTotal: number,
        playersPerPage: number
    ): EmbedBuilder[] {
        let description: string;
        if(userRatings.length === 0)
            description = emptyDescription;
        else {
            let placeLength: number = String(Math.min(playersPerPage*pageCurrent, pageTotal)).length;
            let ratingLength: number = (type === "FFA")
                ? String(userRatings[0].ffaRating).length
                : String(userRatings[0].teamersRating).length;
            let spaceString: string = "    ";    // 4 spaces 
            description = userRatings.map((userRating: EntityUserRating, index: number): string => `\`${
                spaceString.concat(String(index+1+(pageCurrent-1)*playersPerPage)).slice(-placeLength)
            }\`  \`${
                spaceString.concat(String((type === "FFA") ? userRating.ffaRating : userRating.teamersRating)).slice(-ratingLength)
            }\`  <@${userRating.userID}>`)
                .join("\n");
        }

        return UtilsGeneratorEmbed.getSingle(
            title,
            (type === "FFA") ? "#389fff" : "#00ff40",
            description,
            [],
            author.tag,
            author.avatarURL()
        );
    }

    public leaderboardButtons(
        type: string,
        authorID: string,
        label: String,
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

    public leaderboardStaticMessage(
        userRatings: EntityUserRating[],
        type: string,
        playersPerPage: number,
        title: string,
        emptyDescription: string
    ): string {
        let content: string = `__**${title}**__\n`;
        if(userRatings.length === 0)
            content += `\n*${emptyDescription}.*`;
        else {
            let placeLength: number = String(userRatings.length).length;
            let ratingLength: number = (type === "FFA")
                ? String(userRatings[0].ffaRating).length
                : String(userRatings[0].teamersRating).length;
            let spaceString: string = "    ";    // 4 spaces 
            content += userRatings.map((userRating: EntityUserRating, index: number): string => ((index % playersPerPage) === 0) ? "\n" : "" + `\`${
                spaceString.concat(String(index+1)).slice(-placeLength)
            }\`  \`${
                spaceString.concat(String((type === "FFA") ? userRating.ffaRating : userRating.teamersRating)).slice(-ratingLength)
            }\`  <@${userRating.userID}>`)
                .join("\n");
        }
        return content;
    }
}
