import { ButtonInteraction, CommandInteraction } from "discord.js";
import { ButtonComponent, Discord, Slash, SlashGroup } from "discordx";
import { LeaderboardService } from "./leaderboard.service";

@Discord()
@SlashGroup({name: "leaderboard", description: "Show small leaderboard table"})
@SlashGroup("leaderboard")
export abstract class LeaderboardInteractions {
    private leaderboardService: LeaderboardService = new LeaderboardService();

    @Slash({name: "ffa", description: "Show FFA best players"})
    public async smallFFA(
        interaction: CommandInteraction
    ) { await this.leaderboardService.smallFFA(interaction); }

    @Slash({name: "teamers", description: "Show Teamers best players"})
    public async smallTeamers(
        interaction: CommandInteraction
    ) { await this.leaderboardService.smallTeamers(interaction); }

    @ButtonComponent({id: /leaderboard-\w+-\d+-\d+/})  // leaderboard-type-authorID-page
    public async leaderboardPageButton(
        interaction: ButtonInteraction
    ) { await this.leaderboardService.leaderboardPageButton(interaction); }

    @ButtonComponent({id: /leaderboard-delete-\d+/})  // leaderboard-delete-authorID
    public async leaderboardDeleteButton(
        interaction: ButtonInteraction
    ) { await this.leaderboardService.leaderboardDeleteButton(interaction); }
}

@Discord()
@SlashGroup({
    name: "static",
    description: "Create updating message with leaderboard",
    root: "leaderboard"
})
@SlashGroup("static", "leaderboard")
export abstract class LeaderboardStaticInteractions {
    private leaderboardService: LeaderboardService = new LeaderboardService();

    @Slash({name: "info", description: "Show static messages"})
    public async staticInfo(
        interaction: CommandInteraction
    ) { await this.leaderboardService.staticInfo(interaction); }

    @Slash({name: "ffa", description: "Generate updating message with FFA leaderboard"})
    public async staticFFA(
        interaction: CommandInteraction
    ) { await this.leaderboardService.staticFFA(interaction); }

    @Slash({name: "teamers", description: "Generate updating message with Teamers leaderboard"})
    public async staticTeamers(
        interaction: CommandInteraction
    ) { await this.leaderboardService.staticTeamers(interaction); }
}
