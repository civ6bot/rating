import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, CommandInteraction, EmbedBuilder, Guild, GuildMember, InteractionType, User } from "discord.js";
import { EntityRatingNote } from "../../database/entities/entity.RatingNote";
import { DatabaseServiceRatingNote } from "../../database/services/service.RatingNote";
import { DatabaseServiceUserRating } from "../../database/services/service.UserRating";
import { UtilsServiceCivilizations } from "../../utils/services/utils.service.civilizations";
import { ModuleBaseService } from "../base/base.service";
import { BestCivsEntity } from "./profile.models";
import { ProfileUI } from "./profile.ui";

export class ProfileService extends ModuleBaseService {
    private historyLinesPerPage: number = 10;
    private bestCivsPerPage: number = 10;

    private profileUI: ProfileUI = new ProfileUI();

    private databaseServiceUserRating: DatabaseServiceUserRating = new DatabaseServiceUserRating();
    private databaseServiceRatingNote: DatabaseServiceRatingNote = new DatabaseServiceRatingNote();

    private isOwner(interaction: ButtonInteraction): boolean {
        return interaction.customId.split("-")[2] === interaction.user.id;
    }

    private formBestCivs(ratingNotes: EntityRatingNote[]): BestCivsEntity[] {
        let bestCivsEntities: BestCivsEntity[] = [];
        ratingNotes.forEach((ratingNote: EntityRatingNote): void => {
            let index: number = -1;
            for(let i: number = 0; i < bestCivsEntities.length; i++)
                if(bestCivsEntities[i].id === ratingNote.civilizationID) {
                    index = i;
                    break;
                }
            if(index === -1) {
                bestCivsEntities.push(new BestCivsEntity(ratingNote.civilizationID as number));
                index = bestCivsEntities.length-1;
            }
            (ratingNote.typedRating >= 0)
                ? bestCivsEntities[index].victories++
                : bestCivsEntities[index].defeats++;
        });
        bestCivsEntities.sort((a, b): number => a.winrate-b.winrate || a.victories-b.victories || a.id-b.id);
        return bestCivsEntities;
    }

    public async profile(interaction: CommandInteraction | ButtonInteraction, member: GuildMember | null) {
        if(!member)
            member = interaction.member as GuildMember;
        let title: string = await this.getOneText(interaction, "PROFILE_TITLE", member.user.tag);
        let fieldHeaders: string[] = await this.getManyText(interaction, [
            "PROFILE_FFA_FIELD_TITLE", "PROFILE_FFA_VICTORIES_FIELD_TITLE",
            "PROFILE_TEAMERS_FIELD_TITLE", "PROFILE_TEAMERS_VICTORIES_FIELD_TITLE",
        ]);
        let generalLines: string[] = await this.getManyText(interaction, [
            "PROFILE_GENERAL_RATING", "PROFILE_GENERAL_HOST",
            "PROFILE_GENERAL_SUB", "PROFILE_GENERAL_LEAVE",
            "PROFILE_GENERAL_LAST_GAME"
        ]);
        let ffaLines: string[] = await this.getManyText(interaction, [
            "PROFILE_FFA_RATING", "PROFILE_FFA_GAMES",
            "PROFILE_FFA_WIN_LOSS", "PROFILE_FFA_FIRST"
        ]);
        let teamersLines: string[] = await this.getManyText(interaction, [
            "PROFILE_TEAMERS_RATING", "PROFILE_TEAMERS_GAMES",
            "PROFILE_TEAMERS_WIN_LOSS"
        ]);
        let labels: string[] = await this.getManyText(interaction, [
            "PROFILE_SHOW_HISTORY_BUTTON", "PROFILE_DELETE_BUTTON"
        ]);

        let embed: EmbedBuilder[] = this.profileUI.profileEmbed(
            member.user, interaction.member?.user as User,
            await this.databaseServiceUserRating.getOne(interaction.guild?.id as string, member.id),
            title, fieldHeaders,
            generalLines, ffaLines, teamersLines

        ), component: ActionRowBuilder<ButtonBuilder>[] = this.profileUI.profileButtons(
            labels,
            interaction.user.id,
            member.id
        );

        if(interaction.type === InteractionType.MessageComponent)
            await interaction.message.edit({embeds: embed, components: component});
        else
            await interaction.reply({embeds: embed, components: component});
    }

    public async profileShowHistoryButton(interaction: ButtonInteraction) {
        await interaction.deferUpdate();
        if(!this.isOwner(interaction))
            return;
        let member: GuildMember = await (interaction.guild as Guild).members.fetch(interaction.customId.split("-")[3]);
        await this.history(interaction, member);
    }

    public async profileDeleteButton(interaction: ButtonInteraction) {
        await interaction.deferUpdate();
        if(!this.isOwner(interaction))
            return;
        await interaction.message.delete();
    }



    public async history(interaction: CommandInteraction | ButtonInteraction, member: GuildMember | null, pageCurrent: number = 1) {
        if(!member)
            member = interaction.member as GuildMember;
        let ratingNotes: EntityRatingNote[] = await this.databaseServiceRatingNote.getAllByUserID(interaction.guild?.id as string, member.id);
        let pageTotal: number = Math.ceil(ratingNotes.length/this.historyLinesPerPage);
        switch(pageCurrent) {
            case 99:                            // нельзя использовать одинаковые ID кнопок
                pageCurrent = 1; break;         // поэтому чтобы избежать повторений, было сделано это
            case 100:
                pageCurrent = pageTotal; break;
        }
    
        let title: string = await this.getOneText(interaction, "HISTORY_TITLE", 
            member.user.tag, pageCurrent, Math.max(pageTotal, 1)
        );
        let otherLines: string[] = await this.getManyText(interaction, [
            "HISTORY_DESCRIPTION_EMPTY", "HISTORY_RESULT_TEAMERS_DEFEAT",
            "HISTORY_RESULT_TEAMERS_VICTORY", "HISTORY_RESULT_SUB_OUT"
        ]);
        let fieldTitles: string[] = await this.getManyText(interaction, [
            "HISTORY_DATE_AND_TYPE_FIELD_TITLE", "HISTORY_RESULT_FIELD_TITLE",
            "HISTORY_CIV_FIELD_TITLE"
        ]);
        let labels: string[] = await this.getManyText(interaction, [
            "HISTORY_SHOW_PROFILE_BUTTON", "HISTORY_DELETE_BUTTON"
        ]);
        let civLines: string[] = (await this.getManyText(interaction, UtilsServiceCivilizations.civilizationsTags))
            .map(str => str.slice(str.indexOf("<")));

        let embed: EmbedBuilder[] = this.profileUI.historyEmbed(
            interaction.user, 
            ratingNotes.slice(
                (pageCurrent-1)*this.historyLinesPerPage, 
                (pageCurrent)*this.historyLinesPerPage), 
            title,
            fieldTitles,
            otherLines,
            civLines
        ), component: ActionRowBuilder<ButtonBuilder>[] = this.profileUI.historyButtons(
            labels, 
            interaction.user.id, 
            member.id, 
            pageCurrent, 
            pageTotal
        );

        if(interaction.type === InteractionType.MessageComponent)
            await interaction.message.edit({embeds: embed, components: component});
        else 
            await interaction.reply({embeds: embed, components: component});
    }

    public async historyPageButton(interaction: ButtonInteraction) {
        await interaction.deferUpdate();
        if(!this.isOwner(interaction))
            return;
        let userID: string = interaction.customId.split("-")[1];
        let member: GuildMember = await interaction.guild?.members.fetch(userID) as GuildMember;
        let pageCurrent: number = Number(interaction.customId.split("-")[3]);
        await this.history(interaction, member, pageCurrent);
    }

    public async historyShowProfileButton(interaction: ButtonInteraction) {
        await interaction.deferUpdate();
        if(!this.isOwner(interaction))
            return;
        let member: GuildMember = await (interaction.guild as Guild).members.fetch(interaction.customId.split("-")[3]);
        await this.profile(interaction, member);
    }

    public async historyDeleteButton(interaction: ButtonInteraction) {
        await interaction.deferUpdate();
        if(!this.isOwner(interaction))
            return;
        await interaction.message.delete();
    }



    public async bestCivs(
        interaction: CommandInteraction | ButtonInteraction, 
        member: GuildMember | null, 
        type: string, 
        pageCurrent: number = 1
    ) {
        if(!member)
            member = interaction.member as GuildMember;
        let bestCivsEntities: BestCivsEntity[] = this.formBestCivs(
            await this.databaseServiceRatingNote.getAllByUserIDBestCivs(interaction.guild?.id as string, member.id, type)
        );
        let pageTotal: number = Math.ceil(bestCivsEntities.length/this.bestCivsPerPage);
        switch(pageCurrent) {
            case 99:                            // нельзя использовать одинаковые ID кнопок
                pageCurrent = 1; break;         // поэтому чтобы избежать повторений, было сделано это
            case 100:
                pageCurrent = pageTotal; break;
        }
        let title: string = await this.getOneText(interaction, 
            (type === "Total") ? "BEST_CIVS_TOTAL_TITLE"
            : (type === "FFA") ? "BEST_CIVS_FFA_TITLE"
            : "BEST_CIVS_TEAMERS_TITLE",
            member.user.tag, pageCurrent, Math.max(Math.ceil(bestCivsEntities.length/this.bestCivsPerPage), 1)
        );
        let emptyDescription: string = await this.getOneText(interaction, "BEST_CIVS_DESCRIPTION_EMPTY");
        let fieldTitles: string[] = await this.getManyText(interaction, [
            "BEST_CIVS_LEADER_FIELD_TITLE", "BEST_CIVS_VICTORIES_DEFEATS_FIELD_TITLE",
            "BEST_CIVS_WINRATE_FIELD_TITLE"
        ]);
        let label: string = await this.getOneText(interaction, "BEST_CIVS_DELETE_BUTTON");
        let civLines: string[] = (await this.getManyText(interaction, UtilsServiceCivilizations.civilizationsTags))
            .map(str => str.slice(str.indexOf("<")));

        let embed: EmbedBuilder[] = this.profileUI.bestCivsEmbed(
            interaction.user, 
            bestCivsEntities.slice(
                (pageCurrent-1)*this.bestCivsPerPage, 
                (pageCurrent)*this.bestCivsPerPage), 
            title,
            emptyDescription,
            fieldTitles,
            civLines
        ), component: ActionRowBuilder<ButtonBuilder>[] = this.profileUI.bestCivsButtons(
            label, 
            interaction.user.id, 
            member.id, 
            type,
            pageCurrent, 
            pageTotal
        );

        if(interaction.type === InteractionType.MessageComponent)
            await interaction.message.edit({embeds: embed, components: component});
        else 
            await interaction.reply({embeds: embed, components: component});
    }

    public async bestCivsPageButton(interaction: ButtonInteraction) {
        await interaction.deferUpdate();
        if(!this.isOwner(interaction))
            return;
        let type: string = interaction.customId.split("-")[1];
        let userID: string = interaction.customId.split("-")[3];
        let member: GuildMember = await interaction.guild?.members.fetch(userID) as GuildMember;
        let pageCurrent: number = Number(interaction.customId.split("-")[4]);
        await this.bestCivs(interaction, member, type, pageCurrent);
    }

    public async bestCivsDeleteButton(interaction: ButtonInteraction) {
        await interaction.deferUpdate();
        if(!this.isOwner(interaction))
            return;
        await interaction.message.delete();
    }
}
