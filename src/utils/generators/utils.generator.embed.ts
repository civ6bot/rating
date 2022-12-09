import {ColorResolvable, EmbedBuilder, APIEmbedField} from "discord.js";

export class UtilsGeneratorEmbed {
    public static getSingle(
        title: string | null = null,
        color: ColorResolvable = "#FFFFFF",
        description: string | null = null,

        fields: APIEmbedField[] = [],
        signBottomText: string | null = null,
        signBottomImageUrl: string | null = null,

        thumbnailImageUrl: string | null = null,
        largeImageUrl: string | null = null,
    ): EmbedBuilder[] {
        return this.getList(
            [title], [color], [description],
            [fields], signBottomText, signBottomImageUrl,
            [thumbnailImageUrl], [largeImageUrl]
        );
    }

    public static getList(
        titleArray: (string|null)[],
        colorArray: ColorResolvable[] = [],
        descriptionArray: (string|null)[] = [],

        fieldsArray: APIEmbedField[][] = [],
        signBottomText: string | null,
        signBottomImageUrl: string | null,

        thumbnailImageUrlArray: (string|null)[] = [],
        largeImageUrlArray: (string|null)[] = []
    ): EmbedBuilder[] {
        let embedBuilderArray: EmbedBuilder[] = [];
        let embedsAmount: number = Math.max(titleArray.length, colorArray.length, descriptionArray.length, fieldsArray.length);
        for(let i: number = 0; i < embedsAmount; i++) {
            let embedBuilder: EmbedBuilder = new EmbedBuilder()
                .setTitle(titleArray[i] || null)
                .setColor(colorArray[i] || "#FFFFFF")
                .setDescription(descriptionArray[i] || null)
                .setThumbnail(thumbnailImageUrlArray[i] || null)
                .setImage(largeImageUrlArray[i] || null)
            for(let j in fieldsArray[i])
                if((fieldsArray[i][j].name !== "") && (fieldsArray[i][j].value !== ""))
                    embedBuilder.addFields({name: fieldsArray[i][j].name, value: fieldsArray[i][j].value, inline: true});
            embedBuilderArray.push(embedBuilder);
        }
        if(signBottomText !== null)
            embedBuilderArray[embedBuilderArray.length-1].setFooter({
                text: signBottomText,
                iconURL: signBottomImageUrl || undefined
            });
        return embedBuilderArray;
    }
}
