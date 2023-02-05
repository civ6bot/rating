import { EntityManager, IsNull, Like, Not } from "typeorm";
import { outerDataSource } from "../database.datasources";
import { EntityRatingNote } from "../entities/entity.RatingNote";

export class DatabaseServiceRatingNote {
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
                userID: userID,
                isActive: true
            },
            order: {date: "DESC"}     // сначала последние игры, в конце самые ранние
        });
    }

    public async getAllByGameID(guildID: string, gameID: number): Promise<EntityRatingNote[]> {
        return await this.database.find(EntityRatingNote, {
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

    public async getBestCivs(gameType: string, guildID: string|null = null, userID: string|null = null): Promise<EntityRatingNote[]> {
        return await this.database.find(EntityRatingNote, {
            where: {
                guildID: (guildID === null) ? Like("%") : guildID,
                userID: (userID === null) ? Like("%") : userID,
                isActive: true,
                civilizationID: Not(IsNull()),
                gameType: (gameType === "Total") ? Like("%") : gameType
            },
            order: {
                civilizationID: "ASC",
                typedRating: "DESC"
            }
        });
    }
}
