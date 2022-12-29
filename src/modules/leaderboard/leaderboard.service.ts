import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, CommandInteraction, EmbedBuilder, Guild, GuildMember, GuildTextBasedChannel, InteractionType, Message } from "discord.js";
import { discordClient } from "../../client/client";
import { EntityUserRating } from "../../database/entities/entity.UserRating";
import { DatabaseServiceUserRating } from "../../database/services/service.UserRating";
import { UtilsServiceUsers } from "../../utils/services/utils.service.users";
import { ModuleBaseService } from "../base/base.service";
import { LeaderboardUI } from "./leaderboard.ui";

export class LeaderboardService extends ModuleBaseService {
    private leaderboardSmallPlayersPerPage: number = 10;

    private leaderboardUI: LeaderboardUI = new LeaderboardUI();

    private databaseServiceUserRating: DatabaseServiceUserRating = new DatabaseServiceUserRating();

    private isOwner(interaction: ButtonInteraction): boolean {
        return interaction.customId.split("-")[2] === interaction.user.id;
    }

    private async isModerator(interaction: CommandInteraction | ButtonInteraction): Promise<boolean> {
        let member: GuildMember = interaction.member as GuildMember;
        if(UtilsServiceUsers.isAdmin(member))
            return true;
        let moderationRolesID: string[] = (await this.getOneSettingString(
            interaction, "MODERATION_ROLE_MODERATORS_ID"
        )).split(" ");
        return member.roles.cache.some((value, key) => (moderationRolesID.indexOf(key) !== -1));
    }

    private async updateLeaderboardConfigByMessage(type: string, message: Message): Promise<void> {
        await this.updateLeaderboardConfig(message.guild?.id as string, type, message.channel.id, message.id);
    }

    private async updateLeaderboardConfig(guildID: string, type: string, channelID: string = "", messageID: string = ""): Promise<void> {
        await this.updateManySetting(
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
        let guild: Guild = await discordClient.guilds.fetch(guildID);
        let channel: (GuildTextBasedChannel|null) = (await guild.channels.fetch(channelID) || null) as (GuildTextBasedChannel|null);
        return (await channel?.messages.fetch(messageID) || null) as (Message|null);
    }

    public async updateLeaderboardStaticContent(guildID: string, type: string): Promise<void> {
        let message: Message|null = await this.getLeaderboardMessage(guildID, type);
        if(message === null)
            return;
        let leaderboardMaxLength: number = await this.getOneSettingNumber(guildID, "LEADERBOARD_MAX_LENGTH");
        let userRatings: EntityUserRating[] = (type === "FFA")
            ? await this.databaseServiceUserRating.getBestRatingFFA(guildID, leaderboardMaxLength)
            : await this.databaseServiceUserRating.getBestRatingTeamers(guildID, leaderboardMaxLength);
        let title: string = await this.getOneText(guildID, (type === "FFA") ? "LEADERBOARD_STATIC_FFA_TITLE" : "LEADERBOARD_STATIC_TEAMERS_TITLE");
        let emptyDescription: string = await this.getOneText(guildID, "LEADERBOARD_DESCRIPTION_EMPTY");

        await message.edit({content: this.leaderboardUI.leaderboardStaticMessage(
            userRatings, 
            type, 
            this.leaderboardSmallPlayersPerPage, 
            title, 
            emptyDescription
        )});
    }

    public async leaderboard(interaction: CommandInteraction | ButtonInteraction, type: string, pageCurrent: number = 1){
        let leaderboardMaxLength: number = await this.getOneSettingNumber(interaction, "LEADERBOARD_MAX_LENGTH");
        let userRatings: EntityUserRating[] = (type === "FFA")
            ? await this.databaseServiceUserRating.getBestRatingFFA(interaction.guild?.id as string, leaderboardMaxLength)
            : await this.databaseServiceUserRating.getBestRatingTeamers(interaction.guild?.id as string, leaderboardMaxLength);
        let pageTotal: number = Math.ceil(userRatings.length/this.leaderboardSmallPlayersPerPage);
        switch(pageCurrent) {
            case 99:                            // нельзя использовать одинаковые ID кнопок
                pageCurrent = 1; break;         // поэтому чтобы избежать повторений, было сделано это
            case 100:
                pageCurrent = pageTotal; break;
        }
        let title = await this.getOneText(interaction, 
            (type === "FFA") ? "LEADERBOARD_FFA_TITLE" : "LEADERBOARD_TEAMERS_TITLE",
            pageCurrent, Math.max(pageTotal, 1)
        );
        let emptyDescription: string = await this.getOneText(interaction, "LEADERBOARD_DESCRIPTION_EMPTY");
        let label: string = await this.getOneText(interaction, "LEADERBOARD_DELETE");

        let embed: EmbedBuilder[] = this.leaderboardUI.leaderboardEmbed(
            interaction.user,
            type,
            userRatings.slice(
                (this.leaderboardSmallPlayersPerPage-1)*pageCurrent, 
                (this.leaderboardSmallPlayersPerPage)*pageCurrent,
            ),
            title,
            emptyDescription,
            pageCurrent,
            pageTotal,
            this.leaderboardSmallPlayersPerPage
        ), component: ActionRowBuilder<ButtonBuilder>[] = await this.leaderboardUI.leaderboardButtons(
            type,
            interaction.user.id,
            label,
            pageCurrent,
            pageTotal
        );

        if(interaction.type === InteractionType.MessageComponent)
            await interaction.message.edit({embeds: embed, components: component});
        else 
            await interaction.reply({embeds: embed, components: component});
    }

    public async leaderboardPageButton(interaction: ButtonInteraction) {
        await interaction.deferUpdate();
        if(!this.isOwner(interaction))
            return;
        let type: string = interaction.customId.split("-")[1];
        let pageCurrent: number = Number(interaction.customId.split("-")[3]);
        await this.leaderboard(interaction, type, pageCurrent);
    }

    public async leaderboardDeleteButton(interaction: ButtonInteraction) {
        await interaction.deferUpdate();
        if(!this.isOwner(interaction))
            return;
        await interaction.message.delete();
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

        await interaction.reply({
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
            return await interaction.reply({embeds: this.leaderboardUI.error(textLines[0], textLines[1]), ephemeral: true});
        }
        let previousMessage: Message|null = await this.getLeaderboardMessage(interaction.guild?.id as string, type);
        if(previousMessage !== null) {
            this.updateLeaderboardConfig(interaction.guild?.id as string, type);
            previousMessage.delete();
        }
        try {
            let message: Message = await (interaction.channel as GuildTextBasedChannel).send({content: "Please, wait..."});
            this.updateLeaderboardConfigByMessage(type, message);
            let textLines: string[] = await this.getManyText(interaction, ["BASE_NOTIFY_TITLE", "LEADERBOARD_SUCCESS_NOTIFY"]);
            await interaction.reply({embeds: this.leaderboardUI.notify(textLines[0], textLines[1]), ephemeral: true});
        } catch {
            let textLines: string[] = await this.getManyText(interaction, ["BASE_NOTIFY_TITLE", "LEADERBOARD_ERROR_SEND"]);
            await interaction.reply({embeds: this.leaderboardUI.error(textLines[0], textLines[1]), ephemeral: true});
        }
    }
}
