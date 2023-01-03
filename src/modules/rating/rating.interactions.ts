import { ApplicationCommandOptionType, ButtonInteraction, CommandInteraction, GuildMember, ModalSubmitInteraction } from "discord.js";
import {Discord, Slash, ButtonComponent, SlashGroup, SlashOption, SlashChoice, ModalComponent} from "discordx";
import { RatingService } from "./rating.service";

@Discord()
@SlashGroup({name: "rating", description: "Rating commands"})
@SlashGroup("rating")
export abstract class RatingInteractions {
    private ratingService: RatingService = new RatingService();

    @Slash({name: "report", description: "Create game report"})
    public async report(
        @SlashChoice({name: "FFA", value: "FFA"})
        @SlashChoice({name: "Teamers", value: "Teamers"})
        @SlashOption({
            name: "game-type",
            description: "type of game",
            type: ApplicationCommandOptionType.String,
            required: true
        }) gameType: string,
        @SlashOption({
            name: "report",
            description: "text with users, civilizations, etc.",
            type: ApplicationCommandOptionType.String,
            required: true,
        }) msg: string,
        interaction: CommandInteraction
    ) { await this.ratingService.report(interaction, gameType, msg); }

    @ButtonComponent({id: /rating-report-user-delete-\d+-\d+/})  // rating-report-user-delete-newGameID-authorID
    public async reportUserDeleteButton(
        interaction: ButtonInteraction
    ) { await this.ratingService.reportUserDeleteButton(interaction); }

    @ButtonComponent({id: /rating-report-user-confirm-\d+-\d+/})  // rating-report-user-confirm-newGameID-authorID
    public async reportUserConfirmButton(
        interaction: ButtonInteraction
    ) { await this.ratingService.reportUserConfirmButton(interaction); }

    @ButtonComponent({id: /rating-report-moderator-reject-\d+-\d+/})  // rating-report-moderator-reject-newGameID-authorID    Автор и любой модератор могут нажать
    public async reportModeratorRejectButton(
        interaction: ButtonInteraction
    ) { await this.ratingService.reportModeratorRejectButton(interaction); }

    @ModalComponent({id: /rating-report-moderator-reject-modal-\d+-\d+/}) // rating-report-moderator-reject-modal-newGameID-authorID     Ответ модератора
    public async modalSetting(
        interaction: ModalSubmitInteraction
    ) { await this.ratingService.reportModeratorRejectModal(interaction); }

    @ButtonComponent({id: /rating-report-moderator-accept-\d+/})  // rating-report-moderator-accept-newGameID-authorID    Любой модератор может нажать, authorID для обратной связи
    public async reportModeratorAcceptButton(
        interaction: ButtonInteraction
    ) { await this.ratingService.reportModeratorAcceptButton(interaction); }

    @Slash({name: "cancel", description: "Cancel game by ID"})
    public async cancel(
        @SlashOption({
            name: "id",
            description: "ID of game report to cancel",
            type: ApplicationCommandOptionType.Number,
            required: true,
        }) gameID: number,
        interaction: CommandInteraction
    ) { await this.ratingService.cancel(interaction, gameID); }

    @Slash({name: "revert", description: "Cancel game by ID"})
    public async revert(
        @SlashOption({
            name: "id",
            description: "ID of game report to re-confirm",
            type: ApplicationCommandOptionType.Number,
            required: true,
        }) gameID: number,
        interaction: CommandInteraction
    ) { await this.ratingService.revert(interaction, gameID); }

    @Slash({name: "set", description: "Set rating of user manually"})
    public async setUser(
        @SlashOption({
            name: "user",
            description: "user to change rating",
            type: ApplicationCommandOptionType.User,
            required: true,
        }) user: GuildMember,
        //@SlashChoice({name: "General", value: "General"})
        @SlashChoice({name: "FFA", value: "FFA"})
        @SlashChoice({name: "Teamers", value: "Teamers"})
        @SlashOption({
            name: "rating-type",
            description: "type of rating",
            type: ApplicationCommandOptionType.String,
            required: true
        }) gameType: string,
        @SlashOption({
            name: "amount",
            description: "rating amount",
            type: ApplicationCommandOptionType.Number,
            required: true,
        }) amount: number,
        interaction: CommandInteraction
    ) { await this.ratingService.setUser(interaction, user, gameType, amount); }

    
    @Slash({name: "add", description: "Add rating of user manually"})
    public async addUser(
        @SlashOption({
            name: "user",
            description: "user to change rating",
            type: ApplicationCommandOptionType.User,
            required: true,
        }) user: GuildMember,
        //@SlashChoice({name: "General", value: "General"})
        @SlashChoice({name: "FFA", value: "FFA"})
        @SlashChoice({name: "Teamers", value: "Teamers"})
        @SlashOption({
            name: "rating-type",
            description: "type of rating",
            type: ApplicationCommandOptionType.String,
            required: true
        }) gameType: string,
        @SlashOption({
            name: "amount",
            description: "rating amount",
            type: ApplicationCommandOptionType.Number,
            required: true,
        }) amount: number,
        interaction: CommandInteraction
    ) { await this.ratingService.addUser(interaction, user, gameType, amount); }
}

@Discord()
@SlashGroup({
    name: "reset",
    description: "Reset rating points of specify user or all users",
    root: "rating"
})
@SlashGroup("reset", "rating")
export abstract class RatingResetInteractions {
    private ratingService: RatingService = new RatingService();

    @Slash({name: "user", description: "Reset rating for user"})
    public async resetUser(
        @SlashOption({
            name: "user",
            description: "user to change rating",
            type: ApplicationCommandOptionType.User,
            required: true,
        }) user: GuildMember,
        interaction: CommandInteraction
    ) { await this.ratingService.resetUser(interaction, user); }

    @ButtonComponent({id: /rating-reset-user-cancel-\d+/})  // rating-reset-user-cancel-authorID
    public async resetUserCancelButton(
        interaction: ButtonInteraction
    ) { await this.ratingService.resetUserCancelButton(interaction); }

    @ButtonComponent({id: /rating-reset-user-confirm-\d+-\d+/})  // rating-reset-user-confirm-userID-authorID
    public async resetUserConfirmButton(
        interaction: ButtonInteraction
    ) { await this.ratingService.resetUserConfirmButton(interaction); }



    @Slash({name: "all", description: "Reset rating of all users"})
    public async resetAll(
        interaction: CommandInteraction
    ) { await this.ratingService.resetAll(interaction); }

    @ButtonComponent({id: /rating-reset-all-cancel-\d+/})  // rating-reset-all-cancel-authorID
    public async resetAllCancelButton(
        interaction: ButtonInteraction
    ) { await this.ratingService.resetAllCancelButton(interaction); }

    @ButtonComponent({id: /rating-reset-all-confirm-\d+/})  // rating-reset-all-confirm-authorID
    public async resetAllConfirmButton(
        interaction: ButtonInteraction
    ) { await this.ratingService.resetAllConfirmButton(interaction); }
}

@Discord()
@SlashGroup({
    name: "wipe",
    description: "Delete all rating information of specify user or all users",
    root: "rating"
})
@SlashGroup("wipe", "rating")
export abstract class RatingWipeInteractions {
    private ratingService: RatingService = new RatingService();

    @Slash({name: "user", description: "Delete all rating information of user"})
    public async wipeUser(
        @SlashOption({
            name: "user",
            description: "user to delete rating information",
            type: ApplicationCommandOptionType.User,
            required: true,
        }) user: GuildMember,
        interaction: CommandInteraction
    ) { await this.ratingService.wipeUser(interaction, user); }

    @ButtonComponent({id: /rating-wipe-user-cancel-\d+/})  // rating-wipe-user-cancel-authorID
    public async wipeUserCancelButton(
        interaction: ButtonInteraction
    ) { await this.ratingService.wipeUserCancelButton(interaction); }

    @ButtonComponent({id: /rating-wipe-user-confirm-\d+-\d+/})  // rating-wipe-user-confirm-userID-authorID
    public async wipeUserConfirmButton(
        interaction: ButtonInteraction
    ) { await this.ratingService.wipeUserConfirmButton(interaction); }



    @Slash({name: "all", description: "Delete all rating information of all users"})
    public async wipeAll(
        interaction: CommandInteraction
    ) { await this.ratingService.wipeAll(interaction); }

    @ButtonComponent({id: /rating-wipe-all-cancel-\d+/})  // rating-wipe-all-cancel-authorID
    public async wipeAllCancelButton(
        interaction: ButtonInteraction
    ) { await this.ratingService.wipeAllCancelButton(interaction); }

    @ButtonComponent({id: /rating-wipe-all-confirm-\d+/})  // rating-wipe-all-confirm-authorID
    public async wipeAllConfirmButton(
        interaction: ButtonInteraction
    ) { await this.ratingService.wipeAllConfirmButton(interaction); }
}
