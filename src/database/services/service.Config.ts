import {EntityConfig} from "../entities/entity.Config";
import {EntityManager} from "typeorm";
import {localDataSource, outerDataSource} from "../database.datasources";
import {loadDefaultConfigs} from "../../utils/loaders/utils.loader.config";

export class DatabaseServiceConfig {
    protected innerDatabase: EntityManager = localDataSource.manager;
    protected outerDatabase: EntityManager = outerDataSource.manager;

    public async getOneString(guildID: string, setting: string): Promise<string> {
        // Ищем значение в локальной базе данных
        let entityConfig: EntityConfig | null = await this.innerDatabase.findOneBy(EntityConfig, {
            guildID: guildID,
            setting: setting,
        });
        if(entityConfig !== null)
            return entityConfig.value;

        // Если в локальной нет значения,
        // то импортируем внешнюю в локальную
        // и затем ищем в локальной
        let localDefaultConfigSettings: string[] = loadDefaultConfigs().map(defaultEntityConfig => defaultEntityConfig.setting);    // массив всех строк с настройками
        
        let entitiesConfig: EntityConfig[] = (await this.outerDatabase.findBy(EntityConfig, {   // получаем из внешней
            guildID: guildID
        })) || [];
        entitiesConfig.filter(entityConfig => localDefaultConfigSettings.indexOf(entityConfig.setting) !== -1)  // убираем лишнее для данного бота
        await this.innerDatabase.save(entitiesConfig);  // сохраняем во внутреннюю
        // Ищем значение в локальной базе данных
        entityConfig = await this.innerDatabase.findOneBy(EntityConfig, {
            guildID: guildID,
            setting: setting,
        });
        if(entityConfig !== null)
            return entityConfig.value;

        // Если во внешней нет значения,
        // то добавляем недостающие данные из DEFAULT для нужной GuildID,
        // получаем из внешней,
        // затем возвращаем значение
        let defaultEntitiesConfig: EntityConfig[] = await this.outerDatabase.findBy(EntityConfig, {
            guildID: "DEFAULT"
        }) as EntityConfig[];   // DEFAULT config
        defaultEntitiesConfig
            .filter(defaultEntityConfig => localDefaultConfigSettings.indexOf(defaultEntityConfig.setting) !== -1)  // убираем лишнее
            .forEach(x => x.guildID = guildID);     // заменяем DEFAULT на guildID
        await this.insertOrIgnoreOuter(defaultEntitiesConfig);  // добавляем недостающие во внешнюю

        entitiesConfig = (await this.outerDatabase.findBy(EntityConfig, {   // получаем из внешней
            guildID: guildID
        })) || [];
        entitiesConfig.filter(entityConfig => localDefaultConfigSettings.indexOf(entityConfig.setting) !== -1)  // убираем лишнее для данного бота
        await this.innerDatabase.save(entitiesConfig);  // сохраняем во внутреннюю
        // Ищем значение в локальной базе данных
        entityConfig = await this.innerDatabase.findOneBy(EntityConfig, {
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

    // Можно использовать для сброса,
    // database.save() позволяет перезаписать
    public async insertAll(entitiesConfig: EntityConfig[]): Promise<boolean> {
        let normalizedEntitiesConfig: EntityConfig[] = entitiesConfig.map((x: EntityConfig): EntityConfig => {
            let normalizedEntity: EntityConfig = new EntityConfig();
            normalizedEntity.guildID = x.guildID;
            normalizedEntity.setting = x.setting;
            normalizedEntity.value = x.value;
            return normalizedEntity;
        });
        return !!(await this.innerDatabase.save(normalizedEntitiesConfig, { chunk: 750 }))
            && !!(await this.outerDatabase.save(normalizedEntitiesConfig, { chunk: 750 }));
    }

    // Для корректного обновления конфигов
    // иначе существующие сбрасываются
    public async insertOrIgnoreOuter(entitiesConfig: EntityConfig[]): Promise<void> {
        let normalizedEntitiesConfig: EntityConfig[] = entitiesConfig.map((x: EntityConfig): EntityConfig => {
            let normalizedEntity: EntityConfig = new EntityConfig();
            normalizedEntity.guildID = x.guildID;
            normalizedEntity.setting = x.setting;
            normalizedEntity.value = x.value;
            return normalizedEntity;
        });
        await this.outerDatabase.connection.createQueryBuilder()
            .insert()
            .orIgnore()
            .into(EntityConfig)
            .values(normalizedEntitiesConfig)
            .execute();
    }

    // используется каждый раз при включении/перезапуске
    // для очистки локальной базы данных
    public async clearAll(): Promise<void> {
        await this.innerDatabase.clear(EntityConfig);
    }
}
