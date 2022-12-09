import {ModuleBaseUI} from "../base/base.ui";
import {ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, SelectMenuBuilder, TextInputStyle} from "discord.js";
import {DynamicConfig, DynamicConfigEntityTeamersForbiddenPairs} from "./dynamicConfig.models";
import {UtilsGeneratorEmbed} from "../../utils/generators/utils.generator.embed";
import {UtilsGeneratorMenu} from "../../utils/generators/utils.generator.menu";
import {UtilsGeneratorButton} from "../../utils/generators/utils.generator.button";
import {UtilsGeneratorModal} from "../../utils/generators/utils.generator.modal";

export class DynamicConfigUI extends ModuleBaseUI {
    public configEmbed(
        dynamicConfig: DynamicConfig,
        titleEmoji: string, title: string, titlePage: string,
        description: string,
        emojis: string[], options: string[],
        noValue: string = ""    // для страницы самого верхнего уровня не нужно пустое значение
    ): EmbedBuilder[] {
        let values: string[] = dynamicConfig.getStringifiedValues();
        if(dynamicConfig.isConfig && dynamicConfig.getLastChild().configs[0]?.type === "TeamersForbiddenPairs") {
            let dynamicConfigEntityTeamersForbiddenPairs: DynamicConfigEntityTeamersForbiddenPairs = (dynamicConfig.getLastChild().configs[0] as DynamicConfigEntityTeamersForbiddenPairs);
            let pairString: string = dynamicConfigEntityTeamersForbiddenPairs.civilizationPairIndexes
                .map((value: number[]): string => `– ${dynamicConfigEntityTeamersForbiddenPairs.civilizationTexts[value[0]]}, ${dynamicConfigEntityTeamersForbiddenPairs.civilizationTexts[value[1]]}`)
                .join("\n");
            if(pairString === "")
                pairString = noValue;
            values = ["\n" + pairString];
            options = [`__**${options[0]}**__`];
        }

        return UtilsGeneratorEmbed.getSingle(
            (dynamicConfig.pageTotal > 1)
                ? `${titleEmoji} ${title}, ${titlePage} ${dynamicConfig.pageCurrent}/${dynamicConfig.pageTotal}`
                : `${titleEmoji} ${title}`,
            "#F4900C",
            description + "\n\n" + emojis.map(
                (value: string, index: number): string =>
                    (dynamicConfig.isConfig)
                        ? `${emojis[index]} ${options[index]}: ${values[index] || noValue}`
                        : `${emojis[index]} ${options[index]}`
            ).join("\n") + "\n" + "⠀",    // невидимый пробел для следующей строки
            [],
            dynamicConfig.interaction.user.tag,
            dynamicConfig.interaction.user.avatarURL()
        );
    }

    public configMenu(
        placeholder: string,
        labels: string[],
        emojis: string[],
        descriptions: string[] = []
    ): ActionRowBuilder<SelectMenuBuilder>[] {
        return UtilsGeneratorMenu.build(
            "dynamicConfig-menu",
            placeholder,
            labels,
            emojis,
            Array.from(new Array(labels.length).keys()).map((value: number): string => String(value)),
            descriptions
        );
    }

    public configButtons(
        dynamicConfig: DynamicConfig,
        labels: string[]        // back, navigation, reset, delete
    ): ActionRowBuilder<ButtonBuilder>[] {
        let indexes: number[] = Array.from(Array(labels.length).keys());
        if(dynamicConfig.pageTotal === 1)
            indexes.splice(1, 4);
        else if (dynamicConfig.pageTotal === 2) {
            indexes.splice(4, 1);
            indexes.splice(1, 1);
        }
        if(!dynamicConfig.hasAnyChild())
            indexes.splice(0, 1);

        let filterFunction = (value: any, index: number): boolean => (indexes.indexOf(index) !== -1);
        labels = labels.filter(filterFunction);
        let isDisabledArray: boolean[] = [
            false,
            dynamicConfig.pageCurrent === 1,
            dynamicConfig.pageCurrent === 1,
            dynamicConfig.pageCurrent === dynamicConfig.pageTotal,
            dynamicConfig.pageCurrent === dynamicConfig.pageTotal,
            false,
            false
        ].filter(filterFunction);
        let emojis: string[] = ["⬅", "⏮", "◀", "▶", "⏭", "🔄", "✖️"].filter(filterFunction);
        let customIDArray: string[] = [
            "dynamicConfig-button-back",
            "dynamicConfig-button-first",
            "dynamicConfig-button-previous",
            "dynamicConfig-button-next",
            "dynamicConfig-button-last",
            "dynamicConfig-button-reset",
            "dynamicConfig-button-delete",
        ].filter(filterFunction);
        let styles: ButtonStyle[] = [
            ButtonStyle.Primary,
            ButtonStyle.Secondary,
            ButtonStyle.Secondary,
            ButtonStyle.Secondary,
            ButtonStyle.Secondary,
            ButtonStyle.Danger,
            ButtonStyle.Danger
        ].filter(filterFunction);

        return UtilsGeneratorButton.getList(labels, emojis, styles, customIDArray, isDisabledArray);
    }

    public configModal(
        title: string,
        configTag: string,
        label: string,
        defaultValue: string,
        isStyleParagraphText: boolean = false,
        zeroCharactersInput: boolean = false
    ): ModalBuilder {
        return UtilsGeneratorModal.build(
            "dynamicConfig-modal",
            title,
            [configTag],
            [label],
            [defaultValue],
            (isStyleParagraphText) ? [TextInputStyle.Paragraph] : [TextInputStyle.Short],
            zeroCharactersInput
        );
    };

    public configResetEmbed(
        dynamicConfig: DynamicConfig,
        title: string,
        description: string
    ): EmbedBuilder[] {
        return UtilsGeneratorEmbed.getSingle(
            title,
            "#F4900C",
            description,
            [],
            dynamicConfig.interaction.user.tag,
            dynamicConfig.interaction.user.avatarURL()
        );
    }

    public configResetButtons(labels: string[]): ActionRowBuilder<ButtonBuilder>[] {
        let styles: ButtonStyle[] = [ButtonStyle.Success, ButtonStyle.Danger];
        let emojis: string[] = ["🔄", "✖️"];
        let customIDs: string[] = ["dynamicConfig-button-reset-confirm", "dynamicConfig-button-reset-deny"];
        return UtilsGeneratorButton.getList(labels, emojis, styles, customIDs);
    }
}
