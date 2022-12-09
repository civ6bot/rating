import { Discord } from "discordx";
import { LeaderboardService } from "./leaderboard.service";

@Discord()
export abstract class LeaderboardInteractions {
    private leaderboardService: LeaderboardService = new LeaderboardService();
}
