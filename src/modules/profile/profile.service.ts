import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, CommandInteraction, EmbedBuilder, Guild, GuildMember, InteractionType, User } from "discord.js";
import { EntityRatingNote } from "../../database/entities/entity.RatingNote";
import { EntityUserRating } from "../../database/entities/entity.UserRating";
import { DatabaseServiceRatingNote } from "../../database/services/service.RatingNote";
import { DatabaseServiceUserRating } from "../../database/services/service.UserRating";
import { UtilsDataCivilizations } from "../../utils/data/utils.data.civilizations";
import { UtilsServiceUsers } from "../../utils/services/utils.service.users";
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

    private formBestCivs(ratingNotes: EntityRatingNote[], gameType: string): BestCivsEntity[] {
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
            if(gameType === "FFA") {
                bestCivsEntities[index].places.push(ratingNote.place);
                bestCivsEntities[index].placesTotal.push(ratingNote.placeTotal);
            }
        });
        if(gameType === "FFA") {
            bestCivsEntities.forEach((bestCivsEntity: BestCivsEntity) => bestCivsEntity.setAveragePlace());
            bestCivsEntities.sort((a, b): number => a.averagePlace-b.averagePlace || b.victories-a.victories || a.defeats-b.defeats || a.id-b.id);
        } else 
            bestCivsEntities.sort((a, b): number => b.winrate-a.winrate || b.victories-a.victories || a.defeats-b.defeats || a.id-b.id);
        return bestCivsEntities;
    }

    public async profile(interaction: CommandInteraction | ButtonInteraction, member: GuildMember | null) {
        if(!member)
            member = interaction.member as GuildMember;
        let title: string = await this.getOneText(interaction, "PROFILE_TITLE", member.user.username);
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
            interaction.message.edit({embeds: embed, components: component});
        else
            interaction.reply({embeds: embed, components: component});
    }

    public async profileShowHistoryButton(interaction: ButtonInteraction) {
        interaction.deferUpdate();
        if(!this.isOwner(interaction))
            return;
        let member: GuildMember = await (interaction.guild as Guild).members.fetch(interaction.customId.split("-")[3]);
        this.history(interaction, member);
    }

    public async profileDeleteButton(interaction: ButtonInteraction) {
        interaction.deferUpdate();
        if(!this.isOwner(interaction))
            return;
        interaction.message.delete().catch();
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
            member.user.username, pageCurrent, Math.max(pageTotal, 1)
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
        let civEmojis: string[] = await this.getManySettingString(interaction, ...UtilsDataCivilizations.civilizationsTags.map((str: string): string => str+"_EMOJI"));
        let civLines: string[] = (await this.getManyText(interaction, UtilsDataCivilizations.civilizationsTags, civEmojis.map(str => [str]))).map(str => str.slice(str.indexOf("<")));

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
            interaction.message.edit({embeds: embed, components: component});
        else 
            interaction.reply({embeds: embed, components: component});
    }

    public async historyPageButton(interaction: ButtonInteraction) {
        interaction.deferUpdate();
        if(!this.isOwner(interaction))
            return;
        let userID: string = interaction.customId.split("-")[1];
        let member: GuildMember = await interaction.guild?.members.fetch(userID) as GuildMember;
        let pageCurrent: number = Number(interaction.customId.split("-")[3]);
        this.history(interaction, member, pageCurrent);
    }

    public async historyShowProfileButton(interaction: ButtonInteraction) {
        interaction.deferUpdate();
        if(!this.isOwner(interaction))
            return;
        let member: GuildMember = await (interaction.guild as Guild).members.fetch(interaction.customId.split("-")[3]);
        this.profile(interaction, member);
    }

    public async historyDeleteButton(interaction: ButtonInteraction) {
        interaction.deferUpdate();
        if(!this.isOwner(interaction))
            return;
        interaction.message.delete().catch();
    }



    public async lobbyRating(interaction: CommandInteraction) {
        let users: User[] = UtilsServiceUsers.getFromVoice(interaction);
        if(users.length === 0) {
            let textLines: string[] = await this.getManyText(interaction, [
                "BASE_ERROR_TITLE", "LOBBY_RATING_ERROR_NO_VOICE"
            ]);
            return interaction.reply({embeds: this.profileUI.error(textLines[0], textLines[1]), ephemeral: true});
        }
        
        let userRatings: EntityUserRating[] = (await this.databaseServiceUserRating.getMany(
            interaction.guild?.id as string, 
            users.map(user => user.id)
        )).sort((a, b) => b.rating-a.rating);

        let eloK: number = await this.getOneSettingNumber(interaction, "RATING_ELO_K");

        let title: string = await this.getOneText(interaction, "LOBBY_RATING_TITLE");
        let fieldTitles: string[] = await this.getManyText(interaction, [
            "LOBBY_RATING_PLAYER_FIELD_TITLE", "LOBBY_RATING_RATING_FIELD_TITLE"
        ]);
        let fieldValues: string[] = await this.getManyText(interaction, [
            "LOBBY_RATING_RATING_FIELD_LIST_TOTAL", "LOBBY_RATING_RATING_FIELD_LIST_FFA",
            "LOBBY_RATING_RATING_FIELD_LIST_TEAMERS"
        ]);

        interaction.reply({embeds: this.profileUI.lobbyRatingEmbed(
            interaction.user,
            userRatings,
            eloK,
            title,
            fieldTitles,
            fieldValues
        )});
    }


    
    public async bestCivs(
        interaction: CommandInteraction | ButtonInteraction, 
        gameType: string, 
        listType: string,
        member: GuildMember|null = null,
        pageCurrent: number = 1
    ) {
        if(!member)
            member = interaction.member as GuildMember;
        let bestCivsEntities: BestCivsEntity[];
        let title: string;
        switch(listType) {
            case "Global":
                bestCivsEntities = this.formBestCivs(await this.databaseServiceRatingNote.getBestCivs(
                    gameType
                ), gameType);
                break;
            case "Server":
                bestCivsEntities = this.formBestCivs(await this.databaseServiceRatingNote.getBestCivs(
                    gameType,
                    interaction.guild?.id as string
                ), gameType);
                break;
            case "Player":
            default:
                bestCivsEntities = this.formBestCivs(await this.databaseServiceRatingNote.getBestCivs(
                    gameType,
                    interaction.guild?.id as string, 
                    member.id, 
                ), gameType);
                break;
        }
        let pageTotal: number = Math.ceil(bestCivsEntities.length/this.bestCivsPerPage);
        switch(pageCurrent) {
            case 99:                            // нельзя использовать одинаковые ID кнопок
                pageCurrent = 1; break;         // поэтому чтобы избежать повторений, было сделано это
            case 100:
                pageCurrent = pageTotal; break;
        }
        switch(listType) {
            case "Global":
                title = await this.getOneText(interaction, 
                    (gameType === "Total") ? "BEST_CIVS_GLOBAL_TOTAL_TITLE"
                    : (gameType === "FFA") ? "BEST_CIVS_GLOBAL_FFA_TITLE"
                    : "BEST_CIVS_GLOBAL_TEAMERS_TITLE",
                    pageCurrent, Math.max(Math.ceil(bestCivsEntities.length/this.bestCivsPerPage), 1)
                );
                break;
            case "Server":
                title = await this.getOneText(interaction, 
                    (gameType === "Total") ? "BEST_CIVS_SERVER_TOTAL_TITLE"
                    : (gameType === "FFA") ? "BEST_CIVS_SERVER_FFA_TITLE"
                    : "BEST_CIVS_SERVER_TEAMERS_TITLE",
                    pageCurrent, Math.max(Math.ceil(bestCivsEntities.length/this.bestCivsPerPage), 1)
                );
                break;
            case "Player":
            default:
                title = await this.getOneText(interaction, 
                    (gameType === "Total") ? "BEST_CIVS_USER_TOTAL_TITLE"
                    : (gameType === "FFA") ? "BEST_CIVS_USER_FFA_TITLE"
                    : "BEST_CIVS_USER_TEAMERS_TITLE",
                    member.user.username, pageCurrent, Math.max(Math.ceil(bestCivsEntities.length/this.bestCivsPerPage), 1)
                );
                break;
        }
        let emptyDescription: string = await this.getOneText(interaction, "BEST_CIVS_DESCRIPTION_EMPTY");
        let fieldTitles: string[] = await this.getManyText(interaction, [
            "BEST_CIVS_LEADER_FIELD_TITLE", "BEST_CIVS_VICTORIES_DEFEATS_FIELD_TITLE",
            "BEST_CIVS_WINRATE_FIELD_TITLE", "BEST_CIVS_AVERAGE_PLACE_FFA_FIELD_TITLE"
        ]);
        let labels: string[] = await this.getManyText(interaction, [
            "BEST_CIVS_DELETE_BUTTON", "BEST_CIVS_SERVER_BUTTON",
            "BEST_CIVS_GLOBAL_BUTTON", "BEST_CIVS_FFA_BUTTON",
            "BEST_CIVS_TEAMERS_BUTTON", "BEST_CIVS_TOTAL_BUTTON"
        ]);
        let civEmojis: string[] = await this.getManySettingString(interaction, ...UtilsDataCivilizations.civilizationsTags.map((str: string): string => str+"_EMOJI"));
        let civLines: string[] = (await this.getManyText(interaction, UtilsDataCivilizations.civilizationsTags, civEmojis.map(str => [str]))).map(str => str.slice(str.indexOf("<")));

        let embed: EmbedBuilder[] = this.profileUI.bestCivsEmbed(
            interaction.user,
            gameType,
            bestCivsEntities.slice(
                (pageCurrent-1)*this.bestCivsPerPage, 
                (pageCurrent)*this.bestCivsPerPage), 
            title,
            emptyDescription,
            fieldTitles,
            civLines
        ), component: ActionRowBuilder<ButtonBuilder>[] = this.profileUI.bestCivsButtons(
            labels, 
            interaction.user.id, 
            member.id,
            listType,
            gameType,
            pageCurrent, 
            pageTotal
        );

        if(interaction.type === InteractionType.MessageComponent)
            interaction.message.edit({embeds: embed, components: component});
        else 
            interaction.reply({embeds: embed, components: component});
    }

    public async bestCivsPageButton(interaction: ButtonInteraction) {
        interaction.deferUpdate();
        if(!this.isOwner(interaction))
            return;
        let listType: string = interaction.customId.split("-")[1];
        let gameType: string = interaction.customId.split("-")[3];
        let userID: string = interaction.customId.split("-")[4];
        let member: GuildMember|null = (await interaction.guild?.members.fetch(userID)) || null;
        let pageCurrent: number = Number(interaction.customId.split("-")[5]);
        this.bestCivs(interaction, gameType, listType, member, pageCurrent);
    }

    public async bestCivsDeleteButton(interaction: ButtonInteraction) {
        interaction.deferUpdate();
        if(!this.isOwner(interaction))
            return;
        interaction.message.delete().catch();
    }
}
