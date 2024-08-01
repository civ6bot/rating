import { Router } from "express";
import { DatabaseServiceUserRating } from "../../database/services/service.UserRating";
import { EntityUserRating } from "../../database/entities/entity.UserRating";

export const routerSplit: Router = Router();
routerSplit.post('/', async (req, res) => {
    let guildID: string = req?.body?.guildID || "";
    let usersID: string[] = req?.body?.usersID || [];
    let databaseServiceUserRating: DatabaseServiceUserRating = new DatabaseServiceUserRating();
    let usersRaing: EntityUserRating[] = await databaseServiceUserRating.getMany(guildID, usersID);
    let ratings = usersRaing.map(userRating => userRating.teamersRating);
    return res.send(
        {
            guildID: guildID,
            usersID: usersID,
            ratings: ratings
        }
    );
});

/*
export type RequestResponseSplit = {
    guildID: string;
    usersID: string[];
    ratings: number[];
}
*/
