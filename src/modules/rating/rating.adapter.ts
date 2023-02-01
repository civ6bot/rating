import { ModuleBaseService } from "../base/base.service";
import { LeaderboardService } from "../leaderboard/leaderboard.service";

export class RatingAdapter extends ModuleBaseService {
    private leaderboardService: LeaderboardService = new LeaderboardService();

    public async callLeaderboardStaticUpdate(guildID: string, type: string) {
        await this.leaderboardService.updateLeaderboardStaticContent(guildID, type);
    }
}
