import {EntityConfig} from "../entities/entity.Config";
import {EntityManager} from "typeorm";
import {loadDefaultConfigs} from "../../utils/loaders/utils.loader.config";
import {dataSource} from "../database.datasource";

export class DatabaseServiceConfig {
    protected database: EntityManager = dataSource.manager;

    public async getOneString(guildID: string, setting: string): Promise<string> {
        // Ищем значение в локальной базе данных
        let entityConfig: EntityConfig | null = await this.database.findOneBy(EntityConfig, {
            guildID: guildID,
            setting: setting,
        });
        if(entityConfig !== null)
            return entityConfig.value;

        // Если в локальной нет значения,
        // то добавляем недостающие данные из DEFAULT для нужной GuildID,
        // а затем добавляем значения.
        let localDefaultConfigSettings: string[] = loadDefaultConfigs().map(defaultEntityConfig => defaultEntityConfig.setting);    // массив всех строк с настройками
        let defaultEntitiesConfig: EntityConfig[] = (await this.database.findBy(EntityConfig, {
            guildID: "DEFAULT"
        }) as EntityConfig[]).filter(defaultEntityConfig => localDefaultConfigSettings.indexOf(defaultEntityConfig.setting) !== -1);     // убираем лишнее
        defaultEntitiesConfig.forEach(x => x.guildID = guildID);    // заменяем DEFAULT на guildID
        let normalizedEntitiesConfig: EntityConfig[] = defaultEntitiesConfig.map((x: EntityConfig): EntityConfig => {
            let normalizedEntity: EntityConfig = new EntityConfig();
            normalizedEntity.guildID = x.guildID;
            normalizedEntity.setting = x.setting;
            normalizedEntity.value = x.value;
            return normalizedEntity;
        });
        await this.database.connection.createQueryBuilder()
            .insert()       // Если save(), то это INSERT OR UPDATE;
            .orIgnore()     // злесь существующие конфиги не сбрасываются.
            .into(EntityConfig)
            .values(normalizedEntitiesConfig)
            .execute();

        // Возвращаем результат.
        entityConfig = await this.database.findOneBy(EntityConfig, {
            guildID: guildID,
            setting: setting,
        });
        return entityConfig?.value as string;
    }

    public async getManyString(guildID: string, settings: string[]): Promise<string[]> {
        let values: string[] = [];
        for(let i in settings)
            values.push(await this.getOneString(guildID, settings[i]));
        return values;
    }

    public async getOneNumber(guildID: string, setting: string): Promise<number> {
        return Number(await this.getOneString(guildID, setting)) || 0;
    }

    public async getManyNumber(guildID: string, settings: string[]): Promise<number[]> {
        let values: number[] = [];
        for(let i in settings)
            values.push(await this.getOneNumber(guildID, settings[i]));
        return values;
    }

    public async insertAll(entitiesConfig: EntityConfig[]): Promise<boolean> {
        let normalizedEntitiesConfig: EntityConfig[] = entitiesConfig.map((x: EntityConfig): EntityConfig => {
            let normalizedEntity: EntityConfig = new EntityConfig();
            normalizedEntity.guildID = x.guildID;
            normalizedEntity.setting = x.setting;
            normalizedEntity.value = x.value;
            return normalizedEntity;
        });
        return !!(await this.database.save(normalizedEntitiesConfig, { chunk: 750 }))
    }
}
