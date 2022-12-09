import {EntityConfig} from "../../database/entities/entity.Config";
import {glob} from "glob";
import path from "path";
import fs from "fs";
import {JSONConfigEntity} from "../../types/type.JSON.ConfigEntity";

export function loadDefaultConfigs(): EntityConfig[] {
    const files: string[] = glob.sync("./config/*");
    return files.map((filePath: string) => {
        let data: JSONConfigEntity[] = JSON.parse(fs.readFileSync(path.join(process.cwd(), filePath)).toString());
        return data.map((x: JSONConfigEntity): EntityConfig => {
            let entityConfig: EntityConfig = new EntityConfig();
            entityConfig.guildID = "DEFAULT";
            entityConfig.setting = x.setting;
            entityConfig.value = x.value.toString();
            return entityConfig;
        })
    }).reduce((a: EntityConfig[], b: EntityConfig[]): EntityConfig[] => a.concat(b), []);
}
