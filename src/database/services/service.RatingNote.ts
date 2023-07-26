import { EntityManager, IsNull, LessThan, Like, Not } from "typeorm";
import { dataSource } from "../database.datasource";
import { EntityRatingNote } from "../entities/entity.RatingNote";
import { UtilsServiceTime } from "../../utils/services/utils.service.time";

export class DatabaseServiceRatingNote {
    protected database: EntityManager = dataSource.manager;

    public async getNextGameID(guildID: string): Promise<number> {
        return ((await this.database.findOne(EntityRatingNote, {
            where: {guildID: guildID},
            order: {gameID: "DESC"},
        }))?.gameID || 0) + 1;
    }

    public async insertOrUpdateAll(notes: EntityRatingNote[]): Promise<EntityRatingNote[]> {
        return await this.database.save(notes);
    }

    // isPending не учитываем, потому что нет таких игр,
    // где isActive = isPending = true.
    // Если isActive = true, то всегда isPending = false.
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

    // У всех игр (как и ожидающих, и подтверждённых) разный ID,
    // поэтому проверка isPending не нужна.
    public async getAllByGameID(guildID: string, gameID: number): Promise<EntityRatingNote[]> {
        return await this.database.find(EntityRatingNote, {
            where: {
                guildID: guildID,
                gameID: gameID
            },
            order: {
                isSubOut: "ASC",    // Сначала обычные игроки, потом заменённые;
                place: "ASC"        // в порядке мест.
            }
        });
    }

    // isPending не учитываем, потому что нет таких игр, см. выше.
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

    public async deleteAllByGameID(guildID: string, gameID: number): Promise<boolean> {
        return Number((await this.database.delete(EntityRatingNote, {
            guildID: guildID,
            gameID: gameID
        })).affected) > 0;
    }

    public async deleteOldPendingNotes(): Promise<void> {
        await this.database.delete(EntityRatingNote, {
            isPending: true,
            date: LessThan(new Date(Date.now()-UtilsServiceTime.getMs(1, "d")))
        });
    }
}
