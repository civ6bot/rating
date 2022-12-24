import { ButtonInteraction, CommandInteraction, GuildMember } from "discord.js";
import { DatabaseServiceRatingNote } from "../../database/services/service.RatingNote";
import { DatabaseServiceUserRating } from "../../database/services/service.UserRating";
import { ModuleBaseService } from "../base/base.service";
import { RatingUI } from "./rating.ui";

export class RatingService extends ModuleBaseService {

    private ratingUI: RatingUI = new RatingUI();

    private databaseServiceUserRating: DatabaseServiceUserRating = new DatabaseServiceUserRating();
    private databaseServiceRatingNote: DatabaseServiceRatingNote = new DatabaseServiceRatingNote();

    public async reportFFA(interaction: CommandInteraction, msg: string) {
        
    }

    public async reportTeamers(interaction: CommandInteraction, msg: string) {
        
    }

    public async reportUserEditButton(interaction: ButtonInteraction) {
        
    }

    public async reportUserDeleteButton(interaction: ButtonInteraction) {
        
    }

    public async reportUserConfirmButton(interaction: ButtonInteraction) {
        
    }

    public async reportModeratorCancelButton(interaction: ButtonInteraction) {
        
    }

    public async reportModeratorApplyButton(interaction: ButtonInteraction) {
        
    }



    public async cancel(interaction: CommandInteraction, gameID: number) {

    }

    public async revert(interaction: CommandInteraction, gameID: number) {

    }



    public async setUser(interaction: CommandInteraction, member: GuildMember, type: string, amount: number) {

    }

    public async addUser(interaction: CommandInteraction, member: GuildMember, type: string, amount: number) {

    }

    public async resetUser(interaction: CommandInteraction, member: GuildMember) {

    }

    public async resetAll(interaction: CommandInteraction) {

    }

    public async wipeUser(interaction: CommandInteraction, member: GuildMember) {

    }

    public async wipeAll(interaction: CommandInteraction) {

    }
}
