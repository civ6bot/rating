import { ButtonInteraction, CommandInteraction, ModalSubmitInteraction, StringSelectMenuInteraction } from "discord.js";
import { ButtonComponent, Discord, ModalComponent, SelectMenuComponent, Slash } from "discordx";
import { DynamicConfigService } from "./dynamicConfig.service";

@Discord()
export abstract class DynamicConfigInteractions {
    private dynamicConfigService: DynamicConfigService = new DynamicConfigService();

    @Slash({ name: "config", description: "Edit server settings" })
    public async config(
        interaction: CommandInteraction
    ) { await this.dynamicConfigService.config(interaction); }

    @SelectMenuComponent({id: /dynamicConfig-menu-\d+/})        // dynamicConfig-menu-userID    Есть дополнительные объекты
    public async menu(
        interaction: StringSelectMenuInteraction
    ) { await this.dynamicConfigService.menu(interaction); }

    @ModalComponent({id: /dynamicConfig-modal/})                // dynamicConfig-modal  Есть дополнительные объекты
    public async modalSetting(
        interaction: ModalSubmitInteraction
    ) { await this.dynamicConfigService.modalSetting(interaction); }



    @ButtonComponent({id: /dynamicConfig-button-back-\d+[\w-]+/})          // dynamicConfig-button-back-userID-CONFIG_TAG
    public async backButton(
        interaction: ButtonInteraction
    ) { await this.dynamicConfigService.backButton(interaction); } 

    @ButtonComponent({id: /dynamicConfig-button-page-\d+-\d+-[\w-]+/})          // dynamicConfig-button-page-userID-pageID-CONFIG_TAG
    public async pageButton(
        interaction: ButtonInteraction
    ) { await this.dynamicConfigService.pageButton(interaction); }

    @ButtonComponent({id: /dynamicConfig-button-reset-\d+-\d+-[\w-]+/})    // dynamicConfig-button-reset-userID-pageID-CONFIG_TAG
    public async resetButton(
        interaction: ButtonInteraction
    ) { await this.dynamicConfigService.resetButton(interaction); }

    @ButtonComponent({id: /dynamicConfig-button-delete-\d+/})           // dynamicConfig-button-delete-userID
    public async deleteButton(
        interaction: ButtonInteraction
    ) { await this.dynamicConfigService.deleteButton(interaction); }



    @ButtonComponent({id: /dynamicConfig-button-reset-confirm-\d+-[\w-]+/})    // dynamicConfig-button-reset-confirm-userID-CONFIG_TAG
    public async resetConfirmButton(
        interaction: ButtonInteraction
    ) { await this.dynamicConfigService.resetConfirmButton(interaction); }

    @ButtonComponent({id: /dynamicConfig-button-reset-deny-\d+-\d+-[\w-]+/})   // dynamicConfig-button-reset-deny-userID-pageID-CONFIG_TAG
    public async resetDenyButton(
        interaction: ButtonInteraction
    ) { await this.dynamicConfigService.resetDenyButton(interaction); }
}
