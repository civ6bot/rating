import { EntityManager, IsNull, MoreThan, Not } from "typeorm";
import { dataSource } from "../database.datasource";
import { EntityUserRating } from "../entities/entity.UserRating";
import { DatabaseServiceConfig } from "./service.Config";

export class DatabaseServiceUserRating {
    protected database: EntityManager = dataSource.manager;
    private databaseServiceConfig: DatabaseServiceConfig = new DatabaseServiceConfig();

    private async getDefaultRatingPoints(guildID: string): Promise<number> {
        return await this.databaseServiceConfig.getOneNumber(guildID, "RATING_DEFAULT_POINTS");
    }

    private async createOne(guildID: string, userID: string): Promise<EntityUserRating> {
        let userRating: EntityUserRating = new EntityUserRating();
        let defaultRating: number = await this.getDefaultRatingPoints(guildID);
        userRating.guildID = guildID;
        userRating.userID = userID;
        userRating.rating = defaultRating;
        userRating.ffaRating = defaultRating;
        userRating.teamersRating = defaultRating;
        return await this.database.save(userRating);
    }

    public async getOne(guildID: string, userID: string): Promise<EntityUserRating> {
        let userRating: EntityUserRating|null = await this.database.findOneBy(EntityUserRating, {
            guildID: guildID,
            userID: userID
        });
        return !!userRating
            ? userRating
            : await this.createOne(guildID, userID);
    }

    public async getMany(guildID: string, usersID: string[]): Promise<EntityUserRating[]> {
        let entities: EntityUserRating[] = [];
        for(let i in usersID)
            entities.push(await this.getOne(guildID, usersID[i]));
        return entities;
    }

    public async getAll(guildID: string): Promise<EntityUserRating[]> {
        return await this.database.findBy(EntityUserRating, {
            guildID: guildID,
        });
    }

    public async update(userRating: EntityUserRating|EntityUserRating[]): Promise<EntityUserRating[]> {
        return Array.isArray(userRating)
            ? await this.database.save(EntityUserRating, userRating)
            : await this.database.save(EntityUserRating, [userRating]);
    }

    public async getUsersAmount(guildID: string): Promise<number> {
        return (await this.database.findAndCountBy(EntityUserRating, {
            guildID: guildID
        }))[1];
    }

    public async resetOne(guildID: string, userID: string): Promise<EntityUserRating> {        // не изменяем объект на входе
        let userRating: EntityUserRating = await this.getOne(guildID, userID);
        let defaultRating: number = await this.getDefaultRatingPoints(guildID);
        userRating.rating = defaultRating;
        userRating.ffaRating = defaultRating;
        userRating.teamersRating = defaultRating;
        this.database.save(userRating);
        return userRating;
    }

    public async resetAll(guildID: string): Promise<EntityUserRating[]> {
        let usersRating: EntityUserRating[] = await this.getAll(guildID);
        let defaultRating: number = await this.getDefaultRatingPoints(guildID);
        usersRating.forEach(userRating => {
            userRating.rating = defaultRating;
            userRating.ffaRating = defaultRating;
            userRating.teamersRating = defaultRating;
        });
        this.database.save(usersRating);
        return usersRating;
    }

    public async deleteOne(guildID: string, userID: string): Promise<EntityUserRating> {
        let deletedEntity: EntityUserRating = await this.getOne(guildID, userID);
        this.database.delete(EntityUserRating, {
            guildID: guildID,
            userID: userID
        });
        return deletedEntity;
    }

    public async deleteAll(guildID: string): Promise<EntityUserRating[]> {
        let deletedEntities: EntityUserRating[] = await this.getAll(guildID);
        this.database.delete(EntityUserRating, {
            guildID: guildID
        });
        return deletedEntities;
    }

    public async getBestRatingGeneral(guildID: string, amount: number): Promise<EntityUserRating[]> {
        return (await this.database.find(EntityUserRating, {
            where: {
                guildID: guildID,
                lastGame: Not(IsNull())
            },
            order: {rating: "DESC"},
        })).slice(0, amount);
    }

    public async getBestRatingFFA(guildID: string, amount: number): Promise<EntityUserRating[]> {
        return (await this.database.find(EntityUserRating, {
            where: {
                guildID: guildID,
                ffaTotal: MoreThan(0)
            },
            order: {ffaRating: "DESC"},
        })).slice(0, amount);
    }

    public async getBestRatingTeamers(guildID: string, amount: number): Promise<EntityUserRating[]> {
        return (await this.database.find(EntityUserRating, {
            where: {
                guildID: guildID,
                teamersTotal: MoreThan(0)
            },
            order: {teamersRating: "DESC"},
        })).slice(0, amount);
    }
}
