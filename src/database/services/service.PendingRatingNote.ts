import { EntityManager } from "typeorm";
import { outerDataSource } from "../database.datasources";
import { EntityPendingRatingNote } from "../entities/entity.PendingRatingNote";

export class DatabaseServicePendingRatingNote {
    protected database: EntityManager = outerDataSource.manager;

    public async getNextGameID(guildID: string): Promise<number> {
        return 1+Math.round(Math.random()*Math.pow(10, 8));        // Псевдорандомное число, чтобы избежать одинаковых ID из-за спама
    }

    public async insertAll(notes: EntityPendingRatingNote[]): Promise<EntityPendingRatingNote[]> {
        return await this.database.save(notes);
    }

    public async updateAll(notes: EntityPendingRatingNote[]): Promise<EntityPendingRatingNote[]> {
        return await this.database.save(notes);
    }

    public async deleteAllByGameID(gameID: number): Promise<boolean> {
        return Number((await this.database.delete(EntityPendingRatingNote, {
            gameID: gameID
        })).affected) > 0;
    }

    public async getAllByGameID(guildID: string, gameID: number): Promise<EntityPendingRatingNote[]> {
        return await this.database.find(EntityPendingRatingNote, {
            where: {
                guildID: guildID,
                gameID: gameID
            },
            order: {
                isSubOut: "ASC",    // сначала обычные игроки, потом заменённые
                place: "ASC"        // в порядке мест
            }
        });
    }
}
