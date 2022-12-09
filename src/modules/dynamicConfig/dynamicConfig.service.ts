import {ModuleBaseService} from "../base/base.service";
import {ButtonInteraction, CommandInteraction, GuildMember, ModalSubmitInteraction, SelectMenuInteraction, TextInputStyle} from "discord.js";
import {DynamicConfigUI} from "./dynamicConfig.ui";
import {
    DynamicConfig,
    DynamicConfigEntity,
    DynamicConfigEntityBoolean,
    DynamicConfigEntityBooleanGameSetting,
    DynamicConfigEntityBooleanLanguage,
    DynamicConfigEntityChannelMany,
    DynamicConfigEntityNumber,
    DynamicConfigEntityNumberMany,
    DynamicConfigEntityNumberTimeSeconds,
    DynamicConfigEntityRoleMany,
    DynamicConfigEntityString,
    DynamicConfigEntityTeamersForbiddenPairs
} from "./dynamicConfig.models";
import {
    JSONDynamicConfigEntityBoolean,
    JSONDynamicConfigEntityBooleanGameSetting,
    JSONDynamicConfigEntityBooleanLanguage,
    JSONDynamicConfigEntityChannelMany,
    JSONDynamicConfigEntityNumber,
    JSONDynamicConfigEntityNumberMany, JSONDynamicConfigEntityNumberTimeSeconds,
    JSONDynamicConfigEntityRoleMany,
    JSONDynamicConfigEntityString,
    JSONDynamicConfigEntityTeamersForbiddenPairs
} from "../../types/type.JSON.DynamicConfigEntities";
import {UtilsServiceCivilizations} from "../../utils/services/utils.service.civilizations";
import {UtilsServiceUsers} from "../../utils/services/utils.service.users";
import {DatabaseServiceText} from "../../database/services/service.Text";
import {tagsMap, configsMap} from "./dynamicConfig.dictionaries";

export class DynamicConfigService extends ModuleBaseService {
    private dynamicConfigUI: DynamicConfigUI = new DynamicConfigUI();

    public static dynamicConfigs: Map<string, DynamicConfig> = new Map<string, DynamicConfig>();    // guildID

    // нельзя использовать ModalSubmitInteraction
    private async checkDynamicConfigComponent(interaction: SelectMenuInteraction | ButtonInteraction, deferUpdate: boolean = true): Promise<DynamicConfig | undefined> {
        let dynamicConfig: DynamicConfig | undefined = DynamicConfigService.dynamicConfigs.get(interaction.guild?.id as string);
        if(!dynamicConfig) {
            await interaction.message.delete();
            return undefined;
        }
        if(!await this.isModerator(interaction)) {
            await interaction.deferUpdate();
            return undefined;
        }
        if(dynamicConfig.interaction.user.id !== interaction.user.id) {
            let textStrings = await this.getManyText(
                interaction,
                ["BASE_ERROR_TITLE", "DYNAMIC_CONFIG_ERROR_NOT_OWNER"],
            );
            await interaction.reply({embeds: this.dynamicConfigUI.error(textStrings[0], textStrings[1]), ephemeral: true});
            return undefined;
        }
        if(deferUpdate)
            await interaction.deferUpdate();
        return dynamicConfig;
    }

    private async sendDynamicConfigMessage(dynamicConfig: DynamicConfig, isNewMessage: boolean = false): Promise<void> {
        let textStrings: string[] = await this.getManyText(dynamicConfig.interaction, [
            dynamicConfig.getTitleTag()+"_EMOJI", dynamicConfig.getTitleTag(),
            "DYNAMIC_CONFIG_TITLE_PAGE", (dynamicConfig.isConfig)
                ? "DYNAMIC_CONFIG_CHOOSE_CONFIG_DESCRIPTION"
                : "DYNAMIC_CONFIG_CHOOSE_GROUP_DESCRIPTION",
            "DYNAMIC_CONFIG_DESCRIPTION_NO_VALUE"
        ]);
        let optionStrings: string[] = await this.getManyText(dynamicConfig.interaction, dynamicConfig.getOptionTags());
        let emojiStrings: string[];

        if(dynamicConfig.isConfig) {
            let emojiTags: string[] = dynamicConfig.getEmojiTags();
            let configs: DynamicConfigEntity[] = dynamicConfig.getLastChild().configs;
            emojiStrings = [];
            for(let i in configs) {
                emojiStrings.push(
                    (configs[i].type === "BooleanGameSetting")  // в этом типе конфигураций эмодзи не в конфиге, а в тексте
                        ? await this.getOneSettingString(dynamicConfig.interaction, emojiTags[i])
                        : (configs[i].type === "BooleanLanguage")    // в этом типе эмодзи нет
                            ? "" : await this.getOneText(dynamicConfig.interaction, emojiTags[i])
                );
            }
        } else
            emojiStrings = await this.getManyText(dynamicConfig.interaction, dynamicConfig.getEmojiTags());

        let buttonStrings: string[] = await this.getManyText(dynamicConfig.interaction, [
            "DYNAMIC_CONFIG_BUTTON_BACK", "DYNAMIC_CONFIG_BUTTON_FIRST",
            "DYNAMIC_CONFIG_BUTTON_PREVIOUS", "DYNAMIC_CONFIG_BUTTON_NEXT",
            "DYNAMIC_CONFIG_BUTTON_LAST", "DYNAMIC_CONFIG_BUTTON_RESET",
            "DYNAMIC_CONFIG_BUTTON_DELETE"
        ]);
        let placeholderString: string = await this.getOneText(dynamicConfig.interaction,
            (dynamicConfig.isConfig)
                ? "DYNAMIC_CONFIG_MENU_PLACEHOLDER_CONFIG"
                : "DYNAMIC_CONFIG_MENU_PLACEHOLDER_CATEGORY");
        if(isNewMessage)
            await dynamicConfig.interaction.reply({
                embeds: this.dynamicConfigUI.configEmbed(
                    dynamicConfig,
                    textStrings[0], textStrings[1], textStrings[2], textStrings[3],
                    emojiStrings,
                    optionStrings,
                    textStrings[4]
                ),
                components: [
                    ...this.dynamicConfigUI.configButtons(dynamicConfig, buttonStrings),
                    ...this.dynamicConfigUI.configMenu(placeholderString, optionStrings, emojiStrings)
                ]
            });
        else await dynamicConfig.interaction.editReply({
            embeds: this.dynamicConfigUI.configEmbed(
                dynamicConfig,
                textStrings[0], textStrings[1], textStrings[2], textStrings[3],
                emojiStrings,
                optionStrings,
                textStrings[4]
            ),
            components: [
                ...this.dynamicConfigUI.configButtons(dynamicConfig, buttonStrings),
                ...this.dynamicConfigUI.configMenu(placeholderString, optionStrings, emojiStrings)
            ]
        });
    }

    private async isModerator(interaction: CommandInteraction | ButtonInteraction | SelectMenuInteraction): Promise<boolean> {
        let member: GuildMember = interaction.member as GuildMember;
        if(UtilsServiceUsers.isAdmin(member))
            return true;
        let moderationRolesID: string[] = (await this.getOneSettingString(
            interaction, "MODERATION_ROLE_MODERATORS_ID"
        )).split(" ");
        return member.roles.cache.some((value, key) => (moderationRolesID.indexOf(key) !== -1));
    }

    protected updateTimeoutTimer(dynamicConfig: DynamicConfig): void {
        dynamicConfig.date = new Date();
        if(dynamicConfig.setTimeoutID !== null)
            clearTimeout(dynamicConfig.setTimeoutID);
        dynamicConfig.setTimeoutID = setTimeout(DynamicConfigService.timeoutFunction, dynamicConfig.lifeTimeMs);
    }

    private async updateOneDynamicConfigEntity(
        interaction: CommandInteraction | ButtonInteraction | ModalSubmitInteraction,
        entity: DynamicConfigEntity
    ): Promise<void> {
        return this.updateManyDynamicConfigEntity(interaction, [entity]);
    }

    private async resetManyDynamicConfigEntity(
        interaction: CommandInteraction | ButtonInteraction | ModalSubmitInteraction,
        entities: DynamicConfigEntity[]
    ): Promise<void> {
        for(let i in entities)
            switch (entities[i].type) {
                case "Number":
                    let dynamicConfigEntityNumber: DynamicConfigEntityNumber = entities[i] as DynamicConfigEntityNumber;
                    dynamicConfigEntityNumber.value = await this.getOneSettingNumber("DEFAULT", dynamicConfigEntityNumber.properties.configTag);
                    entities[i] = dynamicConfigEntityNumber;
                    break;
                case "String":
                    let dynamicConfigEntityString: DynamicConfigEntityString = entities[i] as DynamicConfigEntityString;
                    dynamicConfigEntityString.value = await this.getOneSettingString("DEFAULT", dynamicConfigEntityString.properties.configTag);
                    entities[i] = dynamicConfigEntityString;
                    break;
                case "Boolean":
                    let dynamicConfigEntityBoolean: DynamicConfigEntityBoolean = entities[i] as DynamicConfigEntityBoolean;
                    dynamicConfigEntityBoolean.value = Boolean(await this.getOneSettingNumber("DEFAULT", dynamicConfigEntityBoolean.properties.configTag));
                    entities[i] = dynamicConfigEntityBoolean;
                    break;
                case "BooleanGameSetting":
                    let dynamicConfigEntityBooleanGameSetting: DynamicConfigEntityBooleanGameSetting = entities[i] as DynamicConfigEntityBooleanGameSetting;
                    dynamicConfigEntityBooleanGameSetting.value = Boolean(await this.getOneSettingNumber("DEFAULT", dynamicConfigEntityBooleanGameSetting.properties.configTag));
                    entities[i] = dynamicConfigEntityBooleanGameSetting;
                    break;
                case "TeamersForbiddenPairs":
                    let dynamicConfigEntityTeamersForbiddenPairs: DynamicConfigEntityTeamersForbiddenPairs = entities[i] as DynamicConfigEntityTeamersForbiddenPairs;
                    dynamicConfigEntityTeamersForbiddenPairs.value = await this.getOneSettingString("DEFAULT", dynamicConfigEntityTeamersForbiddenPairs.properties.configTag);
                    entities[i] = dynamicConfigEntityTeamersForbiddenPairs;
                    break;
                case "NumberMany":
                    let dynamicConfigEntityNumberMany: DynamicConfigEntityNumberMany = entities[i] as DynamicConfigEntityNumberMany;
                    dynamicConfigEntityNumberMany.value = (await this.getOneSettingString("DEFAULT", dynamicConfigEntityNumberMany.properties.configTag))
                        .split(" ")
                        .map(str => Number(str));
                    entities[i] = dynamicConfigEntityNumberMany;
                    break;
                case "RoleMany":
                    let dynamicConfigEntityRoleMany: DynamicConfigEntityRoleMany = entities[i] as DynamicConfigEntityRoleMany;
                    dynamicConfigEntityRoleMany.value = (await this.getOneSettingString("DEFAULT", dynamicConfigEntityRoleMany.properties.configTag))
                        .split(" ")
                        .filter(str => str !== "");
                    entities[i] = dynamicConfigEntityRoleMany;
                    break;
                case "ChannelMany":
                    let dynamicConfigEntityChannelMany: DynamicConfigEntityChannelMany = entities[i] as DynamicConfigEntityChannelMany;
                    dynamicConfigEntityChannelMany.value = (await this.getOneSettingString("DEFAULT", dynamicConfigEntityChannelMany.properties.configTag))
                        .split(" ")
                        .filter(str => str !== "");
                    entities[i] = dynamicConfigEntityChannelMany;
                    break;
                case "NumberTimeSeconds":
                    let dynamicConfigEntityNumberTimeSeconds: DynamicConfigEntityNumberTimeSeconds = entities[i] as DynamicConfigEntityNumberTimeSeconds;
                    dynamicConfigEntityNumberTimeSeconds.value = await this.getOneSettingNumber("DEFAULT", dynamicConfigEntityNumberTimeSeconds.properties.configTag);
                    entities[i] = dynamicConfigEntityNumberTimeSeconds;
                    break;
            }
        await this.updateManyDynamicConfigEntity(interaction, entities);
    }

    private async updateManyDynamicConfigEntity(
        interaction: CommandInteraction | ButtonInteraction | ModalSubmitInteraction,
        entities: DynamicConfigEntity[]
    ): Promise<void> {
        let tags: string[] = [], values: string[] = [];
        for(let i in entities)
            switch (entities[i].type) {
                case "Number":
                    let dynamicConfigEntityNumber: DynamicConfigEntityNumber = entities[i] as DynamicConfigEntityNumber;
                    tags.push(dynamicConfigEntityNumber.properties.configTag);
                    values.push(String(dynamicConfigEntityNumber.value));
                    break;
                case "String":
                    let dynamicConfigEntityString: DynamicConfigEntityString = entities[i] as DynamicConfigEntityString;
                    tags.push(dynamicConfigEntityString.properties.configTag);
                    values.push(String(dynamicConfigEntityString.value));
                    break;
                case "Boolean":
                    let dynamicConfigEntityBoolean: DynamicConfigEntityBoolean = entities[i] as DynamicConfigEntityBoolean;
                    tags.push(dynamicConfigEntityBoolean.properties.configTag);
                    values.push(String(Number(dynamicConfigEntityBoolean.value)));
                    break;
                case "BooleanGameSetting":
                    let dynamicConfigEntityBooleanGameSetting: DynamicConfigEntityBooleanGameSetting = entities[i] as DynamicConfigEntityBooleanGameSetting;
                    tags.push(dynamicConfigEntityBooleanGameSetting.properties.configTag);
                    values.push(String(Number(dynamicConfigEntityBooleanGameSetting.value)));
                    break;
                case "TeamersForbiddenPairs":
                    let dynamicConfigEntityTeamersForbiddenPairs: DynamicConfigEntityTeamersForbiddenPairs = entities[i] as DynamicConfigEntityTeamersForbiddenPairs;
                    tags.push(dynamicConfigEntityTeamersForbiddenPairs.properties.configTag);
                    values.push(String(dynamicConfigEntityTeamersForbiddenPairs.value));
                    break;
                case "BooleanLanguage":
                    let dynamicConfigEntityBooleanLanguage: DynamicConfigEntityBooleanLanguage = entities[i] as DynamicConfigEntityBooleanLanguage;
                    tags.push(dynamicConfigEntityBooleanLanguage.properties.configTag);
                    values.push(dynamicConfigEntityBooleanLanguage.properties.textTag);
                    break;
                case "NumberMany":
                    let dynamicConfigEntityNumberMany: DynamicConfigEntityNumberMany = entities[i] as DynamicConfigEntityNumberMany;
                    tags.push(dynamicConfigEntityNumberMany.properties.configTag);
                    values.push(dynamicConfigEntityNumberMany.value.join(" "));
                    break;
                case "RoleMany":
                    let dynamicConfigEntityRoleMany: DynamicConfigEntityRoleMany = entities[i] as DynamicConfigEntityRoleMany;
                    tags.push(dynamicConfigEntityRoleMany.properties.configTag);
                    values.push(dynamicConfigEntityRoleMany.value.join(" "));
                    break;
                case "ChannelMany":
                    let dynamicConfigEntityChannelMany: DynamicConfigEntityChannelMany = entities[i] as DynamicConfigEntityChannelMany;
                    tags.push(dynamicConfigEntityChannelMany.properties.configTag);
                    values.push(dynamicConfigEntityChannelMany.value.join(" "));
                    break;
                case "NumberTimeSeconds":
                    let dynamicConfigEntityNumberTimeSeconds: DynamicConfigEntityNumberTimeSeconds = entities[i] as DynamicConfigEntityNumberTimeSeconds;
                    tags.push(dynamicConfigEntityNumberTimeSeconds.properties.configTag);
                    values.push(String(dynamicConfigEntityNumberTimeSeconds.value*1000));
                    break;
            }
        await this.updateManySetting(interaction, tags, values);
    }

    private async createDynamicConfigEntities(
        jsonEntities: (
            JSONDynamicConfigEntityNumber
            |JSONDynamicConfigEntityString
            |JSONDynamicConfigEntityBoolean
            |JSONDynamicConfigEntityTeamersForbiddenPairs
            |JSONDynamicConfigEntityBooleanGameSetting
            |JSONDynamicConfigEntityNumberMany
            |JSONDynamicConfigEntityRoleMany
            |JSONDynamicConfigEntityChannelMany
            |JSONDynamicConfigEntityNumberTimeSeconds
            )[],
        dynamicConfig: DynamicConfig
    ): Promise<DynamicConfigEntity[]> {
        let dynamicConfigEntities: DynamicConfigEntity[] = [];
        for(let config of jsonEntities)
            switch (config.type) {
                case "Number":
                    dynamicConfigEntities.push(new DynamicConfigEntityNumber(
                        config as JSONDynamicConfigEntityNumber,
                        await this.getOneSettingNumber(dynamicConfig.interaction, config.configTag)
                    ));
                    break;
                case "String":
                    dynamicConfigEntities.push(new DynamicConfigEntityString(
                        config as JSONDynamicConfigEntityString,
                        await this.getOneSettingString(dynamicConfig.interaction, config.configTag)
                    ));
                    break;
                case "Boolean":
                    dynamicConfigEntities.push(new DynamicConfigEntityBoolean(
                        config as JSONDynamicConfigEntityBoolean,
                        !!(await this.getOneSettingNumber(dynamicConfig.interaction, config.configTag))
                    ));
                    break;
                case "TeamersForbiddenPairs":
                    dynamicConfigEntities.push(new DynamicConfigEntityTeamersForbiddenPairs(
                        config as JSONDynamicConfigEntityTeamersForbiddenPairs,
                        await this.getOneSettingString(dynamicConfig.interaction, config.configTag),
                        await this.getManyText(
                            dynamicConfig.interaction,
                            UtilsServiceCivilizations.civilizationsTags.map(tag => tag+"_TEXT")
                        )
                    ));
                    break;
                case "BooleanGameSetting":
                    dynamicConfigEntities.push(new DynamicConfigEntityBooleanGameSetting(
                        config as JSONDynamicConfigEntityBooleanGameSetting,
                        !!(await this.getOneSettingNumber(dynamicConfig.interaction, config.configTag)),
                        dynamicConfig
                    ));
                    break;
                case "BooleanLanguage":
                    dynamicConfigEntities.push(new DynamicConfigEntityBooleanLanguage(
                        config as JSONDynamicConfigEntityBooleanLanguage,
                        (await this.getOneSettingString(dynamicConfig.interaction, config.configTag) === (config as JSONDynamicConfigEntityBooleanLanguage).textTag),
                        dynamicConfig
                    ));
                    break;
                case "NumberMany":
                    dynamicConfigEntities.push(new DynamicConfigEntityNumberMany(
                        config as JSONDynamicConfigEntityNumberMany,
                        await this.getOneSettingString(dynamicConfig.interaction, config.configTag)
                    ));
                    break;
                case "RoleMany":
                    dynamicConfigEntities.push(new DynamicConfigEntityRoleMany(
                        config as JSONDynamicConfigEntityRoleMany,
                        await this.getOneSettingString(dynamicConfig.interaction, config.configTag)
                    ));
                    break;
                case "ChannelMany":
                    dynamicConfigEntities.push(new DynamicConfigEntityChannelMany(
                        config as JSONDynamicConfigEntityChannelMany,
                        await this.getOneSettingString(dynamicConfig.interaction, config.configTag)
                    ));
                    break;
                case "NumberTimeSeconds":
                    dynamicConfigEntities.push(new DynamicConfigEntityNumberTimeSeconds(
                        config as JSONDynamicConfigEntityNumberTimeSeconds,
                        await this.getOneSettingNumber(dynamicConfig.interaction, config.configTag)
                    ));
                    break;
                default:
                    console.log("Type not found:", config.type);
                    break;
            }
        return dynamicConfigEntities;
    }

    //dynamicConfig-menu
    //values=numbers i
    public async config(interaction: CommandInteraction) {
        if(!await this.isModerator(interaction)) {
            let textStrings = await this.getManyText(
                interaction,
                ["BASE_ERROR_TITLE", "DYNAMIC_CONFIG_ERROR_COMMAND_NOT_ADMIN"],
            );
            return await interaction.reply({embeds: this.dynamicConfigUI.error(textStrings[0], textStrings[1]), ephemeral: true});
        }
        let key: string = interaction.guild?.id as string;
        let dynamicConfig: DynamicConfig | undefined = DynamicConfigService.dynamicConfigs.get(key);
        if(!dynamicConfig) {
            let entitiesPerPage: number = await this.getOneSettingNumber(interaction, "DYNAMIC_CONFIG_PAGINATION_SIZE");
            let optionsTags: string[] = tagsMap.get("DYNAMIC_CONFIG_TITLE") || [];
            let lifeTimeMs: number = await this.getOneSettingNumber(interaction, "DYNAMIC_CONFIG_LIFE_TIME_MS");
            dynamicConfig = new DynamicConfig(interaction, entitiesPerPage, lifeTimeMs, "DYNAMIC_CONFIG_TITLE", optionsTags);
            DynamicConfigService.dynamicConfigs.set(key, dynamicConfig);
        } else {
            try {
                await dynamicConfig.interaction.deleteReply();
            } catch {}
            dynamicConfig.interaction = interaction;
        }
        this.updateTimeoutTimer(dynamicConfig);
        await this.sendDynamicConfigMessage(dynamicConfig, true);
    }

    // dynamicConfig-modal
    // UtilsGeneratorModal
    // Может вызвать другое меню (изменение сообщения)
    // или модальное окно
    public async menu(interaction: SelectMenuInteraction) {
        let dynamicConfig: DynamicConfig | undefined = await this.checkDynamicConfigComponent(interaction, false);
        if(!dynamicConfig)
            return;

        let valueIndex: number = Number(interaction.values[0]);
        if(Number.isNaN(valueIndex))
            return await interaction.deferUpdate();
        let option: string | undefined = dynamicConfig.getOptionTags()[valueIndex];
        if(!option)
            return await interaction.deferUpdate();
        this.updateTimeoutTimer(dynamicConfig);

        // Новая категория
        let categories: string[] | undefined = tagsMap.get(dynamicConfig.getOptionTags()[valueIndex]);
        if(categories) {
            await interaction.deferUpdate();
            dynamicConfig.createChild(valueIndex, categories);
            await this.sendDynamicConfigMessage(dynamicConfig);
            dynamicConfig.date = new Date();
            dynamicConfig.setTimeoutID = setTimeout(DynamicConfigService.timeoutFunction, dynamicConfig.lifeTimeMs);
            return;
        }

        // Последняя категория, получили конфигурацию
        let configs: (JSONDynamicConfigEntityNumber
                |JSONDynamicConfigEntityString
                |JSONDynamicConfigEntityBoolean
                |JSONDynamicConfigEntityBooleanGameSetting
                |JSONDynamicConfigEntityTeamersForbiddenPairs
                |JSONDynamicConfigEntityBooleanLanguage
                |JSONDynamicConfigEntityNumberMany
                |JSONDynamicConfigEntityRoleMany
                |JSONDynamicConfigEntityChannelMany
                |JSONDynamicConfigEntityNumberTimeSeconds
                )[]
            |undefined = configsMap.get(dynamicConfig.getOptionTags()[valueIndex]);
        // Настройка для изменения языка, нужно смотреть локальную БД для отображения списка
        if(dynamicConfig.getOptionTags()[valueIndex] === "DYNAMIC_CONFIG_LANGUAGE")
            configs = (await DatabaseServiceText.getLanguages()).map((language: string): JSONDynamicConfigEntityBooleanGameSetting => { return {
                configTag: "BASE_LANGUAGE",
                textTag: language,
                type: "BooleanLanguage",
            }});
        // Если это действительно последняя подкатегория перед настройками, то вывести
        if(configs) {
            await interaction.deferUpdate();
            // Если все Boolean, то отсортировать
            if(configs.every(config => config.type === "Boolean"))
                configs = (await this.getManyText(
                    dynamicConfig.interaction, configs.map(config => config.textTag)
                )).map((text: string, index: number): {text: string, config: JSONDynamicConfigEntityBoolean} => {
                    return {text: text, config: configs?.[index] as JSONDynamicConfigEntityBoolean}
                }).sort((
                        a: {text: string, config: JSONDynamicConfigEntityBoolean},
                        b: {text: string, config: JSONDynamicConfigEntityBoolean}
                    ) =>
                        a.text.localeCompare(b.text)
                ).map(pair => pair.config);
            let dynamicConfigEntities: DynamicConfigEntity[] = await this.createDynamicConfigEntities(configs, dynamicConfig);
            dynamicConfig.createChild(valueIndex, [], dynamicConfigEntities);
            await this.sendDynamicConfigMessage(dynamicConfig);
            return;
        }

        let dynamicConfigEntity: DynamicConfigEntity | undefined = dynamicConfig.getLastChild().configs[valueIndex];
        if(!dynamicConfigEntity)
            return;

        // ================================
        
        // Вызов изменения конфигурации для булевых значений
        if(dynamicConfigEntity.type === "Boolean") {
            let dynamicConfigEntityBoolean: DynamicConfigEntityBoolean = dynamicConfigEntity as DynamicConfigEntityBoolean;
            dynamicConfigEntityBoolean.check(String(!dynamicConfigEntityBoolean.value));
            await this.updateOneDynamicConfigEntity(dynamicConfig.interaction, dynamicConfigEntityBoolean);
            await interaction.deferUpdate();
            await this.sendDynamicConfigMessage(dynamicConfig);
            return;
        }

        // Вызов изменения конфигурации для булевых значений настроек игры
        if(dynamicConfigEntity.type === "BooleanGameSetting") {
            let dynamicConfigEntityBooleanGameSetting: DynamicConfigEntityBooleanGameSetting = dynamicConfigEntity as DynamicConfigEntityBooleanGameSetting;
            if(!dynamicConfigEntityBooleanGameSetting.check(String(!dynamicConfigEntityBooleanGameSetting.value))) {
                let textStrings: string[] = await this.getManyText(dynamicConfig.interaction, [
                    "BASE_ERROR_TITLE", "DYNAMIC_CONFIG_ERROR_TYPE_BOOLEAN_GAME_SETTING"
                ]);
                await interaction.reply({embeds: this.dynamicConfigUI.error(textStrings[0], textStrings[1]), ephemeral: true});
                return;
            }
            await this.updateOneDynamicConfigEntity(dynamicConfig.interaction, dynamicConfigEntityBooleanGameSetting);
            await interaction.deferUpdate();
            await this.sendDynamicConfigMessage(dynamicConfig);
            return;
        }

        // Вызов изменения конфигурации для настроек языка
        if(dynamicConfigEntity.type === "BooleanLanguage") {
            let dynamicConfigEntityBooleanLanguage: DynamicConfigEntityBooleanLanguage = dynamicConfigEntity as DynamicConfigEntityBooleanLanguage;
            dynamicConfigEntityBooleanLanguage.check("true");
            await this.updateOneDynamicConfigEntity(dynamicConfig.interaction, dynamicConfigEntityBooleanLanguage);
            await interaction.deferUpdate();
            await this.sendDynamicConfigMessage(dynamicConfig);
            return;
        }

        // Модальные окна для изменения не-булевых значений
        if(dynamicConfigEntity.type === "Number") {
            let dynamicConfigEntityNumber: DynamicConfigEntityNumber = dynamicConfigEntity as DynamicConfigEntityNumber;
            let textStrings: string[] = await this.getManyText(dynamicConfig.interaction, [
                dynamicConfigEntityNumber.properties.textTag, dynamicConfigEntityNumber.properties.textTag+"_EMOJI",
                "DYNAMIC_CONFIG_MODAL_LABEL"
            ]);
            await interaction.showModal(this.dynamicConfigUI.configModal(
                `${textStrings[1] + " "}${textStrings[0]}`,
                String(valueIndex),
                textStrings[2],
                dynamicConfigEntity.stringifiedValue
            ));
            return;
        }

        if(dynamicConfigEntity.type === "String") {
            let dynamicConfigEntityString: DynamicConfigEntityString = dynamicConfigEntity as DynamicConfigEntityString;
            let textStrings: string[] = await this.getManyText(dynamicConfig.interaction, [
                dynamicConfigEntityString.properties.textTag, dynamicConfigEntityString.properties.textTag+"_EMOJI",
                "DYNAMIC_CONFIG_MODAL_LABEL"
            ]);
            await interaction.showModal(this.dynamicConfigUI.configModal(
                `${textStrings[1] + " "}${textStrings[0]}`,
                String(valueIndex),
                textStrings[2],
                dynamicConfigEntity.stringifiedValue
            ));
            return;
        }

        if(dynamicConfigEntity.type === "TeamersForbiddenPairs") {
            let dynamicConfigEntityEntityTeamersForbiddenPairs: DynamicConfigEntityTeamersForbiddenPairs = dynamicConfigEntity as DynamicConfigEntityTeamersForbiddenPairs;
            let textStrings: string[] = await this.getManyText(dynamicConfig.interaction, [
                dynamicConfigEntityEntityTeamersForbiddenPairs.properties.textTag,
                dynamicConfigEntityEntityTeamersForbiddenPairs.properties.textTag+"_EMOJI",
                "DYNAMIC_CONFIG_MODAL_LABEL"
            ]);
            await interaction.showModal(this.dynamicConfigUI.configModal(
                `${textStrings[1] + " "}${textStrings[0]}`,
                String(valueIndex),
                textStrings[2],
                dynamicConfigEntityEntityTeamersForbiddenPairs.civilizationPairIndexes
                    .map((value: number[]): string =>
                        `${dynamicConfigEntityEntityTeamersForbiddenPairs.civilizationTexts[value[0]]}, ${dynamicConfigEntityEntityTeamersForbiddenPairs.civilizationTexts[value[1]]}`)
                    .join("\n")
                    .replaceAll(/<.+?>/g, "-"),     // ? означает ленивый поиск в JS-regex
                true,
                true
            ));
            return;
        }

        if(dynamicConfigEntity.type === "NumberMany") {
            let dynamicConfigEntityNumberMany: DynamicConfigEntityNumberMany = dynamicConfigEntity as DynamicConfigEntityNumberMany;
            let textStrings: string[] = await this.getManyText(dynamicConfig.interaction, [
                dynamicConfigEntityNumberMany.properties.textTag, dynamicConfigEntityNumberMany.properties.textTag+"_EMOJI",
                "DYNAMIC_CONFIG_MODAL_LABEL"
            ]);
            await interaction.showModal(this.dynamicConfigUI.configModal(
                `${textStrings[1] + " "}${textStrings[0]}`,
                String(valueIndex),
                textStrings[2],
                dynamicConfigEntityNumberMany.value.join(" ")
            ));
            return;
        }

        if(dynamicConfigEntity.type === "RoleMany") {
            let dynamicConfigEntityRoleMany: DynamicConfigEntityRoleMany = dynamicConfigEntity as DynamicConfigEntityRoleMany;
            let textStrings: string[] = await this.getManyText(dynamicConfig.interaction, [
                dynamicConfigEntityRoleMany.properties.textTag, dynamicConfigEntityRoleMany.properties.textTag+"_EMOJI",
                "DYNAMIC_CONFIG_MODAL_LABEL"
            ]);
            await interaction.showModal(this.dynamicConfigUI.configModal(
                `${textStrings[1] + " "}${textStrings[0]}`,
                String(valueIndex),
                textStrings[2],
                dynamicConfigEntityRoleMany.value.join(" "),
                false,
                true
            ));
            return;
        }

        if(dynamicConfigEntity.type === "ChannelMany") {
            let dynamicConfigEntityChannelMany: DynamicConfigEntityChannelMany = dynamicConfigEntity as DynamicConfigEntityChannelMany;
            let textStrings: string[] = await this.getManyText(dynamicConfig.interaction, [
                dynamicConfigEntityChannelMany.properties.textTag, dynamicConfigEntityChannelMany.properties.textTag+"_EMOJI",
                "DYNAMIC_CONFIG_MODAL_LABEL"
            ]);
            await interaction.showModal(this.dynamicConfigUI.configModal(
                `${textStrings[1] + " "}${textStrings[0]}`,
                String(valueIndex),
                textStrings[2],
                dynamicConfigEntityChannelMany.value.join(" "),
                false,
                true
            ));
            return;
        }

        if(dynamicConfigEntity.type === "NumberTimeSeconds") {
            let dynamicConfigEntityNumberTimeSeconds: DynamicConfigEntityNumberTimeSeconds = dynamicConfigEntity as DynamicConfigEntityNumberTimeSeconds;
            let textStrings: string[] = await this.getManyText(dynamicConfig.interaction, [
                dynamicConfigEntityNumberTimeSeconds.properties.textTag, dynamicConfigEntityNumberTimeSeconds.properties.textTag+"_EMOJI",
                "DYNAMIC_CONFIG_MODAL_LABEL"
            ]);
            await interaction.showModal(this.dynamicConfigUI.configModal(
                `${textStrings[1] + " "}${textStrings[0]}`,
                String(valueIndex),
                textStrings[2],
                dynamicConfigEntity.stringifiedValue
            ));
            return;
        }

        // Если ничего не совпало, то ничего не делать
        await interaction.reply({content: `Menu is not implemented. Index=${valueIndex}.`, ephemeral: true});
    }

    public async modalSetting(interaction: ModalSubmitInteraction) {
        let index: number = Number(Array.from(interaction.fields.fields.keys())[0]),
            value: string = Array.from(interaction.fields.fields.values())[0].value;

        let dynamicConfig: DynamicConfig | undefined = DynamicConfigService.dynamicConfigs.get(interaction.guild?.id as string);
        let dynamicConfigEntity: DynamicConfigEntity | undefined = dynamicConfig?.getLastChild().configs[index];
        if(!dynamicConfig || !dynamicConfigEntity) {
            let textStrings: string[] = await this.getManyText(interaction, [
                "BASE_ERROR_TITLE", "DYNAMIC_CONFIG_ERROR_FAIL_TIMEOUT"
            ]);
            return await interaction.reply({embeds: this.dynamicConfigUI.error(textStrings[0], textStrings[1]), ephemeral: true});
        }
        this.updateTimeoutTimer(dynamicConfig);

        // ================================

        if(dynamicConfigEntity.type === "Number") {
            let dynamicConfigEntityNumber: DynamicConfigEntityNumber = dynamicConfigEntity as DynamicConfigEntityNumber;
            if(!dynamicConfigEntityNumber.check(value)) {
                let textStrings: string[] = await this.getManyText(interaction, [
                    "BASE_ERROR_TITLE", "DYNAMIC_CONFIG_ERROR_TYPE_NUMBER"], [
                    null, [dynamicConfigEntityNumber.properties.minValue, dynamicConfigEntityNumber.properties.maxValue]
                ]);
                await interaction.reply({embeds: this.dynamicConfigUI.error(textStrings[0], textStrings[1]), ephemeral: true});
                await this.sendDynamicConfigMessage(dynamicConfig);
                return;
            }
            await this.updateOneDynamicConfigEntity(interaction, dynamicConfigEntityNumber);
            await interaction.deferUpdate();
            await this.sendDynamicConfigMessage(dynamicConfig);
            return;
        }

        if(dynamicConfigEntity.type === "String") {
            let dynamicConfigEntityString: DynamicConfigEntityString = dynamicConfigEntity as DynamicConfigEntityString;
            if(!dynamicConfigEntityString.check(value)) {
                let textStrings: string[] = await this.getManyText(interaction, [
                    "BASE_ERROR_TITLE", "DYNAMIC_CONFIG_ERROR_TYPE_STRING"]);
                await interaction.reply({embeds: this.dynamicConfigUI.error(textStrings[0], textStrings[1]), ephemeral: true});
                await this.sendDynamicConfigMessage(dynamicConfig);
                return;
            }
            await this.updateOneDynamicConfigEntity(interaction, dynamicConfigEntityString);
            await interaction.deferUpdate();
            await this.sendDynamicConfigMessage(dynamicConfig);
            return;
        }

        if(dynamicConfigEntity.type === "TeamersForbiddenPairs") {
            let dynamicConfigEntityEntityTeamersForbiddenPairs: DynamicConfigEntityTeamersForbiddenPairs = dynamicConfigEntity as DynamicConfigEntityTeamersForbiddenPairs;
            if(!dynamicConfigEntityEntityTeamersForbiddenPairs.check(value)) {
                let textStrings: string[] = [await this.getOneText(interaction, "BASE_ERROR_TITLE")];
                if(dynamicConfigEntityEntityTeamersForbiddenPairs.civilizationErrorIndexes.length === 1)
                    textStrings.push(await this.getOneText(interaction, "DYNAMIC_CONFIG_ERROR_TYPE_TEAMERS_FORBIDDEN_PAIRS_SAME_IN_PAIR",
                        dynamicConfigEntityEntityTeamersForbiddenPairs.civilizationTexts[dynamicConfigEntityEntityTeamersForbiddenPairs.civilizationErrorIndexes[0]],
                        value
                    ));
                else if(dynamicConfigEntityEntityTeamersForbiddenPairs.civilizationErrorIndexes.length === 3)
                    textStrings.push(await this.getOneText(interaction, "DYNAMIC_CONFIG_ERROR_TYPE_TEAMERS_FORBIDDEN_PAIRS_TRIANGLE",
                            dynamicConfigEntityEntityTeamersForbiddenPairs.civilizationErrorIndexes.map((value: number): string =>
                                dynamicConfigEntityEntityTeamersForbiddenPairs.civilizationTexts[value]).join("\n"),
                            value
                        )
                    );
                else textStrings.push(await this.getOneText(interaction, "DYNAMIC_CONFIG_ERROR_TYPE_TEAMERS_FORBIDDEN_PAIRS_PARSE", value));
                await interaction.reply({embeds: this.dynamicConfigUI.error(textStrings[0], textStrings[1]), ephemeral: true});
                await this.sendDynamicConfigMessage(dynamicConfig);
                return;
            }
            await this.updateOneDynamicConfigEntity(interaction, dynamicConfigEntityEntityTeamersForbiddenPairs);
            let textStrings: string[] = await this.getManyText(dynamicConfig.interaction, [
                "BASE_NOTIFY_TITLE", "DYNAMIC_CONFIG_NOTIFY_CHANGE_SUCCESS"
            ]);
            await interaction.reply({embeds: this.dynamicConfigUI.notify(textStrings[0], textStrings[1]), ephemeral: true});
            await this.sendDynamicConfigMessage(dynamicConfig);
            return;
        }

        if(dynamicConfigEntity.type === "NumberMany") {
            let dynamicConfigEntityNumberMany: DynamicConfigEntityNumberMany = dynamicConfigEntity as DynamicConfigEntityNumberMany;
            if(!dynamicConfigEntityNumberMany.check(value)) {
                let textStrings: string[] = await this.getManyText(interaction, [
                    "BASE_ERROR_TITLE", "DYNAMIC_CONFIG_ERROR_TYPE_NUMBER_MANY"], [
                    null, [
                        dynamicConfigEntityNumberMany.properties.minAmount,
                        dynamicConfigEntityNumberMany.properties.maxAmount,
                        dynamicConfigEntityNumberMany.properties.minValue,
                        dynamicConfigEntityNumberMany.properties.maxValue
                    ]
                ]);
                await interaction.reply({embeds: this.dynamicConfigUI.error(textStrings[0], textStrings[1]), ephemeral: true});
                await this.sendDynamicConfigMessage(dynamicConfig);
                return;
            }
            await this.updateOneDynamicConfigEntity(interaction, dynamicConfigEntityNumberMany);
            await interaction.deferUpdate();
            await this.sendDynamicConfigMessage(dynamicConfig);
            return;
        }

        if(dynamicConfigEntity.type === "RoleMany") {
            let dynamicConfigEntityRoleMany: DynamicConfigEntityRoleMany = dynamicConfigEntity as DynamicConfigEntityRoleMany;
            if(!dynamicConfigEntityRoleMany.check(value)) {
                let textStrings: string[] = await this.getManyText(interaction, [
                    "BASE_ERROR_TITLE", "DYNAMIC_CONFIG_ERROR_TYPE_ROLE_MANY"], [
                    null, [
                        dynamicConfigEntityRoleMany.properties.minAmount,
                        dynamicConfigEntityRoleMany.properties.maxAmount
                    ]
                ]);
                await interaction.reply({embeds: this.dynamicConfigUI.error(textStrings[0], textStrings[1]), ephemeral: true});
                await this.sendDynamicConfigMessage(dynamicConfig);
                return;
            }
            await this.updateOneDynamicConfigEntity(interaction, dynamicConfigEntityRoleMany);
            let textStrings: string[] = await this.getManyText(dynamicConfig.interaction, [
                "BASE_NOTIFY_TITLE", "DYNAMIC_CONFIG_NOTIFY_CHANGE_SUCCESS"
            ]);
            await interaction.reply({embeds: this.dynamicConfigUI.notify(textStrings[0], textStrings[1]), ephemeral: true});
            await this.sendDynamicConfigMessage(dynamicConfig);
            return;
        }

        if(dynamicConfigEntity.type === "ChannelMany") {
            let dynamicConfigEntityChannelMany: DynamicConfigEntityChannelMany = dynamicConfigEntity as DynamicConfigEntityChannelMany;
            if(!dynamicConfigEntityChannelMany.check(value)) {
                let textStrings: string[] = await this.getManyText(interaction, [
                    "BASE_ERROR_TITLE", "DYNAMIC_CONFIG_ERROR_TYPE_CHANNEL_MANY"], [
                    null, [
                        dynamicConfigEntityChannelMany.properties.minAmount,
                        dynamicConfigEntityChannelMany.properties.maxAmount
                    ]
                ]);
                await interaction.reply({embeds: this.dynamicConfigUI.error(textStrings[0], textStrings[1]), ephemeral: true});
                await this.sendDynamicConfigMessage(dynamicConfig);
                return;
            }
            await this.updateOneDynamicConfigEntity(interaction, dynamicConfigEntityChannelMany);
            let textStrings: string[] = await this.getManyText(dynamicConfig.interaction, [
                "BASE_NOTIFY_TITLE", "DYNAMIC_CONFIG_NOTIFY_CHANGE_SUCCESS"
            ]);
            await interaction.reply({embeds: this.dynamicConfigUI.notify(textStrings[0], textStrings[1]), ephemeral: true});
            await this.sendDynamicConfigMessage(dynamicConfig);
            return;
        }

        if(dynamicConfigEntity.type === "NumberTimeSeconds") {
            let dynamicConfigEntityNumberTimeSeconds: DynamicConfigEntityNumberTimeSeconds = dynamicConfigEntity as DynamicConfigEntityNumberTimeSeconds;
            if(!dynamicConfigEntityNumberTimeSeconds.check(value)) {
                let textStrings: string[] = await this.getManyText(interaction, [
                    "BASE_ERROR_TITLE", "DYNAMIC_CONFIG_ERROR_TYPE_NUMBER"], [
                    null, [dynamicConfigEntityNumberTimeSeconds.properties.minValue, dynamicConfigEntityNumberTimeSeconds.properties.maxValue]
                ]);
                await interaction.reply({embeds: this.dynamicConfigUI.error(textStrings[0], textStrings[1]), ephemeral: true});
                await this.sendDynamicConfigMessage(dynamicConfig);
                return;
            }
            await this.updateOneDynamicConfigEntity(interaction, dynamicConfigEntityNumberTimeSeconds);
            await interaction.deferUpdate();
            await this.sendDynamicConfigMessage(dynamicConfig);
            return;
        }

        // Если ничего не совпало, то ничего не делать
        await interaction.reply({content: `ModalSetting is not implemented. Index=${index}, value=${value}.`, ephemeral: true});
    }

    public async deleteButton(interaction: ButtonInteraction) {
        let dynamicConfig: DynamicConfig | undefined = await this.checkDynamicConfigComponent(interaction);
        if(!dynamicConfig)
            return;
        DynamicConfigService.dynamicConfigs.delete(dynamicConfig.guildID);
        if(dynamicConfig.setTimeoutID !== null)
            clearTimeout(dynamicConfig.setTimeoutID);
        await dynamicConfig.interaction.deleteReply();
    }

    public async resetButton(interaction: ButtonInteraction) {
        let dynamicConfig: DynamicConfig | undefined = await this.checkDynamicConfigComponent(interaction);
        if(!dynamicConfig)
            return;
        this.updateTimeoutTimer(dynamicConfig);
        let textStrings: string[] = await this.getManyText(dynamicConfig.interaction, [
            "DYNAMIC_CONFIG_RESET_TITLE", "DYNAMIC_CONFIG_RESET_DESCRIPTION"
        ]);
        let labels: string[] = await this.getManyText(dynamicConfig.interaction, [
            "DYNAMIC_CONFIG_RESET_BUTTON_CONFIRM", "DYNAMIC_CONFIG_RESET_BUTTON_CANCEL"
        ]);
        await dynamicConfig.interaction.editReply({
            embeds: this.dynamicConfigUI.configResetEmbed(dynamicConfig, textStrings[0], textStrings[1]),
            components: this.dynamicConfigUI.configResetButtons(labels)
        });
    }

    public async firstPageButton(interaction: ButtonInteraction) {
        let dynamicConfig: DynamicConfig | undefined = await this.checkDynamicConfigComponent(interaction);
        if(!dynamicConfig)
            return;
        this.updateTimeoutTimer(dynamicConfig);
        dynamicConfig.toFirstPage();
        await this.sendDynamicConfigMessage(dynamicConfig);
    }

    public async previousPageButton(interaction: ButtonInteraction) {
        let dynamicConfig: DynamicConfig | undefined = await this.checkDynamicConfigComponent(interaction);
        if(!dynamicConfig)
            return;
        this.updateTimeoutTimer(dynamicConfig);
        dynamicConfig.toPreviousPage();
        await this.sendDynamicConfigMessage(dynamicConfig);
    }

    public async nextPageButton(interaction: ButtonInteraction) {
        let dynamicConfig: DynamicConfig | undefined = await this.checkDynamicConfigComponent(interaction);
        if(!dynamicConfig)
            return;
        this.updateTimeoutTimer(dynamicConfig);
        dynamicConfig.toNextPage();
        await this.sendDynamicConfigMessage(dynamicConfig);
    }

    public async lastPageButton(interaction: ButtonInteraction) {
        let dynamicConfig: DynamicConfig | undefined = await this.checkDynamicConfigComponent(interaction);
        if(!dynamicConfig)
            return;
        this.updateTimeoutTimer(dynamicConfig);
        dynamicConfig.toLastPage();
        await this.sendDynamicConfigMessage(dynamicConfig);
    }

    public async resetConfirmButton(interaction: ButtonInteraction) {
        let dynamicConfig: DynamicConfig | undefined = await this.checkDynamicConfigComponent(interaction);
        if(!dynamicConfig)
            return;
        this.updateTimeoutTimer(dynamicConfig);
        let configs: DynamicConfigEntity[];
        if(dynamicConfig.isConfig) {
            configs = dynamicConfig.getAllConfigs();
        } else {
            let categories: string[] = dynamicConfig.getOptionTags().slice();
            for(let i: number = 0; i < categories.length; i++) {
                categories = categories
                    .slice(0, i)
                    .concat(tagsMap.get(categories[i]) || [categories[i]])
                    .concat(categories.slice(i+1))
            }
            configs = await this.createDynamicConfigEntities(categories
                    .map((category: string) => configsMap.get(category) || [])
                    .reduce((a, b) => a.concat(b), []),
                dynamicConfig
            );
        }

        await this.resetManyDynamicConfigEntity(interaction, configs);
        if(dynamicConfig.isConfig)
            dynamicConfig.updateConfigs(await this.createDynamicConfigEntities(
                configsMap.get(dynamicConfig.getTitleTag()) || [],
                dynamicConfig)
            );
        let textStrings: string[] = await this.getManyText(dynamicConfig.interaction, [
            "BASE_NOTIFY_TITLE", "DYNAMIC_CONFIG_NOTIFY_RESET_SUCCESS"
        ]);
        await dynamicConfig.interaction.followUp({embeds: this.dynamicConfigUI.notify(textStrings[0], textStrings[1]), ephemeral: true});
        await this.sendDynamicConfigMessage(dynamicConfig);
    }

    public async resetDenyButton(interaction: ButtonInteraction) {
        let dynamicConfig: DynamicConfig | undefined = await this.checkDynamicConfigComponent(interaction);
        if(!dynamicConfig)
            return;
        this.updateTimeoutTimer(dynamicConfig);
        await this.sendDynamicConfigMessage(dynamicConfig);
    }

    public async backButton(interaction: ButtonInteraction) {
        let dynamicConfig: DynamicConfig | undefined = await this.checkDynamicConfigComponent(interaction);
        if(!dynamicConfig)
            return;
        this.updateTimeoutTimer(dynamicConfig);
        dynamicConfig.deleteLastChild();
        await this.sendDynamicConfigMessage(dynamicConfig);
    }

    public static async timeoutFunction() {
        let dynamicConfigs: DynamicConfig[] = Array.from(DynamicConfigService.dynamicConfigs.values())
            .filter(dynamicConfig => (Date.now()-dynamicConfig.date.getTime() >= dynamicConfig.lifeTimeMs));
        dynamicConfigs.forEach(dynamicConfig => DynamicConfigService.dynamicConfigs.delete(dynamicConfig.guildID));
        for(let i in dynamicConfigs)
            try { await dynamicConfigs[i].interaction.deleteReply(); } catch {}
    }
}
