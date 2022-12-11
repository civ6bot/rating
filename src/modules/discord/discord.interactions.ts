import { CommandInteraction } from "discord.js";
import {ArgsOf, Client, Discord, On, Once, Slash} from "discordx";
import {DiscordService} from "./discord.service";

@Discord()
export abstract class DiscordEvents {
    private discordService: DiscordService = new DiscordService();

    @Slash({ name: "about", description: "Bot information" })
    public async about(
        interaction: CommandInteraction
    ) { await this.discordService.about(interaction); }

    // Особое событие
    // не передавать управление в DiscordService
    @On({event: "interactionCreate"})
    public async onInteractionCreate([interaction]: ArgsOf<"interactionCreate">, client: Client) {
        client.executeInteraction(interaction);
    }

    @Once({event: "ready"})
    public async onceReady([clientArg]: ArgsOf<"ready">, client: Client) {
        await this.discordService.onceReady(client);
    }

    @On({event: "guildCreate"})
    public async onGuildCreate([guild]: ArgsOf<"guildCreate">, client: Client) {
        await this.discordService.onGuildCreate(guild);
    }
}
