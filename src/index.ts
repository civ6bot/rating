import {importx} from "@discordx/importer";
import {discordClient} from "./client/client";
import {DatabaseServiceText} from "./database/services/service.Text";
import {loadTextEntities} from "./utils/loaders/utils.loader.text";
import {DatabaseServiceConfig} from "./database/services/service.Config";
import {loadDefaultConfigs} from "./utils/loaders/utils.loader.config";
import {dataSource} from "./database/database.datasource";
import {DatabaseServiceRatingNote} from "./database/services/service.RatingNote";
import * as dotenv from "dotenv";
import { httpServer } from "./server/server.app";
dotenv.config({path: 'rating.env'});

importx(
    __dirname + "/modules/*/*.interactions.{js,ts}",
).then(async () => {
    await discordClient.login(((process.env.TEST_MODE === '1') 
        ? process.env.TEST_BOT_TOKEN 
        : process.env.BOT_TOKEN
    ) as string);
    console.log((process.env.TEST_MODE === '1') 
        ? "Civ6Bot Test started" 
        : "Civ6Bot Rating started"
    );
});

dataSource.initialize().then(async () => {
    let databaseServiceText: DatabaseServiceText = new DatabaseServiceText();
    let databaseServiceConfig: DatabaseServiceConfig = new DatabaseServiceConfig();
    let databaseServiceRatingNote: DatabaseServiceRatingNote = new DatabaseServiceRatingNote();

    await databaseServiceText.insertAll(loadTextEntities());
    await databaseServiceConfig.insertAll(loadDefaultConfigs());
    await databaseServiceRatingNote.deleteOldPendingNotes();

    console.log(`Database connected`);
});

httpServer.listen(process.env.SERVER_HTTP_PORT, () => {
    console.log(`HTTP Rating server listening`);
});

process.on('uncaughtException', error => {
    console.error(error);
});
