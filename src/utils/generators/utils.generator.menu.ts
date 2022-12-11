import {ActionRowBuilder, StringSelectMenuBuilder, SelectMenuComponentOptionData} from "discord.js";

export class UtilsGeneratorMenu {
    public static build (
        customID: string,
        placeholder: string,
        labels: string[],
        emojis: string[],
        values: string[],
        descriptions: string[] = []
    ): ActionRowBuilder<StringSelectMenuBuilder>[] {
        return [new ActionRowBuilder<StringSelectMenuBuilder>()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(customID)
                    .setPlaceholder(placeholder)
                    .setMinValues(1)
                    .setMaxValues(1)
                    .addOptions(labels.map((label: string, index: number): SelectMenuComponentOptionData => {
                        return (emojis[index] === "")
                            ? {
                                label: labels[index],
                                value: values[index],
                                description: descriptions[index]
                            }
                            : {
                                label: labels[index],
                                emoji: emojis[index],
                                value: values[index],
                                description: descriptions[index]
                            };
                    })),
            )
        ];
    }
}
