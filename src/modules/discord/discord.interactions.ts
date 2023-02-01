import { CommandInteraction } from "discord.js";
import {ArgsOf, Client, Discord, On, Once, Slash} from "discordx";
import {DiscordService} from "./discord.service";

@Discord()
export abstract class DiscordEvents {
    private discordService: DiscordService = new DiscordService();

    @On({event: "interactionCreate"})
    public async onInteractionCreate([interaction]: ArgsOf<"interactionCreate">, client: Client) {
        this.discordService.onInteractionCreate(interaction, client);
    }

    @Slash({ name: "about", description: "Bot information" })
    public async about(
        interaction: CommandInteraction
    ) { this.discordService.about(interaction); }

    @Once({event: "ready"})
    public async onceReady([clientArg]: ArgsOf<"ready">, client: Client) {
        this.discordService.onceReady(client);
    }

    @On({event: "guildCreate"})
    public async onGuildCreate([guild]: ArgsOf<"guildCreate">, client: Client) {
        this.discordService.onGuildCreate(guild);
    }
}
