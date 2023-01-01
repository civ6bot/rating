import { EntityManager } from "typeorm";
import { outerDataSource } from "../database.datasources";
import { EntityPendingRatingNote } from "../entities/entity.PendingRatingNote";

export class DatabaseServicePendingRatingNote {
    protected database: EntityManager = outerDataSource.manager;

    public async getNextGameID(guildID: string): Promise<number> {
        return ((await this.database.findOne(EntityPendingRatingNote, {
            where: {guildID: guildID},
            order: {gameID: "DESC"},
        }))?.gameID || 0) + 1;
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
