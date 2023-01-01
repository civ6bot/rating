import { DataSource } from "typeorm"
import * as dotenv from "dotenv";
dotenv.config({path: 'rating.env'});

export const outerDataSource: DataSource = new DataSource({
    type: "mysql",
    host: process.env.DATABASE_HOSTNAME,
    port: Number(process.env.DATABASE_PORT),
    username: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    entities: [
        __dirname + "/entities/entity.Config.{js,ts}",
        __dirname + "/entities/entity.PendingRatingNote.{js,ts}",
        __dirname + "/entities/entity.RatingNote.{js,ts}",
        __dirname + "/entities/entity.UserRating.{js,ts}",
    ],
    charset: "utf8mb4_bin",
    logging: false,
    synchronize: true
});

export const localDataSource: DataSource = new DataSource({
    type: "sqlite",
    database: __dirname + "/../../localDatabase.sqlite",
    entities: [
        __dirname + "/entities/entity.Config.{js,ts}",
        __dirname + "/entities/entity.Text.{js,ts}"
    ],
    logging: false,
    synchronize: true
});
