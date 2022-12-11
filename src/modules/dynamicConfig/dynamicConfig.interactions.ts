import {Discord, Slash, SelectMenuComponent, ModalComponent, ButtonComponent} from "discordx";
import {ButtonInteraction, CommandInteraction, ModalSubmitInteraction, StringSelectMenuInteraction} from "discord.js";
import {DynamicConfigService} from "./dynamicConfig.service";

@Discord()
export abstract class DynamicConfigInteractions {
    private dynamicConfigService: DynamicConfigService = new DynamicConfigService();

    @Slash({ name: "config", description: "Edit server settings" })
    public async config(
        interaction: CommandInteraction
    ) { await this.dynamicConfigService.config(interaction); }

    @SelectMenuComponent({id: "dynamicConfig-menu"})
    public async menu(
        interaction: StringSelectMenuInteraction
    ) { await this.dynamicConfigService.menu(interaction); }

    @ModalComponent({id: "dynamicConfig-modal"})
    public async modalSetting(
        interaction: ModalSubmitInteraction
    ) { await this.dynamicConfigService.modalSetting(interaction); }

    @ButtonComponent({id: "dynamicConfig-button-reset"})
    public async resetButton(
        interaction: ButtonInteraction
    ) { await this.dynamicConfigService.resetButton(interaction); }

    @ButtonComponent({id: "dynamicConfig-button-delete"})
    public async deleteButton(
        interaction: ButtonInteraction
    ) { await this.dynamicConfigService.deleteButton(interaction); }

    @ButtonComponent({id: "dynamicConfig-button-first"})
    public async firstPageButton(
        interaction: ButtonInteraction
    ) { await this.dynamicConfigService.firstPageButton(interaction); }

    @ButtonComponent({id: "dynamicConfig-button-previous"})
    public async previousPageButton(
        interaction: ButtonInteraction
    ) { await this.dynamicConfigService.previousPageButton(interaction); }

    @ButtonComponent({id: "dynamicConfig-button-next"})
    public async nextPageButton(
        interaction: ButtonInteraction
    ) { await this.dynamicConfigService.nextPageButton(interaction); }

    @ButtonComponent({id: "dynamicConfig-button-last"})
    public async lastPageButton(
        interaction: ButtonInteraction
    ) { await this.dynamicConfigService.lastPageButton(interaction); }

    @ButtonComponent({id: "dynamicConfig-button-back"})
    public async backButton(
        interaction: ButtonInteraction
    ) { await this.dynamicConfigService.backButton(interaction); }

    @ButtonComponent({id: "dynamicConfig-button-reset-confirm"})
    public async resetConfirmButton(
        interaction: ButtonInteraction
    ) { await this.dynamicConfigService.resetConfirmButton(interaction); }

    @ButtonComponent({id: "dynamicConfig-button-reset-deny"})
    public async resetDenyButton(
        interaction: ButtonInteraction
    ) { await this.dynamicConfigService.resetDenyButton(interaction); }
}
