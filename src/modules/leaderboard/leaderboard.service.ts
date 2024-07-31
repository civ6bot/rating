import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, CommandInteraction, EmbedBuilder, Guild, GuildTextBasedChannel, InteractionType, Message } from "discord.js";
import { discordClient } from "../../client/client";
import { EntityUserRating } from "../../database/entities/entity.UserRating";
import { DatabaseServiceUserRating } from "../../database/services/service.UserRating";
import { ModuleBaseService } from "../base/base.service";
import { LeaderboardUI } from "./leaderboard.ui";

export class LeaderboardService extends ModuleBaseService {
    private leaderboardPlayersPerPage: number = 10;

    private leaderboardUI: LeaderboardUI = new LeaderboardUI();

    private databaseServiceUserRating: DatabaseServiceUserRating = new DatabaseServiceUserRating();

    private isOwner(interaction: ButtonInteraction): boolean {
        return interaction.customId.split("-")[2] === interaction.user.id;
    }

    private async updateLeaderboardConfig(guildID: string, type: string, channelID: string = "", messageID: string = ""): Promise<void> {
        this.updateManySetting(
            guildID, 
            (type === "FFA") 
                ? ["LEADERBOARD_FFA_CHANNEL_ID", "LEADERBOARD_FFA_MESSAGE_ID"]
                : ["LEADERBOARD_TEAMERS_CHANNEL_ID", "LEADERBOARD_TEAMERS_MESSAGE_ID"],
            [channelID, messageID]
        );
    }

    public async getLeaderboardMessage(guildID: string, type: string): Promise<Message|null> {
        let channelID: string = await this.getOneSettingString(guildID,
            (type === "FFA") ? "LEADERBOARD_FFA_CHANNEL_ID" : "LEADERBOARD_TEAMERS_CHANNEL_ID"
        );
        let messageID: string = await this.getOneSettingString(guildID,
            (type === "FFA") ? "LEADERBOARD_FFA_MESSAGE_ID" : "LEADERBOARD_TEAMERS_MESSAGE_ID"
        );
        if((channelID === "") || (messageID === ""))
            return null;
        try {
            let guild: Guild = await discordClient.guilds.fetch(guildID);
            let channel: (GuildTextBasedChannel|null) = (await guild.channels.fetch(channelID) || null) as (GuildTextBasedChannel|null);
            return (await channel?.messages?.fetch(messageID) || null) as (Message|null);
        } catch {
            return null;
        }
    }

    public async updateLeaderboardStaticContent(guildID: string, type: string): Promise<void> {
        let message: Message|null = await this.getLeaderboardMessage(guildID, type);
        if(message === null)
            return;
        let leaderboardMaxLength: number = await this.getOneSettingNumber(guildID, "LEADERBOARD_STATIC_MAX_LENGTH");
        let leaderboardGamesMinimum: number = await this.getOneSettingNumber(guildID, "LEADERBOARD_GAMES_MINIMUM");
        let userRatings: EntityUserRating[] = (type === "FFA")
            ? await this.databaseServiceUserRating.getBestRatingFFA(guildID, leaderboardMaxLength, leaderboardGamesMinimum)
            : await this.databaseServiceUserRating.getBestRatingTeamers(guildID, leaderboardMaxLength, leaderboardGamesMinimum);
        let isGamesRequired: boolean = !!(await this.getOneSettingNumber(guildID, "LEADERBOARD_STATIC_SHOW_GAMES"));

        let title: string = await this.getOneText(guildID, (type === "FFA") ? "LEADERBOARD_STATIC_FFA_TITLE" : "LEADERBOARD_STATIC_TEAMERS_TITLE");
        let emptyDescription: string = await this.getOneText(guildID, "LEADERBOARD_DESCRIPTION_EMPTY");
        let fieldHeaders: string[] = await this.getManyText(guildID, [
            "LEADERBOARD_DESCRIPTION_PLAYER_HEADER", "LEADERBOARD_DESCRIPTION_RATING_HEADER",
            "LEADERBOARD_DESCRIPTION_GAMES_HEADER"
        ]);
        message.edit({
            embeds: this.leaderboardUI.leaderboardStaticEmbed(
                userRatings,
                type,
                this.leaderboardPlayersPerPage,
                isGamesRequired,
                title,
                emptyDescription,
                fieldHeaders
            ), content: null
        });
    }

    public async leaderboard(interaction: CommandInteraction | ButtonInteraction, type: string, pageCurrent: number = 1){
        let leaderboardMaxLength: number = await this.getOneSettingNumber(interaction, "LEADERBOARD_MAX_LENGTH");
        let leaderboardGamesMinimum: number = await this.getOneSettingNumber(interaction, "LEADERBOARD_GAMES_MINIMUM");
        let userRatings: EntityUserRating[] = (type === "FFA")
            ? await this.databaseServiceUserRating.getBestRatingFFA(interaction.guild?.id as string, leaderboardMaxLength, leaderboardGamesMinimum)
            : await this.databaseServiceUserRating.getBestRatingTeamers(interaction.guild?.id as string, leaderboardMaxLength, leaderboardGamesMinimum);
        let pageTotal: number = Math.ceil(userRatings.length/this.leaderboardPlayersPerPage);
        switch(pageCurrent) {
            case 99:                            // нельзя использовать одинаковые ID кнопок
                pageCurrent = 1; break;         // поэтому чтобы избежать повторений, было сделано это
            case 100:
                pageCurrent = pageTotal; break;
        }
        let isGamesRequired: boolean = !!(await this.getOneSettingNumber(interaction, "LEADERBOARD_SHOW_GAMES"));

        let title = await this.getOneText(interaction, 
            (type === "FFA") ? "LEADERBOARD_FFA_TITLE" : "LEADERBOARD_TEAMERS_TITLE",
            pageCurrent, Math.max(pageTotal, 1)
        );
        let emptyDescription: string = await this.getOneText(interaction, "LEADERBOARD_DESCRIPTION_EMPTY");
        let fieldHeaders: string[] = await this.getManyText(interaction, [
            "LEADERBOARD_DESCRIPTION_PLAYER_HEADER", "LEADERBOARD_DESCRIPTION_RATING_HEADER",
            "LEADERBOARD_DESCRIPTION_GAMES_HEADER"
        ]);
        let label: string = await this.getOneText(interaction, "LEADERBOARD_DELETE");

        let embed: EmbedBuilder[] = this.leaderboardUI.leaderboardEmbed(
            interaction.user, type,
            userRatings.slice(
                (pageCurrent-1)*this.leaderboardPlayersPerPage, 
                (pageCurrent)*this.leaderboardPlayersPerPage, 
            ),
            isGamesRequired, title,
            emptyDescription, fieldHeaders,
            pageCurrent, this.leaderboardPlayersPerPage
        ), component: ActionRowBuilder<ButtonBuilder>[] = this.leaderboardUI.leaderboardButtons(
            type, interaction.user.id,
            label, pageCurrent,
            pageTotal
        );

        if(interaction.type === InteractionType.MessageComponent) {
            interaction.message.edit({embeds: embed, components: component});
        } else {
            interaction.reply({embeds: embed, components: component});
        }
    }

    public async leaderboardPageButton(interaction: ButtonInteraction) {
        interaction.deferUpdate();
        if(!this.isOwner(interaction))
            return;
        let type: string = interaction.customId.split("-")[1];
        let pageCurrent: number = Number(interaction.customId.split("-")[3]);
        this.leaderboard(interaction, type, pageCurrent);
    }

    public async leaderboardDeleteButton(interaction: ButtonInteraction) {
        interaction.deferUpdate();
        if(!this.isOwner(interaction))
            return;
        interaction.message.delete().catch();
    }

    public async leaderboardStaticInfo(interaction: CommandInteraction){
        let messages: (Message|null)[] = [
            await this.getLeaderboardMessage(interaction.guild?.id as string, "FFA"),
            await this.getLeaderboardMessage(interaction.guild?.id as string, "Teamers")
        ];
        
        let title: string = await this.getOneText(interaction, "LEADERBOARD_STATIC_TITLE");
        let headers: string[] = await this.getManyText(interaction, [
            "LEADERBOARD_STATIC_INFO_FFA_HEADER", "LEADERBOARD_STATIC_INFO_TEAMERS_HEADER"
        ]);
        let linkValue: string = await this.getOneText(interaction, "LEADERBOARD_STATIC_INFO_LINK_VALUE");
        let description: string = await this.getOneText(interaction, "LEADERBOARD_STATIC_INFO_HELP_DESCRIPTION");

        interaction.reply({
            embeds: this.leaderboardUI.leaderboardStaticInfoEmbed(
                messages,
                title,
                headers,
                linkValue,
                description
            ),
            ephemeral: true
        });
    }

    public async leaderboardStatic(interaction: CommandInteraction, type: string){
        if(!(await this.isModerator(interaction))) {
            let textLines: string[] = await this.getManyText(interaction, [
                "BASE_ERROR_TITLE", "LEADERBOARD_ERROR_NO_PERMISSION"
            ]);
            return interaction.reply({embeds: this.leaderboardUI.error(textLines[0], textLines[1]), ephemeral: true});
        }
        let previousMessage: Message|null = await this.getLeaderboardMessage(interaction.guild?.id as string, type);
        if(previousMessage !== null) {
            this.updateLeaderboardConfig(interaction.guild?.id as string, type);
            previousMessage.delete().catch();
        }
        try {
            let message: Message = await (interaction.channel as GuildTextBasedChannel).send({content: "Please, wait..."});
            this.updateLeaderboardConfig(message.guild?.id as string, type, message.channel.id, message.id);
            let textLines: string[] = await this.getManyText(interaction, ["BASE_NOTIFY_TITLE", "LEADERBOARD_SUCCESS_NOTIFY"]);
            await interaction.reply({embeds: this.leaderboardUI.notify(textLines[0], textLines[1]), ephemeral: true});
            await this.updateLeaderboardStaticContent(interaction.guild?.id as string, type);
        } catch {
            let textLines: string[] = await this.getManyText(interaction, ["BASE_NOTIFY_TITLE", "LEADERBOARD_ERROR_SEND"]);
            interaction.reply({embeds: this.leaderboardUI.error(textLines[0], textLines[1]), ephemeral: true});
        }
    }
}
