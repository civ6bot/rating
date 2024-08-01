import express, {Express} from 'express';
import { routerSplit } from "./routers/router.split";

export const httpServer: Express = express()
    .use(express.json())
    .use('/split', routerSplit);
