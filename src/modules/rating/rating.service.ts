import { ButtonInteraction, CommandInteraction, GuildMember } from "discord.js";
import { ModuleBaseService } from "../base/base.service";

export class RatingService extends ModuleBaseService {
    public async ratingFFA(interaction: CommandInteraction, msg: string) {
        
    }

    public async ratingTeamers(interaction: CommandInteraction, msg: string) {
        
    }

    public async ratingReportUserEditButton(interaction: ButtonInteraction) {
        
    }

    public async ratingReportUserDeleteButton(interaction: ButtonInteraction) {
        
    }

    public async ratingReportUserConfirmButton(interaction: ButtonInteraction) {
        
    }

    public async ratingReportModeratorCancelButton(interaction: ButtonInteraction) {
        
    }

    public async ratingReportModeratorApplyButton(interaction: ButtonInteraction) {
        
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
