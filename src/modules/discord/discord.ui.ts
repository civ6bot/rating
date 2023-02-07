import { ColorResolvable, EmbedBuilder } from "discord.js";
import { UtilsGeneratorEmbed } from "../../utils/generators/utils.generator.embed";
import { ModuleBaseUI } from "../base/base.ui";

export class DiscordUI extends ModuleBaseUI {
    public onGuildCreate(
        title: string,
        color: string,
        description: string,
        thumbnailImageURL: string
    ): EmbedBuilder[] {
        return UtilsGeneratorEmbed.getSingle(
            title,
            color as ColorResolvable,
            description,
            [],
            null,
            null,
            thumbnailImageURL
        );
    }
}
