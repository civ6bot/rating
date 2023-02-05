import {DatabaseServiceConfig} from "../../database/services/service.Config";
import {DatabaseServiceText} from "../../database/services/service.Text";
import {ButtonInteraction, CommandInteraction, GuildMember, ModalSubmitInteraction, StringSelectMenuInteraction} from "discord.js";
import {EntityConfig} from "../../database/entities/entity.Config";
import {UtilsServiceUsers} from "../../utils/services/utils.service.users";

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
        interaction: CommandInteraction | ButtonInteraction | ModalSubmitInteraction | StringSelectMenuInteraction | string,
        ...settings: string[]
    ): Promise<string[]> {
        return (typeof interaction === "string")
            ? await this.databaseServiceConfig.getManyString(interaction as string, settings)
            : await this.databaseServiceConfig.getManyString(interaction.guild?.id as string, settings);
    }

    protected async updateManySetting(
        interaction: CommandInteraction | ButtonInteraction | ModalSubmitInteraction | StringSelectMenuInteraction | string,
        configTags: string[],
        configValues: string[]
    ): Promise<boolean> {
        return await this.databaseServiceConfig.insertAll(
            configTags.map((tag: string, index: number): EntityConfig => {
                return {
                    guildID: (typeof interaction === "string") ? interaction : interaction.guild?.id as string,
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
        let lang: string = await this.getOneSettingString(interaction_lang, "BASE_LANGUAGE");
        let textValue: string = await this.databaseServiceText.getOne(lang, tag, args);
        if(textValue === tag) {
            let defaultLang: string = await this.getOneSettingString("DEFAULT", "BASE_LANGUAGE");
            if(lang !== defaultLang)
                textValue = await this.databaseServiceText.getOne(defaultLang, tag, args);
        }
        return textValue;
    }

    protected async getManyText(
        interaction: CommandInteraction | ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction | string,
        tags: string[],
        args: (((string|number)[])|null)[] = []
    ): Promise<string[]> {
        let lang: string = await this.getOneSettingString(interaction, "BASE_LANGUAGE");
        let textValues: string[] = await this.databaseServiceText.getMany(lang, tags, args);
        let defaultLang: string = "";
        for(let i in textValues) {
            if(textValues[i] === tags[i]) {
                if(defaultLang.length === 0)
                    defaultLang = await this.getOneSettingString("DEFAULT", "BASE_LANGUAGE");
                if(lang !== defaultLang)
                    textValues[i] = await this.databaseServiceText.getOne(defaultLang, tags[i], (args[i] || []));
            }
        }
        return textValues;
    }

    protected async isModerator(interaction: CommandInteraction | ButtonInteraction | ModalSubmitInteraction | StringSelectMenuInteraction | GuildMember): Promise<boolean> {
        let member: GuildMember = (interaction.constructor.name === "GuildMember")
            ? interaction as GuildMember
            : (interaction as CommandInteraction | ButtonInteraction | ModalSubmitInteraction | StringSelectMenuInteraction).member as GuildMember;
        if(UtilsServiceUsers.isAdmin(member))
            return true;
        let moderationRolesID: string[] = (await this.getOneSettingString(
            member.guild.id, "MODERATION_ROLE_MODERATORS_ID"
        )).split(" ");
        return member.roles.cache.some((value, key) => (moderationRolesID.indexOf(key) !== -1));
    }
}
