import { EntityManager } from "typeorm";
import { outerDataSource } from "../database.datasources";
import { EntityRatingNote } from "../entities/entity.RatingNote";

export class DatabaseServiceUserRating {
    protected database: EntityManager = outerDataSource.manager;

    public async getNextGameID(guildID: string): Promise<number> {
        return ((await this.database.findOne(EntityRatingNote, {
            where: {guildID: guildID},
            order: {gameID: "DESC"},
        }))?.gameID || 0) + 1;
    }

    public async insertAll(notes: EntityRatingNote[]): Promise<EntityRatingNote[]> {
        return await this.database.save(notes);
    }

    public async updateAll(notes: EntityRatingNote[]): Promise<EntityRatingNote[]> {
        return await this.database.save(notes);
    }

    public async getAllByUserID(guildID: string, userID: string): Promise<EntityRatingNote[]> {
        return await this.database.find(EntityRatingNote, {
            where: {
                guildID: guildID,
                userID: userID
            },
            order: {gameID: "DESC"}     // сначала последние игры
        });
    }

    public async getAllByGameID(guildID: string, gameID: number): Promise<EntityRatingNote[]> {
        return await this.database.find(EntityRatingNote, {
            where: {
                guildID: guildID,
                gameID: gameID
            },
            order: {gameID: "DESC"}     // сначала последние игры
        });
    }
}
