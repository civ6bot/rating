import { EntityManager } from "typeorm";
import { outerDataSource } from "../database.datasources";
import { EntityUserRating } from "../entities/entity.UserRating";
import { DatabaseServiceConfig } from "./service.Config";

export class DatabaseServiceUserRating {
    protected database: EntityManager = outerDataSource.manager;
    private databaseServiceConfig: DatabaseServiceConfig = new DatabaseServiceConfig();

    private async getDefaultRatingPoints(guildID: string): Promise<number> {
        return await this.databaseServiceConfig.getOneNumber(guildID, "RATING_DEFAULT_POINTS");
    }

    private async createOne(guildID: string, userID: string): Promise<EntityUserRating> {
        let userRating: EntityUserRating = new EntityUserRating();
        let defaultRating: number = await this.getDefaultRatingPoints(guildID);
        userRating.guildID = guildID;
        userRating.userID = userID;
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

    public async resetOne(userRating: EntityUserRating): Promise<EntityUserRating> {
        let newUserRating: EntityUserRating = new EntityUserRating();
        let defaultRating: number = await this.getDefaultRatingPoints(userRating.guildID);
        newUserRating.guildID = userRating.guildID;
        newUserRating.userID = userRating.userID;
        newUserRating.lastGame =  userRating.lastGame;
        newUserRating.ffaRating = defaultRating;
        newUserRating.teamersRating = defaultRating;
        return await this.database.save(EntityUserRating, newUserRating);
    }

    public async resetAll(guildID: string): Promise<number> {
        let usersRating: EntityUserRating[] = await this.getAll(guildID);
        let defaultRating: number = await this.getDefaultRatingPoints(guildID);
        usersRating.forEach(userRating => {
            userRating.ffaRating = defaultRating;
            userRating.teamersRating = defaultRating;
        });
        await this.database.save(usersRating);
        return usersRating.length;
    }

    public async deleteOne(userRating: EntityUserRating): Promise<void> {
        await this.database.remove(EntityUserRating, userRating);
    }

    public async deleteAll(guildID: string): Promise<void> {
        await this.database.delete(EntityUserRating, {
            guildID: guildID
        });
    }

    public async getBestRatingFFA(guildID: string, amount: number): Promise<EntityUserRating[]> {
        return (await this.database.find(EntityUserRating, {
            where: {guildID: guildID},
            order: {ffaRating: "DESC"},
        })).slice(amount);
    }

    public async getBestRatingTeamers(guildID: string, amount: number): Promise<EntityUserRating[]> {
        return (await this.database.find(EntityUserRating, {
            where: {guildID: guildID},
            order: {teamersRating: "DESC"},
        })).slice(amount);
    }
}
