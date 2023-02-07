import { ActivityType, ChannelType, CommandInteraction, Guild, GuildMember, Interaction, InteractionType, PermissionFlagsBits, TextChannel } from "discord.js";
import { Client } from "discordx";
import { UtilsServiceTime } from "../../utils/services/utils.service.time";
import { ModuleBaseService } from "../base/base.service";
import { DiscordUI } from "./discord.ui";

export class DiscordService extends ModuleBaseService {
    private discordUI: DiscordUI = new DiscordUI();

    public async onInteractionCreate(interaction: Interaction, client: Client) {
        let bot: GuildMember = interaction.guild?.members.cache.get(client.user?.id as string) as GuildMember;
        let hasPermissionSend: boolean = bot.permissionsIn(interaction.channel?.id as string).has(PermissionFlagsBits.SendMessages);
        let hasPermissionView: boolean = bot.permissionsIn(interaction.channel?.id as string).has(PermissionFlagsBits.ViewChannel);
        let hasPermission = hasPermissionSend && hasPermissionView;
        let isGuild: boolean = !!interaction.guild;
        let isSlashCommand: boolean = interaction.type === InteractionType.ApplicationCommand;
        
        if(hasPermission && (isGuild || (!isGuild && !isSlashCommand)))
            return client.executeInteraction(interaction);

        if(!interaction.isRepliable())
            return;
        if(hasPermission && !isGuild && isSlashCommand) {
            let textStrings: string[] = await this.getManyText("DEFAULT", [
                "BASE_ERROR_TITLE", "DISCORD_ERROR_INTERACTION_NO_GUILD"
            ]);
            return interaction.reply({embeds: this.discordUI.error(textStrings[0], textStrings[1]), ephemeral: true});
        }
        let textStrings: string[] = await this.getManyText(interaction.guild?.id as string, [
            "BASE_ERROR_TITLE", "DISCORD_ERROR_INTERACTION_NO_PERMISSION"
        ]);
        return interaction.reply({embeds: this.discordUI.error(textStrings[0], textStrings[1]), ephemeral: true});
    }

    public async onceReady(client: Client) {
        await client.initApplicationCommands();

        setTimeout(() => setInterval(() => {
            let guildsAmount: number = client.guilds.cache.size;
            let usersAmount: number = client.guilds.cache
                .map((guild): number => guild.memberCount)
                .reduce((a, b) => a+b);
            client.user?.setActivity({
                name: `${guildsAmount} 🏰, ${usersAmount} 👥`,
                type: ActivityType.Listening
            });
        }, UtilsServiceTime.getMs(60, "s")), UtilsServiceTime.getMs(0, "s"));

        setTimeout(() => setInterval(() => {
            client.user?.setActivity({
                name: "❤️ Donate for host!"
            });
        }, UtilsServiceTime.getMs(60, "s")), UtilsServiceTime.getMs(15, "s"));

        setTimeout(() => setInterval(() => {
            client.user?.setActivity({
                name: "📄 Slash (/) to check commands."
            });
        }, UtilsServiceTime.getMs(60, "s")), UtilsServiceTime.getMs(30, "s"));

        setTimeout(() => setInterval(() => {
            client.user?.setActivity({
                name: "📣 /feedback to send message."
            });
        }, UtilsServiceTime.getMs(60, "s")), UtilsServiceTime.getMs(45, "s"));
    }

    public async onGuildCreate(guild: Guild) {
        let textStrings: string[] = await this.getManyText(guild.id, [
            "DISCORD_ON_GUILD_CREATE_TITLE", "DISCORD_MESSAGE_HEX_COLOR",
            "DISCORD_ON_GUILD_CREATE_DESCRIPTION", "DISCORD_THUMBNAIL_IMAGE_URL"
        ]);
        for(let channel of guild.channels.cache.values()) {
            try {
                if(channel.type === ChannelType.GuildText) {
                    await (channel as TextChannel).send({
                        embeds: this.discordUI.onGuildCreate(
                            textStrings[0], textStrings[1],
                            textStrings[2], textStrings[3]
                        )
                    });
                    return;
                }
            } catch {}
        }
    }

    public async about(interaction: CommandInteraction) {
        let textStrings: string[] = await this.getManyText(interaction, [
            "DISCORD_ON_GUILD_CREATE_TITLE", "DISCORD_MESSAGE_HEX_COLOR",
            "DISCORD_ON_GUILD_CREATE_DESCRIPTION", "DISCORD_THUMBNAIL_IMAGE_URL"
        ]);
        interaction.reply({embeds: this.discordUI.onGuildCreate(
            textStrings[0], textStrings[1],
            textStrings[2], textStrings[3]
        )});
    }
}
