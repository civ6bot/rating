import { ApplicationCommandOptionType, ButtonInteraction, CommandInteraction, GuildMember } from "discord.js";
import { ButtonComponent, Discord, Slash, SlashGroup, SlashOption } from "discordx";
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
    ) { await this.profileService.profile(interaction, user); }

    @Slash({name: "history", description: "Show game history"})
    public async history(
        @SlashOption({
            name: "user",
            description: "player (you as default)",
            type: ApplicationCommandOptionType.User,
            required: false,
        }) user: GuildMember | null = null,
        interaction: CommandInteraction
    ) { await this.profileService.history(interaction, user); }

    @ButtonComponent({id: /profile-showHistory-\d+-\d+/})   // profile-showHistory-authorID-playerID
    public async profileShowHistoryButton(
        interaction: ButtonInteraction
    ) { await this.profileService.profileShowHistoryButton(interaction); }

    @ButtonComponent({id: /profile-delete-\d+/})   // profile-delete-authorID
    public async profileDeleteButton(
        interaction: ButtonInteraction
    ) { await this.profileService.profileDeleteButton(interaction); }

    @ButtonComponent({id: /history-\d+-\d+-\d+/})  // history-playerID-authorID-pageID
    public async historyPageButton(
        interaction: ButtonInteraction
    ) { await this.profileService.historyPageButton(interaction); }

    @ButtonComponent({id: /history-showProfile-\d+-\d+/})   // history-showProfile-authorID-playerID
    public async historyShowProfileButton(
        interaction: ButtonInteraction
    ) { await this.profileService.historyShowProfileButton(interaction); }

    @ButtonComponent({id: /history-delete-\d+/})   // history-delete-authorID
    public async historyDeleteButton(
        interaction: ButtonInteraction
    ) { await this.profileService.historyDeleteButton(interaction); }
}

@Discord()
@SlashGroup({name: "best-civs", description: "Show best civilizations of player"})
@SlashGroup("best-civs")
export abstract class ProfileBestCivsInteractions {
    private profileService: ProfileService = new ProfileService();

    @Slash({name: "total", description: "Show best civilizations of player"})
    public async bestTotal(
        @SlashOption({
            name: "user",
            description: "player (you as default)",
            type: ApplicationCommandOptionType.User,
            required: false,
        }) user: GuildMember | null = null,
        interaction: CommandInteraction
    ) { await this.profileService.bestCivs(interaction, user, "Total"); }

    @Slash({name: "ffa", description: "Show best FFA civilizations of player"})
    public async bestFFA(
        @SlashOption({
            name: "user",
            description: "player (you as default)",
            type: ApplicationCommandOptionType.User,
            required: false,
        }) user: GuildMember | null = null,
        interaction: CommandInteraction
    ) { await this.profileService.bestCivs(interaction, user, "FFA"); }

    @Slash({name: "teamers", description: "Show best Teamers civilizations of player"})
    public async bestTeamers(
        @SlashOption({
            name: "user",
            description: "player (you as default)",
            type: ApplicationCommandOptionType.User,
            required: false,
        }) user: GuildMember | null = null,
        interaction: CommandInteraction
    ) { await this.profileService.bestCivs(interaction, user, "Teamers"); }

    @ButtonComponent({id: /bestcivs-\w+-\d+-\d+-\d+/})  // bestcivs-typeID-authorID-playerID-page
    public async bestCivsPageButton(
        interaction: ButtonInteraction
    ) { await this.profileService.bestCivsPageButton(interaction); }

    @ButtonComponent({id: /bestcivs-delete-\d+/})   // bestcivs-delete-authorID
    public async bestCivsDeleteButton(
        interaction: ButtonInteraction
    ) { await this.profileService.bestCivsDeleteButton(interaction); }
}
