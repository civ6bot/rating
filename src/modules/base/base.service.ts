import {DatabaseServiceConfig} from "../../database/services/service.Config";
import {DatabaseServiceText} from "../../database/services/service.Text";
import {ButtonInteraction, CommandInteraction, ModalSubmitInteraction, StringSelectMenuInteraction} from "discord.js";
import {EntityConfig} from "../../database/entities/entity.Config";

export class ModuleBaseService {
    protected databaseServiceConfig: DatabaseServiceConfig = new DatabaseServiceConfig();
    protected databaseServiceText: DatabaseServiceText = new DatabaseServiceText();

    protected async getOneSettingString(
        interaction: CommandInteraction | ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction | string,
        setting: string
    ): Promise<string> {
        return (typeof interaction === "string")
            ? await this.databaseServiceConfig.getOneString(interaction as string, setting)
            : await this.databaseServiceConfig.getOneString(interaction.guild?.id as string, setting);
    }

    protected async getManySettingString(
        interaction: CommandInteraction | ButtonInteraction | ModalSubmitInteraction | string,
        ...settings: string[]
    ): Promise<string[]> {
        return (typeof interaction === "string")
            ? await this.databaseServiceConfig.getManyString(interaction as string, settings)
            : await this.databaseServiceConfig.getManyString(interaction.guild?.id as string, settings);
    }

    protected async updateManySetting(
        interaction: CommandInteraction | ButtonInteraction | ModalSubmitInteraction,
        configTags: string[],
        configValues: string[]
    ): Promise<boolean> {
        return await this.databaseServiceConfig.insertAll(
            configTags.map((tag: string, index: number): EntityConfig => {
                return {
                    guildID: interaction.guild?.id as string,
                    setting: configTags[index],
                    value: String(configValues[index])
                };
            })
        );
    }

    protected async getOneSettingNumber(
        interaction: CommandInteraction | ButtonInteraction | ModalSubmitInteraction | string,
        setting: string
    ): Promise<number> {
        return (typeof interaction === "string")
            ? await this.databaseServiceConfig.getOneNumber(interaction as string, setting)
            : await this.databaseServiceConfig.getOneNumber(interaction.guild?.id as string, setting);
    }

    protected async getManySettingNumber(
        interaction: CommandInteraction | ButtonInteraction | ModalSubmitInteraction | string,
        ...settings: string[]
    ): Promise<number[]> {

        return (typeof interaction === "string")
            ? await this.databaseServiceConfig.getManyNumber(interaction as string, settings)
            : await this.databaseServiceConfig.getManyNumber(interaction.guild?.id as string, settings);
    }

    protected async getOneText(
        interaction_lang: CommandInteraction | ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction | string,
        tag: string,
        ...args: (string|number)[]
    ): Promise<string> {
        return await this.databaseServiceText.getOne(
            (typeof interaction_lang === 'string')
                ? interaction_lang as string
                : (await this.getOneSettingString(interaction_lang, "BASE_LANGUAGE")),
            tag, args
        );
    }

    protected async getManyText(
        interaction: CommandInteraction | ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction | string,
        tags: string[],
        args: (((string|number)[])|null)[] = []
    ): Promise<string[]> {
        let lang: string = await this.getOneSettingString(interaction, "BASE_LANGUAGE");
        return this.databaseServiceText.getMany(lang, tags, args);
    }
}
