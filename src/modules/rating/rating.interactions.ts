import { ApplicationCommandOptionType, ButtonInteraction, CommandInteraction, GuildMember } from "discord.js";
import {Discord, Slash, SelectMenuComponent, ModalComponent, ButtonComponent, SlashGroup, SlashOption, SlashChoice} from "discordx";
import { RatingService } from "./rating.service";

@Discord()
@SlashGroup({name: "rating", description: "Rating commands"})
@SlashGroup("rating")
export abstract class RatingInteractions {
    private ratingService: RatingService = new RatingService();

    @Slash({name: "ffa", description: "FFA game report"})
    public async ratingFFA(
        @SlashOption({
            name: "report",
            description: "text with users and keywords",
            type: ApplicationCommandOptionType.String,
            required: true,
        }) msg: string,
        interaction: CommandInteraction
    ) { await this.ratingService.ratingFFA(interaction, msg); }

    @Slash({name: "teamers", description: "Teamers game report"})
    public async ratingTeamers(
        @SlashOption({
            name: "report",
            description: "text with users and keywords",
            type: ApplicationCommandOptionType.String,
            required: true,
        }) msg: string,
        interaction: CommandInteraction
    ) { await this.ratingService.ratingTeamers(interaction, msg); }

    @ButtonComponent({id: /rating-report-user-edit-\d+-\d+/})  // rating-report-user-edit-authorID-newGameID
    public async ratingReportUserEditButton(
        interaction: ButtonInteraction
    ) { await this.ratingService.ratingReportUserEditButton(interaction); }

    @ButtonComponent({id: /rating-report-user-delete-\d+-\d+/})  // rating-report-user-delete-authorID-newGameID
    public async ratingReportUserDeleteButton(
        interaction: ButtonInteraction
    ) { await this.ratingService.ratingReportUserDeleteButton(interaction); }

    @ButtonComponent({id: /rating-user-confirm-\d+-\d+/})  // rating-user-confirm-authorID-newGameID
    public async ratingReportUserConfirmButton(
        interaction: ButtonInteraction
    ) { await this.ratingService.ratingReportUserConfirmButton(interaction); }

    @ButtonComponent({id: /rating-moderator-cancel-\d+/})  // rating-moderator-cancel-newGameID
    public async ratingReportModeratorCancelButton(
        interaction: ButtonInteraction
    ) { await this.ratingService.ratingReportModeratorCancelButton(interaction); }

    @ButtonComponent({id: /rating-moderator-apply-\d+/})  // rating-moderator-apply-newGameID
    public async ratingReportModeratorApplyButton(
        interaction: ButtonInteraction
    ) { await this.ratingService.ratingReportModeratorApplyButton(interaction); }

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
        @SlashChoice({name: "General", value: "General"})
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
        @SlashChoice({name: "General", value: "General"})
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

    @Slash({name: "all", description: "Reset rating of all users"})
    public async resetAll(
        interaction: CommandInteraction
    ) { await this.ratingService.resetAll(interaction); }
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

    @Slash({name: "all", description: "Delete all rating information of all users"})
    public async wipeAll(
        interaction: CommandInteraction
    ) { await this.ratingService.wipeAll(interaction); }
}
