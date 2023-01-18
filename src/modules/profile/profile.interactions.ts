import { ApplicationCommandOptionType, ButtonInteraction, CommandInteraction, GuildMember } from "discord.js";
import { ButtonComponent, Discord, Slash, SlashChoice, SlashGroup, SlashOption } from "discordx";
import { ProfileService } from "./profile.service";

@Discord()
export abstract class ProfileInteractions {
    private profileService: ProfileService = new ProfileService();

    @Slash({name: "profile", description: "Show user stats"})
    public async profile(
        @SlashOption({
            name: "user",
            description: "player (you as default)",
            type: ApplicationCommandOptionType.User,
            required: false,
        }) user: GuildMember | null = null,
        interaction: CommandInteraction
    ) { this.profileService.profile(interaction, user); }

    @Slash({name: "history", description: "Show game history"})
    public async history(
        @SlashOption({
            name: "user",
            description: "player (you as default)",
            type: ApplicationCommandOptionType.User,
            required: false,
        }) user: GuildMember | null = null,
        interaction: CommandInteraction
    ) { this.profileService.history(interaction, user); }

    @ButtonComponent({id: /profile-showHistory-\d+-\d+/})   // profile-showHistory-authorID-playerID
    public async profileShowHistoryButton(
        interaction: ButtonInteraction
    ) { this.profileService.profileShowHistoryButton(interaction); }

    @ButtonComponent({id: /profile-delete-\d+/})   // profile-delete-authorID
    public async profileDeleteButton(
        interaction: ButtonInteraction
    ) { this.profileService.profileDeleteButton(interaction); }

    @ButtonComponent({id: /history-\d+-\d+-\d+/})  // history-playerID-authorID-pageID
    public async historyPageButton(
        interaction: ButtonInteraction
    ) { this.profileService.historyPageButton(interaction); }

    @ButtonComponent({id: /history-showProfile-\d+-\d+/})   // history-showProfile-authorID-playerID
    public async historyShowProfileButton(
        interaction: ButtonInteraction
    ) { this.profileService.historyShowProfileButton(interaction); }

    @ButtonComponent({id: /history-delete-\d+/})   // history-delete-authorID
    public async historyDeleteButton(
        interaction: ButtonInteraction
    ) { this.profileService.historyDeleteButton(interaction); }

    @Slash({name: "best-civs", description: "Show best civilizations of player"})
    public async bestCivs(
        @SlashChoice({name: "FFA", value: "FFA"})
        @SlashChoice({name: "Teamers", value: "Teamers"})
        @SlashChoice({name: "Total", value: "Total"})
        @SlashOption({
            name: "type",
            description: "type of games",
            type: ApplicationCommandOptionType.String,
            required: true
        }) gameType: string,
        @SlashOption({
            name: "user",
            description: "player (you as default)",
            type: ApplicationCommandOptionType.User,
            required: false,
        }) user: GuildMember | null = null,
        interaction: CommandInteraction
    ) { this.profileService.bestCivs(interaction, user, gameType); }
    
    @ButtonComponent({id: /bestcivs-\w+-\d+-\d+-\d+/})  // bestcivs-typeID-authorID-playerID-page
    public async bestCivsPageButton(
        interaction: ButtonInteraction
    ) { this.profileService.bestCivsPageButton(interaction); }

    @ButtonComponent({id: /bestcivs-delete-\d+/})   // bestcivs-delete-authorID
    public async bestCivsDeleteButton(
        interaction: ButtonInteraction
    ) { this.profileService.bestCivsDeleteButton(interaction); }
}
