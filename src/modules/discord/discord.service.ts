import { ActivityType, ChannelType, Guild, TextChannel } from "discord.js";
import { Client } from "discordx";
import { UtilsServiceTime } from "../../utils/services/utils.service.time";
import { ModuleBaseService } from "../base/base.service";
import { DiscordUI } from "./discord.ui";
import * as dotenv from "dotenv";
dotenv.config({path: 'rating.env'});

export class DiscordService extends ModuleBaseService {
    private discordUI: DiscordUI = new DiscordUI();

    public async onceReady(client: Client) {
        await client.initApplicationCommands({ global: { log: (process.env.TEST_MODE == '1') } });

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
                name: "⭐ Support us!"
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
            "DISCORD_ON_GUILD_CREATE_TITLE", "DISCORD_ON_GUILD_CREATE_DESCRIPTION"
        ]);
        for(let channel of guild.channels.cache.values()) {
            try {
                if(channel.type === ChannelType.GuildText) {
                    await (channel as TextChannel).send({
                        embeds: this.discordUI.onGuildCreate(textStrings[0], textStrings[1])
                    });
                    return;
                }
            } catch {}
        }
    }
}
