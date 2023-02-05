import { ButtonInteraction, CommandInteraction, EmbedBuilder, GuildEmoji, InteractionType, ModalSubmitInteraction, StringSelectMenuInteraction } from "discord.js";
import { DatabaseServiceText } from "../../database/services/service.Text";
import { UtilsDataCivilizations } from "../../utils/data/utils.data.civilizations";
import { UtilsServiceForbiddenPairs } from "../../utils/services/utils.service.forbiddenPairs";
import { UtilsServiceSyntax } from "../../utils/services/utils.service.syntax";
import { ModuleBaseService } from "../base/base.service";
import { configsMap, tagsMap } from "./dynamicConfig.dictionaries";
import { DynamicConfigEntity } from "./dynamicConfig.models";
import { DynamicConfigUI } from "./dynamicConfig.ui";

export class DynamicConfigService extends ModuleBaseService {
    private dynamicConfigUI: DynamicConfigUI = new DynamicConfigUI();

    private entitiesPerPage: number = 6;

    private isOwner(interaction: ButtonInteraction | StringSelectMenuInteraction): boolean {
        return interaction.customId.split("-").filter(str => str === interaction.user.id).length > 0;
    }

    // Получить название категории-родителя
    // по тегу конфигурации
    private getParentDynamicConfigTag(dynamicConfigTag: string): string {
        if(dynamicConfigTag === "BASE_LANGUAGE")    // Его нет в словаре, особый случай
            return "DYNAMIC_CONFIG_LANGUAGE";

        let dynamicConfigDictionaries: DynamicConfigEntity[][] = Array.from(configsMap.values());
        for(let i in dynamicConfigDictionaries)
            if(dynamicConfigDictionaries[i].map(dynamicConfigEntity => dynamicConfigEntity.configTag).indexOf(dynamicConfigTag) !== -1)
                return Array.from(configsMap.keys())[i];
        let dynamicConfigTags: string[][] = Array.from(tagsMap.values());
        for(let i in dynamicConfigTags)
            if(dynamicConfigTags[i].indexOf(dynamicConfigTag) !== -1)
                return Array.from(tagsMap.keys())[i];
        return "";
    }

    // Получить соседние конфигурации
    // по тегу конфигурации внутри категории
    private async getAdjacentDynamicConfigEntities(
        interaction: CommandInteraction | ButtonInteraction | ModalSubmitInteraction | StringSelectMenuInteraction | string,
        dynamicConfigTag: string
    ): Promise<DynamicConfigEntity[]> {
        return await this.getDynamicConfigEntities(interaction, this.getParentDynamicConfigTag(dynamicConfigTag));
    }

    // [SUB-ROUTINE], не вызывать из public
    // Назначает поля value и specialValue
    private async updateDynamicConfigValues(
        interaction: CommandInteraction | ButtonInteraction | ModalSubmitInteraction | StringSelectMenuInteraction | string,
        dynamicConfigEntities: DynamicConfigEntity[]
    ): Promise<void> {
        let values: string[] = await this.getManySettingString(interaction, ...dynamicConfigEntities.map(dynamicConfigEntity => dynamicConfigEntity.configTag));
        dynamicConfigEntities.forEach((dynamicConfigEntity: DynamicConfigEntity, index: number) => {
            switch(dynamicConfigEntity.type) {
                case "BooleanLanguage":
                    dynamicConfigEntity.specialValue = dynamicConfigEntity.textTag;
                    dynamicConfigEntity.value = String(Number(dynamicConfigEntity.textTag === values[index]));
                    break;
                default:
                    dynamicConfigEntity.value = values[index];
                    break;
            }
        });
    }

    // [SUB-ROUTINE], не вызывать из public
    // Обновляет текстовое поля
    // stringifiedValue и stringifiedModalValue
    private async updateDynamicConfigStringifiedValues(
        interaction: CommandInteraction | ButtonInteraction | ModalSubmitInteraction | StringSelectMenuInteraction | string,
        dynamicConfigEntities: DynamicConfigEntity[]
    ): Promise<void> {
        for(let i in dynamicConfigEntities) {
            let dynamicConfigEntity: DynamicConfigEntity = dynamicConfigEntities[i];
            switch(dynamicConfigEntity.type) {
                case "Number":
                case "String":
                case "Emoji":
                    dynamicConfigEntity.stringifiedValue = dynamicConfigEntity.value;
                    if(dynamicConfigEntity.stringifiedValue === "")
                        dynamicConfigEntity.stringifiedValue = "—";
                    dynamicConfigEntity.stringifiedModalValue = dynamicConfigEntity.value;
                    break;
                case "Boolean":
                case "BooleanGameSetting":
                case "BooleanLanguage":
                case "BooleanCivilization":
                    dynamicConfigEntity.stringifiedValue = (Number(dynamicConfigEntity.value)) ? "✅" : "🚫" ;
                    dynamicConfigEntity.stringifiedModalValue = dynamicConfigEntity.stringifiedValue;
                    break;
                case "TeamersForbiddenPairs":
                    let civEmojis: string[] = await this.getManySettingString(interaction, ...UtilsDataCivilizations.civilizationsTags.map((str: string): string => str+"_EMOJI"));
                    let dashArray: string[][] = Array<string>(civEmojis.length).fill("-").map(str => [str]);
                    let civilizationsText: string[] = (await this.getManyText(interaction, UtilsDataCivilizations.civilizationsTags, civEmojis.map(str => [str])));
                    let civilizationsTextDash: string[] = (await this.getManyText(interaction, UtilsDataCivilizations.civilizationsTags, dashArray));
                    let forbiddenPairsNumbers: number[][] = dynamicConfigEntity.value?.split(" ")
                        .filter(str => str.length)
                        .map((str: string): number[] => str.split("_")
                            .map((substr: string): number => Number(substr)
                        )) ?? [];
                    if(forbiddenPairsNumbers.length) {
                        dynamicConfigEntity.stringifiedValue = "\n\n" + forbiddenPairsNumbers.map((pair: number[]): string => pair
                            .map((id: number): string => civilizationsText[id])
                            .sort()
                            .join(", ")
                        ).sort()
                        .join("\n");
                        dynamicConfigEntity.stringifiedModalValue = forbiddenPairsNumbers.map((pair: number[]): string => pair
                            .map((id: number): string => civilizationsTextDash[id])
                            .sort()
                            .join(", ")
                        ).sort()
                        .join("\n");
                    } else {
                        dynamicConfigEntity.stringifiedValue = "—";
                        dynamicConfigEntity.stringifiedModalValue = "";
                    }
                    break;
                case "NumberMany":
                    dynamicConfigEntity.stringifiedValue = (dynamicConfigEntity.value?.length)
                        ? dynamicConfigEntity.value
                            .split(" ")
                            .join(", ")
                        : "—";
                    dynamicConfigEntity.stringifiedModalValue = dynamicConfigEntity.value ?? "";
                    break;
                case "RoleMany":
                    dynamicConfigEntity.stringifiedValue = (dynamicConfigEntity.value?.length)
                        ? dynamicConfigEntity.value
                            .split(" ")
                            .map(str => `<@&${str}>`)
                            .join(", ")
                        : "—";
                    dynamicConfigEntity.stringifiedModalValue = dynamicConfigEntity.value ?? "";
                    break;
                case "ChannelMany":
                    dynamicConfigEntity.stringifiedValue = (dynamicConfigEntity.value?.length)
                        ? dynamicConfigEntity.value
                            .split(" ")
                            .map(str => `<#${str}>`)
                            .join(", ")
                        : "—";
                    dynamicConfigEntity.stringifiedModalValue = dynamicConfigEntity.value ?? "";
                    break;
                case "NumberTimeSeconds":
                    dynamicConfigEntity.stringifiedValue = String(Math.floor(Number(dynamicConfigEntity.value)/1000));
                    dynamicConfigEntity.stringifiedModalValue = dynamicConfigEntity.stringifiedValue;
                    break;
                default:
                    dynamicConfigEntity.stringifiedValue = dynamicConfigEntity.value;
                    dynamicConfigEntity.stringifiedModalValue = dynamicConfigEntity.stringifiedValue;
                    break;
            }
        }
    }

    // [SUB-ROUTINE], не вызывать из public
    // Обновляет текстовые поля для сообщения:
    // stringifiedText и stringifiedTextEmoji
    private async updateDynamicConfigstringifiedText(
        interaction: CommandInteraction | ButtonInteraction | ModalSubmitInteraction | StringSelectMenuInteraction | string,
        dynamicConfigEntities: DynamicConfigEntity[]
    ): Promise<void> {
        let textLines: string[] = await this.getManyText(interaction, dynamicConfigEntities.map(dynamicConfigEntity => dynamicConfigEntity.textTag));
        let emojiLines: string[] = await this.getManyText(interaction, dynamicConfigEntities.map(dynamicConfigEntity => dynamicConfigEntity.textTag+"_EMOJI"));
        for(let index in dynamicConfigEntities) {
            let dynamicConfigEntity: DynamicConfigEntity = dynamicConfigEntities[index];
            switch(dynamicConfigEntity.type) {
                case "BooleanCivilization":
                    dynamicConfigEntity.stringifiedText = textLines[index].replaceAll(/\[\w+\]/g, "-");
                    dynamicConfigEntity.stringifiedTextEmoji = await this.getOneSettingString(interaction, dynamicConfigEntity.textTag+"_EMOJI");
                    break;
                case "BooleanLanguage":
                    dynamicConfigEntity.stringifiedText = dynamicConfigEntity.textTag;
                    switch(dynamicConfigEntity.stringifiedText) {
                        case "Chinese":
                            dynamicConfigEntity.stringifiedTextEmoji = "🇨🇳";
                            break;
                        case "English":
                            dynamicConfigEntity.stringifiedTextEmoji = "🇬🇧";
                            break;
                        case "French":
                            dynamicConfigEntity.stringifiedTextEmoji = "🇫🇷";
                            break;
                        case "German":
                            dynamicConfigEntity.stringifiedTextEmoji = "🇩🇪";
                            break;
                        case "Italian":
                            dynamicConfigEntity.stringifiedTextEmoji = "🇮🇹";
                            break;
                        case "Japanese":
                            dynamicConfigEntity.stringifiedTextEmoji = "🇯🇵";
                            break;
                        case "Korean":
                            dynamicConfigEntity.stringifiedTextEmoji = "🇰🇷";
                            break;
                        case "Polish":
                            dynamicConfigEntity.stringifiedTextEmoji = "🇵🇱";
                            break;
                        case "Portuguese":
                            dynamicConfigEntity.stringifiedTextEmoji = "🇵🇹";
                            break;
                        case "Russian":
                            dynamicConfigEntity.stringifiedTextEmoji = "🇷🇺";
                            break;
                        case "Spanish":
                            dynamicConfigEntity.stringifiedTextEmoji = "🇪🇸";
                            break;
                        default:
                            dynamicConfigEntity.stringifiedTextEmoji = "";
                            break;
                    }
                    break;
                case "Emoji":
                    dynamicConfigEntity.stringifiedText = textLines[index].replaceAll(/\[\w+\]/g, "-");
                    dynamicConfigEntity.stringifiedTextEmoji = "";
                    break;
                default:
                    dynamicConfigEntity.stringifiedText = textLines[index];
                    dynamicConfigEntity.stringifiedTextEmoji = emojiLines[index];
                    if(dynamicConfigEntity.stringifiedTextEmoji == dynamicConfigEntity.textTag+"_EMOJI")
                        dynamicConfigEntity.stringifiedTextEmoji = "";
                    break;
            }
        }
    }

    // [SUB-ROUTINE], не вызывать из public
    // Сортирует объекты конфигурации по условию
    private sortDynamicConfigEntities(dynamicConfigEntities: DynamicConfigEntity[]): void {
        if(dynamicConfigEntities.length === 0)
            return;
        if(
            (dynamicConfigEntities[0].type === "BooleanCivilization") ||
            (dynamicConfigEntities[0].type === "BooleanLanguage") ||
            (dynamicConfigEntities[0].type === "Emoji")
        )
            dynamicConfigEntities.sort((a, b) => (a.stringifiedText as string).localeCompare(b.stringifiedText as string));
    }

    // [ГЛАВНЫЙ МЕТОД]
    // Получает из родительского тега
    // все готовые DynamicConfigEntities
    // со всеми заполненными полями,
    // в том числе с текстом для сообщения
    private async getDynamicConfigEntities(
        interaction: CommandInteraction | ButtonInteraction | ModalSubmitInteraction | StringSelectMenuInteraction | string, 
        dynamicConfigTag: string
    ): Promise<DynamicConfigEntity[]> {
        let dynamicConfigEntities: DynamicConfigEntity[] = [];
        switch(dynamicConfigTag) {
            // Для получения настроек языка необходимо посмотреть БД
            case "DYNAMIC_CONFIG_LANGUAGE":
                dynamicConfigEntities = (await DatabaseServiceText.getLanguages()).map((language: string): DynamicConfigEntity => { return {
                    configTag: "BASE_LANGUAGE",
                    textTag: language,
                    type: "BooleanLanguage"
                }});
                break;
            default:
                dynamicConfigEntities = configsMap.get(dynamicConfigTag) ?? [];
        }
        await this.updateDynamicConfigValues(interaction, dynamicConfigEntities);
        await this.updateDynamicConfigStringifiedValues(interaction, dynamicConfigEntities);
        await this.updateDynamicConfigstringifiedText(interaction, dynamicConfigEntities);
        this.sortDynamicConfigEntities(dynamicConfigEntities);
        return dynamicConfigEntities;
    }

    // Проверяет новое значение stringifiedValue[i].
    // Если все верно, то меняет поле value
    // для последующего сохранения
    private async checkDynamicConfigEntityStringifiedValues(
        interaction: CommandInteraction | ButtonInteraction | ModalSubmitInteraction | StringSelectMenuInteraction, 
        dynamicConfigEntity: DynamicConfigEntity,
        stringifiedValue: string
    ): Promise<void> {
        switch(dynamicConfigEntity.type) {
            case "Number":
                let valueNumber: number = Number(stringifiedValue);
                if(
                    (valueNumber >= (dynamicConfigEntity.minValue ?? 0)) && 
                    (valueNumber <= (dynamicConfigEntity.maxValue ?? Infinity))
                ) 
                    dynamicConfigEntity.value = String(valueNumber);
                else
                    dynamicConfigEntity.errorText = await this.getOneText(interaction, "DYNAMIC_CONFIG_ERROR_TYPE_NUMBER", 
                        dynamicConfigEntity.minValue ?? 0, dynamicConfigEntity.maxValue ?? Infinity
                    );
                break;
            case "String":
                if(stringifiedValue.length !== 0)
                    dynamicConfigEntity.value = stringifiedValue;
                else
                    dynamicConfigEntity.errorText = await this.getOneText(interaction, "DYNAMIC_CONFIG_ERROR_TYPE_STRING");
                break;
            case "BooleanGameSetting":  // Не смотрит на входящий аргумент
                if(Number(dynamicConfigEntity.value)) {     // Если хотят поменять "да" на "нет"
                    let adjacentDynamicConfigEntities: DynamicConfigEntity[] = await this.getAdjacentDynamicConfigEntities(interaction, dynamicConfigEntity.configTag);
                    if(adjacentDynamicConfigEntities.slice(1).filter(adjacentDynamicConfigEntity => Number(adjacentDynamicConfigEntity.value)).length <= 2) {
                        dynamicConfigEntity.errorText = await this.getOneText(interaction, "DYNAMIC_CONFIG_ERROR_TYPE_BOOLEAN_GAME_SETTING");
                        break;
                    }
                }                       // если всё ок, то далее вниз без break, убрать дублирование кода
            case "Boolean":             // Не смотрит на входящий аргумент
            case "BooleanCivilization": // Не смотрит на входящий аргумент
                dynamicConfigEntity.value = String((Number(dynamicConfigEntity.value)+1)%2);
                break;
            case "BooleanLanguage":     // Не смотрит на входящий аргумент
                dynamicConfigEntity.value = dynamicConfigEntity.textTag;
                break;
            case "TeamersForbiddenPairs":
                // stringifiedValue - человеческий текст
                // Если всё ОК - меняется строка для config и массив пар и возвращается true
                // Если нет - возвращается false

                // 0) Разбитие на массивы
                let civilizationsText: string[] = await this.getManyText(interaction, UtilsDataCivilizations.civilizationsTags);
                civilizationsText.map(str => str.replaceAll("[EMOJI]", ""));
                let civParseResult: number[][][] = stringifiedValue
                    .replaceAll(/[-()]/g, " ")
                    .split("\n")
                    .map((civilizationsTextPairString: string): string[] => civilizationsTextPairString.split(","))
                    .map((civTextPair: string[]): string[] =>
                        civTextPair.map((civText: string, index: number): string => civTextPair[index] = civText.trim())
                    ).map((civilizationsTextPairString: string[]): number[][] =>
                        civilizationsTextPairString.map((civText: string): number[] => {
                            let {bans, errors} = UtilsServiceSyntax.parseBans(civText, civilizationsText);
                            return bans;
                        })
                    )
                    .filter((civDoubleNumber: number[][]): boolean =>
                        civDoubleNumber.filter((civOneNumber: number[]): boolean =>
                            civOneNumber.length !== 0
                        ).length !== 0
                    );
                
                // 1) Правильная ли запись? (в каждой строчке 2 лидера)
                if(civParseResult.map((civDoubleArrayResult: number[][]): boolean =>
                    (civDoubleArrayResult.length === 2) && civDoubleArrayResult.every((civOneArrayResult: number[]): boolean =>
                        civOneArrayResult.length === 1
                    )
                ).some((result): boolean => !result)) {
                    dynamicConfigEntity.errorText = await this.getOneText(interaction, "DYNAMIC_CONFIG_ERROR_TYPE_TEAMERS_FORBIDDEN_PAIRS_PARSE", stringifiedValue);
                    break;
                }

                // 2) Уменьшаем размерность массива, удаляем повторяющиеся пары
                let civilizationNumberPairs: number[][] = civParseResult
                    .map((civDoubleArrayResult: number[][]): number[] =>
                        civDoubleArrayResult.map((civOneArrayResult: number[]): number =>
                            civOneArrayResult[0]
                        ).sort()
                    ).sort((a, b) => (a[0]-b[0]) || (a[1]-b[1]))
                    .filter((value: number[], index: number, array: number[][]): boolean => {
                        for(let i: number = index+1; i < array.length; i++)
                            if((array[i][0] === value[0]) && (array[i][1] === value[1]))
                                return false;
                        return true;
                    });

                // 3) Вызов внешнего алгоритма на проверку
                let {isCorrect, errorIndexes} = UtilsServiceForbiddenPairs.checkForbiddenPairsTriangles(civilizationNumberPairs);
                if(isCorrect) {
                    dynamicConfigEntity.value = UtilsServiceForbiddenPairs.getTeamersForbiddenPairsConfigString(civilizationNumberPairs);
                    break;
                }
                
                // 4) Если !isCorrect - далее вывод ошибки 
                if(errorIndexes.length === 1) {
                    dynamicConfigEntity.errorText = await this.getOneText(interaction, "DYNAMIC_CONFIG_ERROR_TYPE_TEAMERS_FORBIDDEN_PAIRS_SAME_IN_PAIR", 
                        civilizationsText[errorIndexes[0]], stringifiedValue
                    );
                    break;
                }
                if(errorIndexes.length === 3) {
                    dynamicConfigEntity.errorText = await this.getOneText(interaction, "DYNAMIC_CONFIG_ERROR_TYPE_TEAMERS_FORBIDDEN_PAIRS_TRIANGLE", 
                        errorIndexes.map((errorIndex: number): string => civilizationsText[errorIndex]).join("\n"), stringifiedValue
                    );
                    break;
                }
                dynamicConfigEntity.errorText = await this.getOneText(interaction, "DYNAMIC_CONFIG_ERROR_TYPE_TEAMERS_FORBIDDEN_PAIRS_PARSE", stringifiedValue);
                break;
            case "NumberMany":
                let valueNumbers: number[] = stringifiedValue.replaceAll(",", " ")
                    .split(" ")
                    .filter(str => str.length)
                    .map(str => Number(str));
                if(
                    valueNumbers.every(valueNumber => (valueNumber >= (dynamicConfigEntity.minValue ?? 0)) && (valueNumber <= (dynamicConfigEntity.maxValue ?? Infinity))) &&
                    (valueNumbers.length >= (dynamicConfigEntity.minAmount ?? 0)) &&
                    (valueNumbers.length <= (dynamicConfigEntity.maxAmount ?? Infinity))
                ) 
                    dynamicConfigEntity.value = valueNumbers.join(" ");
                else 
                    dynamicConfigEntity.errorText = await this.getOneText(interaction, "DYNAMIC_CONFIG_ERROR_TYPE_NUMBER", 
                        dynamicConfigEntity.minAmount ?? 0, dynamicConfigEntity.maxAmount ?? Infinity,
                        dynamicConfigEntity.minValue ?? 0, dynamicConfigEntity.maxValue ?? Infinity
                    );
                break;
            case "RoleMany":
                let valueRoles: string[] = stringifiedValue.replaceAll(/[<@&>,]/g, " ")
                    .split(" ")
                    .filter(str => str.length > 10)                                // Попытка исключить случайный набор символов
                    .filter((value: string, index: number, array: string[]) => array.indexOf(value) === index);
                if(
                    (valueRoles.length >= (dynamicConfigEntity.minAmount ?? 0)) &&
                    (valueRoles.length <= (dynamicConfigEntity.maxAmount ?? Infinity))
                ) 
                    dynamicConfigEntity.value = valueRoles.join(" ");
                else
                    dynamicConfigEntity.errorText = await this.getOneText(interaction, "DYNAMIC_CONFIG_ERROR_TYPE_ROLE_MANY", 
                        dynamicConfigEntity.minAmount ?? 0, dynamicConfigEntity.maxAmount ?? Infinity
                    );
                break;
            case "ChannelMany":
                let valueChannels: string[] = stringifiedValue.replaceAll(/[<#>,]/g, " ")
                    .split(" ")
                    .filter(str => str.length > 10)                                // Попытка исключить случайный набор символов
                    .filter((value: string, index: number, array: string[]) => array.indexOf(value) === index)
                if(
                    (valueChannels.length >= (dynamicConfigEntity.minAmount ?? 0)) &&
                    (valueChannels.length <= (dynamicConfigEntity.maxAmount ?? Infinity))
                ) 
                    dynamicConfigEntity.value = valueChannels.join(" ");
                else
                    dynamicConfigEntity.errorText = await this.getOneText(interaction, "DYNAMIC_CONFIG_ERROR_TYPE_CHANNEL_MANY", 
                        dynamicConfigEntity.minAmount ?? 0, dynamicConfigEntity.maxAmount ?? Infinity
                    );
                break;
            case "NumberTimeSeconds":
                let valueNumberTimeSeconds: number = Number(stringifiedValue);
                if(
                    (valueNumberTimeSeconds >= (dynamicConfigEntity.minValue ?? 0)) && 
                    (valueNumberTimeSeconds <= (dynamicConfigEntity.maxValue ?? Infinity))
                )
                    dynamicConfigEntity.value = String(valueNumberTimeSeconds*1000);
                else
                    dynamicConfigEntity.errorText = await this.getOneText(interaction, "DYNAMIC_CONFIG_ERROR_TYPE_NUMBER", 
                        dynamicConfigEntity.minValue ?? 0, dynamicConfigEntity.maxValue ?? Infinity
                    );
                break;
            case "Emoji":
                let emojiData: string[] = stringifiedValue
                    .replaceAll(/[ <>:]/g, " ")
                    .split(" ")
                    .filter(str => str.length);
                let emojiName: string|undefined = emojiData[0]
                let emojiID: string|undefined = emojiData[1];
                let emoji: GuildEmoji|undefined = interaction.guild?.emojis.cache.get(emojiID);
                if(emoji?.available) 
                    dynamicConfigEntity.value = `<:${emojiName}:${emojiID}>`;
                else
                    dynamicConfigEntity.errorText = await this.getOneText(interaction, "DYNAMIC_CONFIG_ERROR_TYPE_EMOJI");
                break;
            default:
                break;
        }
    }

    // Сохранить данные объекты в БД
    private async saveDynamicConfigEntityValues(
        interaction: CommandInteraction | ButtonInteraction | ModalSubmitInteraction | StringSelectMenuInteraction | string, 
        dynamicConfigEntities: DynamicConfigEntity[]
    ): Promise<void> {
        await this.updateManySetting(
            interaction,
            dynamicConfigEntities.map(dynamicConfigEntity => dynamicConfigEntity.configTag),
            dynamicConfigEntities.map(dynamicConfigEntity => dynamicConfigEntity.value ?? ""),
        );
    }

    // Отправить сообщение
    // или отредактировать существующее
    private async sendDynamicConfigMessage(
        interaction: CommandInteraction | ButtonInteraction | ModalSubmitInteraction | StringSelectMenuInteraction, 
        dynamicConfigHeaderTag: string, 
        pageCurrent: number = 1
    ): Promise<void> {
        let title: string = await this.getOneText(interaction, dynamicConfigHeaderTag);
        let titleEmoji: string = await this.getOneText(interaction, dynamicConfigHeaderTag+"_EMOJI");
        let titlePage: string = await this.getOneText(interaction, "DYNAMIC_CONFIG_TITLE_PAGE");

        let dynamicConfigEntities: DynamicConfigEntity[] = await this.getDynamicConfigEntities(interaction, dynamicConfigHeaderTag);
        let dynamicConfigTags: string[] = tagsMap.get(dynamicConfigHeaderTag) || [];
        let isConfig: boolean = (dynamicConfigEntities.length > 0);

        let pageTotal: number;
        let description: string;
        let options: string[];
        let optionsEmoji: string[];
        let values: string[];
        let configTags: string[];

        if(isConfig) {
            pageTotal = Math.ceil(dynamicConfigEntities.length/this.entitiesPerPage);
            if(pageCurrent === 99)
                pageCurrent = 1;
            else if(pageCurrent === 100)
                pageCurrent = pageTotal;
            dynamicConfigEntities = dynamicConfigEntities.slice((pageCurrent-1)*this.entitiesPerPage, pageCurrent*this.entitiesPerPage);

            description = await this.getOneText(interaction, "DYNAMIC_CONFIG_CHOOSE_CONFIG_DESCRIPTION");
            options = dynamicConfigEntities.map(dynamicConfigEntity => dynamicConfigEntity.stringifiedText as string);
            optionsEmoji = dynamicConfigEntities.map(dynamicConfigEntity => dynamicConfigEntity.stringifiedTextEmoji as string);
            values = dynamicConfigEntities.map(dynamicConfigEntity => dynamicConfigEntity.stringifiedValue as string);
            configTags = dynamicConfigEntities.map(dynamicConfigEntity => (dynamicConfigEntity.specialValue) 
                ? `${dynamicConfigEntity.configTag}-${dynamicConfigEntity.specialValue}` 
                : dynamicConfigEntity.configTag
            );
        } else {
            pageTotal = Math.ceil(dynamicConfigTags.length/this.entitiesPerPage);
            if(pageCurrent === 99)
                pageCurrent = 1;
            else if(pageCurrent === 100)
                pageCurrent = pageTotal;
            dynamicConfigTags = dynamicConfigTags.slice((pageCurrent-1)*this.entitiesPerPage, pageCurrent*this.entitiesPerPage);

            description = await this.getOneText(interaction, "DYNAMIC_CONFIG_CHOOSE_GROUP_DESCRIPTION");
            options = await this.getManyText(interaction, dynamicConfigTags);
            optionsEmoji = await this.getManyText(interaction, dynamicConfigTags.map(tag => tag+"_EMOJI"));
            values = [];
            configTags = dynamicConfigTags;
        }

        let buttonStrings: string[] = await this.getManyText(interaction, [
            "DYNAMIC_CONFIG_BUTTON_BACK", "DYNAMIC_CONFIG_BUTTON_RESET",
            "DYNAMIC_CONFIG_BUTTON_DELETE"
        ]);
        let placeholderString: string = await this.getOneText(interaction, "DYNAMIC_CONFIG_MENU_PLACEHOLDER_CONFIG");
        let embed: EmbedBuilder[] = this.dynamicConfigUI.config(
            title, titleEmoji, titlePage, pageCurrent, pageTotal,
            description,
            options, optionsEmoji, values,
            interaction.user
        );
        let components = [
            ...this.dynamicConfigUI.configButtons(
                interaction.user.id,
                buttonStrings,
                pageCurrent, pageTotal,
                dynamicConfigHeaderTag,
                this.getParentDynamicConfigTag(dynamicConfigHeaderTag)
            ),
            ...this.dynamicConfigUI.configMenu(
                interaction.user.id,
                placeholderString,
                options, optionsEmoji,
                configTags
            )
        ];

        if(interaction.type === InteractionType.ApplicationCommand)
            interaction.reply({embeds: embed, components: components});
        else {
            try {
                await interaction.deferUpdate();
            } catch {}
            interaction.message?.edit({embeds: embed, components: components});
        }
    }

    public async config(interaction: CommandInteraction) {
        if(!await this.isModerator(interaction)) {
            let textStrings = await this.getManyText(
                interaction,
                ["BASE_ERROR_TITLE", "DYNAMIC_CONFIG_ERROR_COMMAND_NOT_ADMIN"],
            );
            return interaction.reply({embeds: this.dynamicConfigUI.error(textStrings[0], textStrings[1]), ephemeral: true});
        }
        this.sendDynamicConfigMessage(interaction, "DYNAMIC_CONFIG_TITLE");
    }

    public async menu(interaction: StringSelectMenuInteraction) {
        if(!this.isOwner(interaction))
            return interaction.deferUpdate();
        let values: string[] = interaction.values[0].split("-");
        let dynamicConfigTag: string = values[0];
        let specialValue: string|undefined = values[1];
        let dynamicConfigEntities: DynamicConfigEntity[] = await this.getDynamicConfigEntities(interaction, dynamicConfigTag);
        if(
            ((tagsMap.get(dynamicConfigTag) || []).length > 0) ||
            (dynamicConfigEntities.length > 0)
        )
            return this.sendDynamicConfigMessage(interaction, dynamicConfigTag);
        let adjacentDynamicConfigEntities: DynamicConfigEntity[] = await this.getAdjacentDynamicConfigEntities(interaction, dynamicConfigTag);
        let index: number = adjacentDynamicConfigEntities.indexOf(
            adjacentDynamicConfigEntities.filter(entity => 
                (entity.configTag === dynamicConfigTag) && 
                (entity.specialValue == specialValue)       // ==, не ===
            )[0]
        );
        if(index === -1)
            return interaction.deferUpdate();
        let dynamicConfigEntity: DynamicConfigEntity = adjacentDynamicConfigEntities[index];
        let pageCurrent: number = Math.floor(index/this.entitiesPerPage)+1;

        switch(dynamicConfigEntity.type) {
            case "Boolean":
            case "BooleanGameSetting":
            case "BooleanCivilization":
            case "BooleanLanguage":
                await this.checkDynamicConfigEntityStringifiedValues(interaction, dynamicConfigEntity, "");
                if(dynamicConfigEntity.errorText) {
                    let title = await this.getOneText(interaction, "BASE_ERROR_TITLE");
                    interaction.reply({embeds: this.dynamicConfigUI.error(title, dynamicConfigEntity.errorText), ephemeral: true});
                    break;
                }
                await this.saveDynamicConfigEntityValues(interaction, [dynamicConfigEntity]);
                break;
            default:
                let label: string = await this.getOneText(interaction, "DYNAMIC_CONFIG_MODAL_LABEL");
                interaction.showModal(this.dynamicConfigUI.configModal(
                    dynamicConfigEntity.configTag,
                    `${dynamicConfigEntity.stringifiedTextEmoji} ${dynamicConfigEntity.stringifiedText}`,
                    label,
                    dynamicConfigEntity.stringifiedModalValue ?? "",
                    (dynamicConfigEntity.type === "TeamersForbiddenPairs"),     // Тут нужно много текста.
                    (dynamicConfigEntity.type === "TeamersForbiddenPairs")      // Сделано так, Чтобы не делать отдельный случай в switch-case.
                ));
                break;
        }
        this.sendDynamicConfigMessage(interaction, this.getParentDynamicConfigTag(dynamicConfigTag), pageCurrent);      // Попытка обновить меню, чтобы не кликать много раз
    }

    public async modalSetting(interaction: ModalSubmitInteraction) {
        let dynamicConfigTag: string = Array.from(interaction.fields.fields.keys())[0];
        let stringifiedValue: string = interaction.fields.fields.get(dynamicConfigTag)?.value ?? "";
        let adjacentDynamicConfigEntities: DynamicConfigEntity[] = await this.getAdjacentDynamicConfigEntities(interaction, dynamicConfigTag);
        let index: number = adjacentDynamicConfigEntities.indexOf(adjacentDynamicConfigEntities.filter(entity => (entity.configTag === dynamicConfigTag))[0]);
        let pageCurrent: number = Math.floor(index/this.entitiesPerPage)+1;
        let dynamicConfigEntity: DynamicConfigEntity|undefined = adjacentDynamicConfigEntities[index];
        if(!dynamicConfigEntity)
            return interaction.deferUpdate();
        switch(dynamicConfigEntity.type) {
            case "Boolean":
            case "BooleanGameSetting":
            case "BooleanCivilization":
            case "BooleanLanguage":
                break;      // Эти типы должны проверяться без модального окна в предыдущем методе
            default:
                await this.checkDynamicConfigEntityStringifiedValues(interaction, dynamicConfigEntity, stringifiedValue);
                if(dynamicConfigEntity.errorText) {
                    let title = await this.getOneText(interaction, "BASE_ERROR_TITLE");
                    interaction.reply({embeds: this.dynamicConfigUI.error(title, dynamicConfigEntity.errorText), ephemeral: true});
                    break;
                }
                await this.saveDynamicConfigEntityValues(interaction, [dynamicConfigEntity]);
                break;
        }
        this.sendDynamicConfigMessage(interaction, this.getParentDynamicConfigTag(dynamicConfigTag), pageCurrent);      // Попытка обновить меню, чтобы не кликать много раз
    }

    public async backButton(interaction: ButtonInteraction) {
        if(!this.isOwner(interaction))
            return interaction.deferUpdate();
        let dynamicConfigTag: string = interaction.customId.split("-")[4];
        this.sendDynamicConfigMessage(interaction, dynamicConfigTag, 1);
    }

    public async pageButton(interaction: ButtonInteraction) {
        if(!this.isOwner(interaction))
            return interaction.deferUpdate();
        let pageCurrent: number = Number(interaction.customId.split("-")[4]);
        let dynamicConfigTag: string = interaction.customId.split("-")[5];
        this.sendDynamicConfigMessage(interaction, dynamicConfigTag, pageCurrent);
    }

    public async resetButton(interaction: ButtonInteraction) {
        if(!this.isOwner(interaction))
            return interaction.deferUpdate();
        let textStrings: string[] = await this.getManyText(interaction, [
            "DYNAMIC_CONFIG_RESET_TITLE", "DYNAMIC_CONFIG_RESET_DESCRIPTION"
        ]);
        let labels: string[] = await this.getManyText(interaction, [
            "DYNAMIC_CONFIG_RESET_BUTTON_CONFIRM", "DYNAMIC_CONFIG_RESET_BUTTON_CANCEL"
        ]);
        let pageCurrent: number = Number(interaction.customId.split("-")[4]);
        let configTag: string = interaction.customId.split("-")[5];
        interaction.update({
            embeds: this.dynamicConfigUI.configResetEmbed(textStrings[0], textStrings[1], interaction.user),
            components: this.dynamicConfigUI.configResetButtons(labels, interaction.user.id, configTag, pageCurrent)
        });
    }

    public async deleteButton(interaction: ButtonInteraction) {
        if(!this.isOwner(interaction))
            return interaction.deferUpdate();
        interaction.message.delete();
    }

    public async resetConfirmButton(interaction: ButtonInteraction) {
        if(!this.isOwner(interaction))
            return interaction.deferUpdate();
        let configTag: string = interaction.customId.split("-")[5];
        let lastTags: string[] = [configTag];
        for(let i: number = 0; i < lastTags.length; i++) {
            let childTags: string[] = tagsMap.get(lastTags[i]) || [];
            if(childTags.length !== 0) {
                lastTags.splice(i, 1);
                lastTags = lastTags.concat(childTags);
                i--;
            }
        }
        let dynamicConfigEntities: DynamicConfigEntity[] = [];
        for(let i in lastTags)
            dynamicConfigEntities.push(...await this.getDynamicConfigEntities("DEFAULT", lastTags[i]));
        dynamicConfigEntities.forEach((entity => {
            if(entity.specialValue)
                entity.value = entity.specialValue;
        }));
        await this.saveDynamicConfigEntityValues(interaction, dynamicConfigEntities);
        let textStrings: string[] = await this.getManyText(interaction, [
            "BASE_NOTIFY_TITLE", "DYNAMIC_CONFIG_NOTIFY_RESET_SUCCESS"
        ]);
        interaction.reply({embeds: this.dynamicConfigUI.notify(textStrings[0], textStrings[1]), ephemeral: true});
        await this.sendDynamicConfigMessage(interaction, configTag, 1);
    }

    public async resetDenyButton(interaction: ButtonInteraction) {
        if(!this.isOwner(interaction))
            return interaction.deferUpdate();
        let pageCurrent: number = Number(interaction.customId.split("-")[5]);
        let configTag: string = interaction.customId.split("-")[6];
        this.sendDynamicConfigMessage(interaction, configTag, pageCurrent);
    }
}
