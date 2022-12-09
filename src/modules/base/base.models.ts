import {ButtonInteraction, CommandInteraction, ThreadChannel} from "discord.js";

export class ModuleBaseModel {
    public guildID: string;
    public isProcessing: boolean = false;
    public interaction: CommandInteraction | ButtonInteraction;
    public errorReturnTag: string = "";
    public date: Date = new Date();
    public setTimeoutID: NodeJS.Timeout | number | null = null;
    public thread: ThreadChannel | null = null;

    constructor(interaction: CommandInteraction | ButtonInteraction) {
        this.guildID = interaction.guild?.id as string;
        this.interaction = interaction;
    }
}
