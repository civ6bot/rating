import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, StringSelectMenuBuilder, TextInputStyle, User } from "discord.js";
import { UtilsGeneratorButton } from "../../utils/generators/utils.generator.button";
import { UtilsGeneratorEmbed } from "../../utils/generators/utils.generator.embed";
import { UtilsGeneratorMenu } from "../../utils/generators/utils.generator.menu";
import { UtilsGeneratorModal } from "../../utils/generators/utils.generator.modal";
import { ModuleBaseUI } from "../base/base.ui";

export class DynamicConfigUI extends ModuleBaseUI {
    public config(
        title: string, titleEmoji: string, titlePage: string, pageCurrent: number, pageTotal: number,
        description: string,
        options: string[], optionsEmoji: string[], values: string[],
        author: User
    ): EmbedBuilder[] {
        title = `${titleEmoji} ${title}`;
        if(pageTotal > 1)
            title += `, ${titlePage} ${pageCurrent}/${pageTotal}`;

        description += "\n\n" + options.map((option: string, index: number): string => {
            let str: string = `${optionsEmoji[index]} ${option}`;
            if(values[index])
                str += `: ${values[index]}`;
            return str;
        }).join("\n") + "\n⠀";
        return UtilsGeneratorEmbed.getSingle(
            title,
            "#F4900C",
            description,
            [],
            author.tag,
            author.avatarURL()
        );
    }

    public configButtons(
        authorID: string,
        labels: string[],       // back, reset, delete | отсутствуют 1st, prev, next, last,
        pageCurrent: number,
        pageTotal: number,
        currentConfigTag: string,
        hasParentTag: boolean
    ): ActionRowBuilder<ButtonBuilder>[] {
        let indexes: number[] = [];
        if(hasParentTag)
            indexes.push(0);
        if(pageTotal === 2)
            indexes.push(2, 3);
        else if(pageTotal > 2)
            indexes.push(1, 2, 3, 4);
        indexes.push(5, 6);

        let filterFunction = (value: any, index: number): boolean => (indexes.indexOf(index) !== -1);

        labels = [labels[0], ...Array<string>(4).fill(""), ...labels.slice(1)].filter(filterFunction);
        let styles = [
            ButtonStyle.Secondary, ButtonStyle.Secondary,
            ButtonStyle.Secondary, ButtonStyle.Secondary,
            ButtonStyle.Secondary, ButtonStyle.Danger,
            ButtonStyle.Danger
        ].filter(filterFunction);
        let emojis = ["⬅", "⏮", "◀", "▶", "⏭", "🔄", "✖️"].filter(filterFunction);
        let customIDArray: string[] = [
            `dc-button-back-${authorID}-${currentConfigTag}`,
            `dc-button-page-${authorID}-99-${currentConfigTag}`,
            `dc-button-page-${authorID}-${pageCurrent-1}-${currentConfigTag}`,
            `dc-button-page-${authorID}-${pageCurrent+1}-${currentConfigTag}`,
            `dc-button-page-${authorID}-100-${currentConfigTag}`,
            `dc-button-reset-${authorID}-${pageCurrent}-${currentConfigTag}`,
            `dc-button-delete-${authorID}`,
        ].filter(filterFunction);
        let isDisabledArray: boolean[] = [
            false,
            pageCurrent === 1,
            pageCurrent === 1,
            pageCurrent === pageTotal,
            pageCurrent === pageTotal,
            false,
            false
        ].filter(filterFunction);
        
        return UtilsGeneratorButton.getList(
            labels, 
            emojis, 
            styles, 
            customIDArray, 
            isDisabledArray
        );
    }

    public configMenu(
        userID: string,
        placeholder: string,
        labels: string[],
        emojis: string[],
        configTags: string[]
    ): ActionRowBuilder<StringSelectMenuBuilder>[] {
        return UtilsGeneratorMenu.build(
            `dc-menu-${userID}`,
            placeholder,
            labels,
            emojis,
            configTags
        );
    }

    public configModal(
        configTag: string,
        title: string,
        label: string,
        defaultValue: string,
        isStyleParagraphText: boolean = false,
        zeroCharactersInput: boolean = false
    ): ModalBuilder {
        return UtilsGeneratorModal.build(
            "dc-modal",
            title,
            [configTag],
            [label],
            [defaultValue],
            (isStyleParagraphText) ? [TextInputStyle.Paragraph] : [TextInputStyle.Short],
            zeroCharactersInput
        );
    };

    public configResetEmbed(
        title: string,
        description: string,
        author: User
    ): EmbedBuilder[] {
        return UtilsGeneratorEmbed.getSingle(
            title,
            "#F4900C",
            description,
            [],
            author.tag,
            author.avatarURL()
        );
    }

    public configResetButtons(
        labels: string[],
        userID: string,
        configTag: string,
        pageCurrent: number
    ): ActionRowBuilder<ButtonBuilder>[] {
        let styles: ButtonStyle[] = [ButtonStyle.Success, ButtonStyle.Danger];
        let emojis: string[] = ["🔄", "✖️"];
        let customIDs: string[] = [
            `dc-button-reset-confirm-${userID}-${configTag}`, 
            `dc-button-reset-deny-${userID}-${pageCurrent}-${configTag}`
        ];
        return UtilsGeneratorButton.getList(labels, emojis, styles, customIDs);
    }
}
