import { DataSource } from "typeorm";
import * as dotenv from "dotenv";
dotenv.config({path: 'general.env'});

export const dataSource: DataSource = new DataSource({
    type: "postgres",
    host: process.env.DATABASE_HOSTNAME,
    port: Number(process.env.DATABASE_PORT),
    username: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    entities: [
        __dirname + "/entities/entity.*.{js,ts}",
    ],
    logging: false,
    synchronize: true
});
