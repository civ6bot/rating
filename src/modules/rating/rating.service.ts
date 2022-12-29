import { ButtonInteraction, CommandInteraction, EmbedBuilder, GuildMember, TextChannel } from "discord.js";
import { EntityRatingNote } from "../../database/entities/entity.RatingNote";
import { EntityUserRating } from "../../database/entities/entity.UserRating";
import { DatabaseServiceRatingNote } from "../../database/services/service.RatingNote";
import { DatabaseServiceUserRating } from "../../database/services/service.UserRating";
import { UtilsServiceCivilizations } from "../../utils/services/utils.service.civilizations";
import { UtilsServiceUsers } from "../../utils/services/utils.service.users";
import { ModuleBaseService } from "../base/base.service";
import { RatingUI } from "./rating.ui";

export class RatingService extends ModuleBaseService {
    private ratingUI: RatingUI = new RatingUI();

    private databaseServiceUserRating: DatabaseServiceUserRating = new DatabaseServiceUserRating();
    private databaseServiceRatingNote: DatabaseServiceRatingNote = new DatabaseServiceRatingNote();

    private isOwner(interaction: ButtonInteraction): boolean {
        return interaction.customId.split("-").pop() === interaction.user.id;
    }

    private async isModerator(interaction: CommandInteraction | ButtonInteraction): Promise<boolean> {
        let member: GuildMember = interaction.member as GuildMember;
        if(UtilsServiceUsers.isAdmin(member))
            return true;
        let moderationRolesID: string[] = (await this.getOneSettingString(
            interaction, "MODERATION_ROLE_MODERATORS_ID"
        )).split(" ");
        return member.roles.cache.some((value, key) => (moderationRolesID.indexOf(key) !== -1));
    }

    private getEloRatingChange(
        ratingA: number, ratingB: number,
        eloK: number, eloD: number, isTie: boolean = false
    ): number { return Math.round(eloK * ((isTie ? 0.5 : 1) - 1/(1+Math.pow(10, (ratingB-ratingA)/eloD)))); }

    private generateRatingNotes(
        usersRating: EntityUserRating[], 
        gameID: number,
        gameType: string,
        victoryType: string,

        eloD: number,
        eloK: number,

        hostIndex: number,
        tieIndexes: number[][],
        leaveIndexes: number[],
        subIndexes: number[]
    ): EntityRatingNote[] {
        
    }

    private syntaxAnalyzer() {

    }

    private applyRating(
        usersRating: EntityUserRating[],
        ratingNotes: EntityRatingNote[],
        isCancel: boolean = false
    ): void {
        let type: string = ratingNotes[0].gameType;
        let cancelMultiplier: number = (isCancel) ? -1 : 1;
        for(let i in usersRating) {
            ratingNotes[i].isActive = !isCancel;
            usersRating[i].rating += ratingNotes[i].rating*cancelMultiplier;
            usersRating[i].host = Math.max(usersRating[i].host+Number(ratingNotes[i].isHost)*cancelMultiplier, 0);
            usersRating[i].subIn = Math.max(usersRating[i].subIn+Number(ratingNotes[i].isSubIn)*cancelMultiplier, 0);
            usersRating[i].subOut = Math.max(usersRating[i].subOut+Number(ratingNotes[i].isSubOut)*cancelMultiplier, 0);
            usersRating[i].leave = Math.max(usersRating[i].leave+Number(ratingNotes[i].isLeave)*cancelMultiplier, 0);
            if(!isCancel)
                usersRating[i].lastGame = ratingNotes[i].date;
            if(type === "FFA") {
                usersRating[i].ffaRating += ratingNotes[i].typedRating*cancelMultiplier;
                usersRating[i].ffaTotal = Math.max(usersRating[i].ffaTotal+cancelMultiplier, 0);
                if(!ratingNotes[i].isSubOut) {
                    usersRating[i].ffaWin = Math.max(usersRating[i].ffaWin+(ratingNotes[i].typedRating >= 0 ? 1 : 0)*cancelMultiplier, 0);
                    usersRating[i].ffaLose = Math.max(usersRating[i].ffaLose+(ratingNotes[i].typedRating < 0 ? 1 : 0)*cancelMultiplier, 0);
                    usersRating[i].ffaFirst = Math.max(usersRating[i].ffaFirst+(ratingNotes[i].place === 1 ? 1 : 0)*cancelMultiplier, 0);
                    if(ratingNotes[i].victoryType !== null)
                    switch(ratingNotes[i].victoryType) {
                        case "Science":
                            usersRating[i].ffaVictoryScience = Math.max(usersRating[i].ffaVictoryScience+cancelMultiplier, 0); break;
                        case "Culture":
                            usersRating[i].ffaVictoryCulture = Math.max(usersRating[i].ffaVictoryCulture+cancelMultiplier, 0); break;
                        case "Domination":
                            usersRating[i].ffaVictoryDomination = Math.max(usersRating[i].ffaVictoryDomination+cancelMultiplier, 0); break;
                        case "Religious":
                            usersRating[i].ffaVictoryReligious = Math.max(usersRating[i].ffaVictoryReligious+cancelMultiplier, 0); break;
                        case "Diplomatic":
                            usersRating[i].ffaVictoryDiplomatic = Math.max(usersRating[i].ffaVictoryDiplomatic+cancelMultiplier, 0); break;
                        case "CC":
                            usersRating[i].ffaVictoryCC = Math.max(usersRating[i].ffaVictoryCC+cancelMultiplier, 0); break;
                    }
                }
            } else {
                usersRating[i].teamersRating += ratingNotes[i].typedRating*cancelMultiplier;
                usersRating[i].teamersTotal = Math.max(usersRating[i].teamersTotal+cancelMultiplier, 0);
                if(!ratingNotes[i].isSubOut){
                    usersRating[i].teamersWin = Math.max(usersRating[i].teamersWin+(ratingNotes[i].typedRating >= 0 ? 1 : 0)*cancelMultiplier, 0);
                    usersRating[i].teamersLose = Math.max(usersRating[i].teamersLose+(ratingNotes[i].typedRating < 0 ? 1 : 0)*cancelMultiplier, 0);
                    if(ratingNotes[i].victoryType !== null)
                    switch(ratingNotes[i].victoryType) {
                        case "Science":
                            usersRating[i].teamersVictoryScience = Math.max(usersRating[i].teamersVictoryScience+cancelMultiplier, 0); break;
                        case "Culture":
                            usersRating[i].teamersVictoryCulture = Math.max(usersRating[i].teamersVictoryCulture+cancelMultiplier, 0); break;
                        case "Domination":
                            usersRating[i].teamersVictoryDomination = Math.max(usersRating[i].teamersVictoryDomination+cancelMultiplier, 0); break;
                        case "Religious":
                            usersRating[i].teamersVictoryReligious = Math.max(usersRating[i].teamersVictoryReligious+cancelMultiplier, 0); break;
                        case "Diplomatic":
                            usersRating[i].teamersVictoryDiplomatic = Math.max(usersRating[i].teamersVictoryDiplomatic+cancelMultiplier, 0); break;
                        case "GG":
                            usersRating[i].teamersVictoryGG = Math.max(usersRating[i].teamersVictoryGG+cancelMultiplier, 0); break;
                    }
                }
            }
        }
    }

    public async report(interaction: CommandInteraction, type: string, msg: string) {
        
    }

    public async reportUserEditButton(interaction: ButtonInteraction) {
        
    }

    public async reportUserDeleteButton(interaction: ButtonInteraction) {
        
    }

    public async reportUserConfirmButton(interaction: ButtonInteraction) {
        
    }

    public async reportModeratorCancelButton(interaction: ButtonInteraction) {
        if(!(await this.isModerator(interaction))) {
            let textLines: string[] = await this.getManyText(interaction, [
                "BASE_ERROR_TITLE", "RATING_ERROR_NO_PERMISSION"
            ]);
            return await interaction.reply({embeds: this.ratingUI.error(textLines[0], textLines[1]), ephemeral: true});
        }
    }

    public async reportModeratorApplyButton(interaction: ButtonInteraction) {
        if(!(await this.isModerator(interaction))) {
            let textLines: string[] = await this.getManyText(interaction, [
                "BASE_ERROR_TITLE", "RATING_ERROR_NO_PERMISSION"
            ]);
            return await interaction.reply({embeds: this.ratingUI.error(textLines[0], textLines[1]), ephemeral: true});
        }
    }



    public async cancel(interaction: CommandInteraction, gameID: number) {
        if(!(await this.isModerator(interaction))) {
            let textLines: string[] = await this.getManyText(interaction, [
                "BASE_ERROR_TITLE", "RATING_ERROR_NO_PERMISSION"
            ]);
            return await interaction.reply({embeds: this.ratingUI.error(textLines[0], textLines[1]), ephemeral: true});
        }
        let ratingNotes: EntityRatingNote[] = await this.databaseServiceRatingNote.getAllByGameID(interaction.guild?.id as string, gameID);
        if(ratingNotes.length === 0) {
            let textLines: string[] = await this.getManyText(interaction, [
                "BASE_ERROR_TITLE", "RATING_ERROR_WRONG_GAME_ID"
            ]);
            return await interaction.reply({embeds: this.ratingUI.error(textLines[0], textLines[1]), ephemeral: true});
        }
        if(!ratingNotes[0].isActive) {
            let textLines: string[] = await this.getManyText(interaction, [
                "BASE_ERROR_TITLE", "RATING_ERROR_ALREADY_CANCELLED"
            ]);
            return await interaction.reply({embeds: this.ratingUI.error(textLines[0], textLines[1]), ephemeral: true});
        }
        let usersRating: EntityUserRating[] = await this.databaseServiceUserRating.getMany(interaction.guild?.id as string, ratingNotes.map((ratingNote: EntityRatingNote): string => ratingNote.userID));
        this.applyRating(usersRating, ratingNotes, true);
        this.databaseServiceUserRating.update(usersRating);
        this.databaseServiceRatingNote.updateAll(ratingNotes);

        let title: string = await this.getOneText(interaction, "RATING_CANCEL_TITLE");
        let descriptionHeaders: string[] = await this.getManyText(interaction, [
            "RATING_DESCRIPTION_ID_HEADER", "RATING_DESCRIPTION_GAME_TYPE_HEADER",
            "RATING_DESCRIPTION_HOST_HEADER"
        ]);
        let moderatorPrefix: string = await this.getOneText(interaction, "RATING_MODERATOR_PREFIX_BOTTOM");
        let embed: EmbedBuilder[] = this.ratingUI.reportCancel(
            interaction.user,
            usersRating, ratingNotes,
            title, descriptionHeaders, moderatorPrefix
        );
        await interaction.reply({embeds: embed});

        let channelID: string = await this.getOneSettingString(interaction, "RATING_BOT_REPORTS_CHANNEL_ID");
        if(channelID !== "")
            try {
                let channel: TextChannel|null = (await interaction.guild?.channels.fetch(channelID)) as (TextChannel|null);
                channel?.send({embeds: embed});
            } catch {}
    }

    public async revert(interaction: CommandInteraction, gameID: number) {
        if(!(await this.isModerator(interaction))) {
            let textLines: string[] = await this.getManyText(interaction, [
                "BASE_ERROR_TITLE", "RATING_ERROR_NO_PERMISSION"
            ]);
            return await interaction.reply({embeds: this.ratingUI.error(textLines[0], textLines[1]), ephemeral: true});
        }
        let ratingNotes: EntityRatingNote[] = await this.databaseServiceRatingNote.getAllByGameID(interaction.guild?.id as string, gameID);
        if(ratingNotes.length === 0) {
            let textLines: string[] = await this.getManyText(interaction, [
                "BASE_ERROR_TITLE", "RATING_ERROR_WRONG_GAME_ID"
            ]);
            return await interaction.reply({embeds: this.ratingUI.error(textLines[0], textLines[1]), ephemeral: true});
        }
        if(ratingNotes[0].isActive) {
            let textLines: string[] = await this.getManyText(interaction, [
                "BASE_ERROR_TITLE", "RATING_ERROR_ALREADY_REVERTED"
            ]);
            return await interaction.reply({embeds: this.ratingUI.error(textLines[0], textLines[1]), ephemeral: true});
        }
        let usersRating: EntityUserRating[] = await this.databaseServiceUserRating.getMany(interaction.guild?.id as string, ratingNotes.map((ratingNote: EntityRatingNote): string => ratingNote.userID));
        this.applyRating(usersRating, ratingNotes);
        this.databaseServiceUserRating.update(usersRating);
        this.databaseServiceRatingNote.updateAll(ratingNotes);

        let title: string = await this.getOneText(interaction, "RATING_REVERT_TITLE");
        let descriptionHeaders: string[] = await this.getManyText(interaction, [
            "RATING_DESCRIPTION_ID_HEADER", "RATING_DESCRIPTION_GAME_TYPE_HEADER",
            "RATING_DESCRIPTION_HOST_HEADER", "RATING_DESCRIPTION_VICTORY_TYPE_HEADER"
        ]);
        let victoryLines: string[] = await this.getManyText(interaction, [
            "RATING_DESCRIPTION_VICTORY_SCIENCE", "RATING_DESCRIPTION_VICTORY_CULTURE",
            "RATING_DESCRIPTION_VICTORY_DOMINATION", "RATING_DESCRIPTION_VICTORY_RELIGIOUS",
            "RATING_DESCRIPTION_VICTORY_DIPLOMATIC", "RATING_DESCRIPTION_VICTORY_CC",
            "RATING_DESCRIPTION_VICTORY_GG"
        ]);
        let moderatorPrefix: string = await this.getOneText(interaction, "RATING_MODERATOR_PREFIX_BOTTOM");
        let civLines: string[] = (await this.getManyText(interaction, UtilsServiceCivilizations.civilizationsTags))
            .map(str => str.slice(str.indexOf("<")));
        let embed: EmbedBuilder[] = this.ratingUI.report(
            interaction.user, true,
            usersRating, ratingNotes, [],
            title, descriptionHeaders, victoryLines, civLines, moderatorPrefix
        );
        await interaction.reply({embeds: embed});

        let channelID: string = await this.getOneSettingString(interaction, "RATING_BOT_REPORTS_CHANNEL_ID");
        if(channelID !== "")
            try {
                let channel: TextChannel|null = (await interaction.guild?.channels.fetch(channelID)) as (TextChannel|null);
                channel?.send({embeds: embed});
            } catch {}
    }



    public async setUser(interaction: CommandInteraction, member: GuildMember, type: string, amount: number) {
        if(!(await this.isModerator(interaction))) {
            let textLines: string[] = await this.getManyText(interaction, [
                "BASE_ERROR_TITLE", "RATING_ERROR_NO_PERMISSION"
            ]);
            return await interaction.reply({embeds: this.ratingUI.error(textLines[0], textLines[1]), ephemeral: true});
        }
        let userRating: EntityUserRating = await this.databaseServiceUserRating.getOne(interaction.guild?.id as string, member.id);
        if((type === "FFA" ? userRating.ffaRating : userRating.teamersRating) === amount) {
            let textLines: string[] = await this.getManyText(interaction, [
                "BASE_ERROR_TITLE", "RATING_ERROR_SAME_VALUE"
            ]);
            return await interaction.reply({embeds: this.ratingUI.error(textLines[0], textLines[1]), ephemeral: true});
        }
        await this.addUser(interaction, member, type, amount-((type === "FFA" ? userRating.ffaRating : userRating.teamersRating)));
    }

    public async addUser(interaction: CommandInteraction, member: GuildMember, type: string, amount: number) {
        if(!(await this.isModerator(interaction))) {
            let textLines: string[] = await this.getManyText(interaction, [
                "BASE_ERROR_TITLE", "RATING_ERROR_NO_PERMISSION"
            ]);
            return await interaction.reply({embeds: this.ratingUI.error(textLines[0], textLines[1]), ephemeral: true});
        }
        if(amount === 0) {
            let textLines: string[] = await this.getManyText(interaction, [
                "BASE_ERROR_TITLE", "RATING_ERROR_ZERO_DIFFERENCE"
            ]);
            return await interaction.reply({embeds: this.ratingUI.error(textLines[0], textLines[1]), ephemeral: true});
        }
        let userRating: EntityUserRating = await this.databaseServiceUserRating.getOne(interaction.guild?.id as string, member.id);
        if((type === "FFA" ? userRating.ffaRating : userRating.teamersRating) + amount < 0) {
            let textLines: string[] = await this.getManyText(interaction, [
                "BASE_ERROR_TITLE", "RATING_ERROR_NEGATIVE_RESULT"
            ]);
            return await interaction.reply({embeds: this.ratingUI.error(textLines[0], textLines[1]), ephemeral: true});
        }
        (type === "FFA") ? userRating.ffaRating += amount : userRating.teamersRating += amount;
        await this.databaseServiceUserRating.update(userRating);

        let title: string = await this.getOneText(interaction, "RATING_ADD_TITLE");
        let fieldTitles: string[] = await this.getManyText(interaction, [
            "RATING_ADD_FIELD_PLAYER_TITLE", "RATING_ADD_FIELD_TYPE_TITLE",
            "RATING_ADD_FIELD_VALUE_TITLE"
        ]);
        let moderatorPrefix: string = await this.getOneText(interaction, "RATING_MODERATOR_PREFIX_BOTTOM");
        let embed: EmbedBuilder[] = this.ratingUI.addUser(
            interaction.user, userRating, type, amount, 
            title, fieldTitles, moderatorPrefix
        );
        await interaction.reply({embeds: embed});

        let channelID: string = await this.getOneSettingString(interaction, "RATING_BOT_REPORTS_CHANNEL_ID");
        if(channelID !== "")
            try {
                let channel: TextChannel|null = (await interaction.guild?.channels.fetch(channelID)) as (TextChannel|null);
                channel?.send({embeds: embed});
            } catch {}
    }



    public async resetUser(interaction: CommandInteraction, member: GuildMember) {
        if(!(await this.isModerator(interaction))) {
            let textLines: string[] = await this.getManyText(interaction, [
                "BASE_ERROR_TITLE", "RATING_ERROR_NO_PERMISSION"
            ]);
            return await interaction.reply({embeds: this.ratingUI.error(textLines[0], textLines[1]), ephemeral: true});
        }
        let textLines: string[] = await this.getManyText(interaction, [
            "RATING_RESET_USER_TITLE", "RATING_RESET_USER_DESCRIPTION"
        ], [null, [member.id]]);
        let labels: string[] = await this.getManyText(interaction, [
            "RATING_CONFIRM_BUTTON", "RATING_CANCEL_BUTTON" 
        ]);
        await interaction.reply({
            embeds: this.ratingUI.notify(textLines[0], textLines[1]),
            components: this.ratingUI.resetUserButtons(interaction.user.id, member.id, labels)
        });
    }

    public async resetUserCancelButton(interaction: ButtonInteraction) {
        await interaction.deferUpdate();
        if(!this.isOwner(interaction))
            return;
        await interaction.message.delete();
    }

    public async resetUserConfirmButton(interaction: ButtonInteraction) {
        if(!(await this.isModerator(interaction))) {
            let textLines: string[] = await this.getManyText(interaction, [
                "BASE_ERROR_TITLE", "RATING_ERROR_NO_PERMISSION"
            ]);
            await interaction.reply({embeds: this.ratingUI.error(textLines[0], textLines[1]), ephemeral: true});
            return await interaction.message.delete();
        }
        await interaction.deferUpdate();
        if(!this.isOwner(interaction))
            return;
        
        let userID: string = interaction.customId.split("-")[4];
        let userRating: EntityUserRating = await this.databaseServiceUserRating.getOne(interaction.guild?.id as string, userID);
        let ratingDefaultPoints: number = await this.getOneSettingNumber(interaction, "RATING_DEFAULT_POINTS");
        userRating.ffaRating = ratingDefaultPoints;
        userRating.teamersRating = ratingDefaultPoints;
        await this.databaseServiceUserRating.update(userRating);

        let textLines: string[] = await this.getManyText(interaction, [
            "BASE_NOTIFY_TITLE", "RATING_RESET_USER_NOTIFICATION_DESCRIPTION"
        ], [null, [userID]]);
        await interaction.reply({embeds: this.ratingUI.notify(textLines[0], textLines[1]), ephemeral: true});
        await interaction.message.delete();
    }



    public async resetAll(interaction: CommandInteraction) {
        if(!(await this.isModerator(interaction))) {
            let textLines: string[] = await this.getManyText(interaction, [
                "BASE_ERROR_TITLE", "RATING_ERROR_NO_PERMISSION"
            ]);
            return await interaction.reply({embeds: this.ratingUI.error(textLines[0], textLines[1]), ephemeral: true});
        }
        let usersAmount: number = await this.databaseServiceUserRating.getUsersAmount(interaction.guild?.id as string);
        if(usersAmount === 0) {
            let textLines = await this.getManyText(interaction, [
                "BASE_ERROR_TITLE", "RATING_ERROR_ZERO_USERS"
            ]);
            return await interaction.reply({embeds: this.ratingUI.error(textLines[0], textLines[1]), ephemeral: true});
        }
        let textLines: string[] = await this.getManyText(interaction, [
            "RATING_RESET_ALL_TITLE", "RATING_RESET_ALL_DESCRIPTION"
        ], [null, [usersAmount]]);
        let labels: string[] = await this.getManyText(interaction, [
            "RATING_CONFIRM_BUTTON", "RATING_CANCEL_BUTTON" 
        ]);
        await interaction.reply({
            embeds: this.ratingUI.notify(textLines[0], textLines[1]),
            components: this.ratingUI.wipeAllButtons(interaction.user.id, labels)
        });
    }

    public async resetAllCancelButton(interaction: ButtonInteraction) {
        await interaction.deferUpdate();
        if(!this.isOwner(interaction))
            return;
        await interaction.message.delete();
    }

    public async resetAllConfirmButton(interaction: ButtonInteraction) {
        if(!(await this.isModerator(interaction))) {
            let textLines: string[] = await this.getManyText(interaction, [
                "BASE_ERROR_TITLE", "RATING_ERROR_NO_PERMISSION"
            ]);
            await interaction.reply({embeds: this.ratingUI.error(textLines[0], textLines[1]), ephemeral: true});
            return await interaction.message.delete();
        }
        await interaction.deferUpdate();
        if(!this.isOwner(interaction))
            return;
        
            let ratingDefaultPoints: number = await this.getOneSettingNumber(interaction, "RATING_DEFAULT_POINTS");
        let usersRating: EntityUserRating[] = await this.databaseServiceUserRating.getAll(interaction.guild?.id as string);
        usersRating.forEach((userRating: EntityUserRating) => {
            userRating.ffaRating = ratingDefaultPoints;
            userRating.teamersRating = ratingDefaultPoints;
        });
        await this.databaseServiceUserRating.update(usersRating);

        let textLines: string[] = await this.getManyText(interaction, [
            "BASE_NOTIFY_TITLE", "RATING_RESET_ALL_NOTIFICATION_DESCRIPTION"
        ], [null, [usersRating.length]]);
        await interaction.reply({embeds: this.ratingUI.notify(textLines[0], textLines[1]), ephemeral: true});
        await interaction.message.delete();
    }



    public async wipeUser(interaction: CommandInteraction, member: GuildMember) {
        if(!(await this.isModerator(interaction))) {
            let textLines: string[] = await this.getManyText(interaction, [
                "BASE_ERROR_TITLE", "RATING_ERROR_NO_PERMISSION"
            ]);
            return await interaction.reply({embeds: this.ratingUI.error(textLines[0], textLines[1]), ephemeral: true});
        }
        let textLines: string[] = await this.getManyText(interaction, [
            "RATING_WIPE_USER_TITLE", "RATING_WIPE_USER_DESCRIPTION"
        ], [null, [member.id]]);
        let labels: string[] = await this.getManyText(interaction, [
            "RATING_CONFIRM_BUTTON", "RATING_CANCEL_BUTTON" 
        ]);
        await interaction.reply({
            embeds: this.ratingUI.notify(textLines[0], textLines[1]),
            components: this.ratingUI.wipeUserButtons(interaction.user.id, member.id, labels)
        });
    }

    public async wipeUserCancelButton(interaction: ButtonInteraction) {
        await interaction.deferUpdate();
        if(!this.isOwner(interaction))
            return;
        await interaction.message.delete();
    }

    public async wipeUserConfirmButton(interaction: ButtonInteraction) {
        if(!(await this.isModerator(interaction))) {
            let textLines: string[] = await this.getManyText(interaction, [
                "BASE_ERROR_TITLE", "RATING_ERROR_NO_PERMISSION"
            ]);
            await interaction.reply({embeds: this.ratingUI.error(textLines[0], textLines[1]), ephemeral: true});
            return await interaction.message.delete();
        }
        await interaction.deferUpdate();
        if(!this.isOwner(interaction))
            return;
        
        let userID: string = interaction.customId.split("-")[4];
        await this.databaseServiceUserRating.deleteOne(interaction.guild?.id as string, userID);

        let textLines: string[] = await this.getManyText(interaction, [
            "BASE_NOTIFY_TITLE", "RATING_WIPE_USER_NOTIFICATION_DESCRIPTION"
        ], [null, [userID]]);
        await interaction.reply({embeds: this.ratingUI.notify(textLines[0], textLines[1]), ephemeral: true});
        await interaction.message.delete();
    }


    
    public async wipeAll(interaction: CommandInteraction) {
        if(!(await this.isModerator(interaction))) {
            let textLines: string[] = await this.getManyText(interaction, [
                "BASE_ERROR_TITLE", "RATING_ERROR_NO_PERMISSION"
            ]);
            return await interaction.reply({embeds: this.ratingUI.error(textLines[0], textLines[1]), ephemeral: true});
        }
        let usersAmount: number = await this.databaseServiceUserRating.getUsersAmount(interaction.guild?.id as string);
        if(usersAmount === 0) {
            let textLines = await this.getManyText(interaction, [
                "BASE_ERROR_TITLE", "RATING_ERROR_ZERO_USERS"
            ]);
            return await interaction.reply({embeds: this.ratingUI.error(textLines[0], textLines[1]), ephemeral: true});
        }
        let textLines: string[] = await this.getManyText(interaction, [
            "RATING_WIPE_ALL_TITLE", "RATING_WIPE_ALL_DESCRIPTION"
        ], [null, [usersAmount]]);
        let labels: string[] = await this.getManyText(interaction, [
            "RATING_CONFIRM_BUTTON", "RATING_CANCEL_BUTTON" 
        ]);
        await interaction.reply({
            embeds: this.ratingUI.notify(textLines[0], textLines[1]),
            components: this.ratingUI.wipeAllButtons(interaction.user.id, labels)
        });
    }

    public async wipeAllCancelButton(interaction: ButtonInteraction) {
        await interaction.deferUpdate();
        if(!this.isOwner(interaction))
            return;
        await interaction.message.delete();
    }

    public async wipeAllConfirmButton(interaction: ButtonInteraction) {
        if(!(await this.isModerator(interaction))) {
            let textLines: string[] = await this.getManyText(interaction, [
                "BASE_ERROR_TITLE", "RATING_ERROR_NO_PERMISSION"
            ]);
            await interaction.reply({embeds: this.ratingUI.error(textLines[0], textLines[1]), ephemeral: true});
            return await interaction.message.delete();
        }
        if(!this.isOwner(interaction))
            return await interaction.deferUpdate();

        let usersAmount: number = await this.databaseServiceUserRating.deleteAll(interaction.guild?.id as string);

        let textLines: string[] = await this.getManyText(interaction, [
            "BASE_NOTIFY_TITLE", "RATING_WIPE_ALL_NOTIFICATION_DESCRIPTION"
        ], [null, [usersAmount]]);
        await interaction.reply({embeds: this.ratingUI.notify(textLines[0], textLines[1]), ephemeral: true});
        await interaction.message.delete();
    }
}
