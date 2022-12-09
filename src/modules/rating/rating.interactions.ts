import {Discord, Slash, SelectMenuComponent, ModalComponent, ButtonComponent} from "discordx";
import { RatingService } from "./rating.service";

@Discord()
export abstract class RatingInteractions {
    private ratingService: RatingService = new RatingService();
}
