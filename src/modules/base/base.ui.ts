import {EmbedBuilder} from "discord.js";
import {UtilsGeneratorEmbed} from "../../utils/generators/utils.generator.embed";

export class ModuleBaseUI {
    public error(title: string, description: string): EmbedBuilder[] {
        return UtilsGeneratorEmbed.getSingle(title, "#FF0000", description);
    }

    public notify(title: string, description: string): EmbedBuilder[] {
        return UtilsGeneratorEmbed.getSingle(title, "#55FF55", description);
    }

    public static unknownError(title: string, errorLog: string): EmbedBuilder[] {
        return UtilsGeneratorEmbed.getSingle(title, "#AA0000", errorLog);
    }
}
