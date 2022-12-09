import {EntityText} from "../../database/entities/entity.Text";
import {glob} from "glob";
import path from "path";
import fs from "fs";
import {JSONTextEntity} from "../../types/type.JSON.TextEntity";
import {JSONText} from "../../types/type.JSON.Text";

export function loadTextEntities(): EntityText[] {
    const files: string[] = glob.sync("./text/*/*");
    return files.map((filePath: string) => {
        let data: JSONText = JSON.parse(fs.readFileSync(path.join(process.cwd(), filePath)).toString());
        return data.text.map((x: JSONTextEntity): EntityText => {
            let entityText: EntityText = new EntityText();
            entityText.tag = x.tag;
            entityText.lang = data.lang;
            entityText.value = x.value;
            return entityText;
        })
    }).reduce((a: EntityText[], b: EntityText[]): EntityText[] => a.concat(b), []);
}
