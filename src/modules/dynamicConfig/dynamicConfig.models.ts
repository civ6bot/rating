import {ModuleBaseModel} from "../base/base.models";
import {CommandInteraction} from "discord.js";
import {
    JSONDynamicConfigEntityBoolean,
    JSONDynamicConfigEntityBooleanLanguage,
    JSONDynamicConfigEntityChannelMany,
    JSONDynamicConfigEntityNumber,
    JSONDynamicConfigEntityNumberMany,
    JSONDynamicConfigEntityNumberTimeSeconds,
    JSONDynamicConfigEntityRoleMany,
    JSONDynamicConfigEntityString,
    JSONDynamicConfigEntityTeamersForbiddenPairs
} from "../../types/type.JSON.DynamicConfigEntities";
import {UtilsServiceCivilizations} from "../../utils/services/utils.service.civilizations";

export class DynamicConfig extends ModuleBaseModel {
    private _pageCurrent: number = 1;
    private readonly entitiesPerPage: number;
    private readonly _pageTotal: number;

    public readonly lifeTimeMs: number;

    public titleOptionTag: string;
    public optionTags: string[];

    public pickedIndex: number = -1;
    private _child: DynamicConfig | null = null;
    private _configs: DynamicConfigEntity[] = [];

    constructor(
        interaction: CommandInteraction, entitiesPerPage: number, lifeTimeMs: number,
        titleOptionTag: string, optionTags: string[],
        configs: DynamicConfigEntity[] = []
    ) {
        super(interaction);
        this.titleOptionTag = titleOptionTag;

        // При создании объекта
        // все теги из объектов Config
        // переписываются в optionTags

        this.optionTags = optionTags;
        this._configs = configs;
        if(this._configs.length > 0)
            this.optionTags = this._configs.map((config: DynamicConfigEntity): string => config.properties.textTag);

        this.entitiesPerPage = entitiesPerPage;
        this._pageTotal = Math.ceil(this.optionTags.length/this.entitiesPerPage);
        this.lifeTimeMs = lifeTimeMs;
    }

    public hasAnyChild(): boolean { return !!(this._child); }

    // Эти методы нужны, потому что
    // вложенность структуры DynamicConfigs
    // не ограничена лишь 1 объектом (поле child)
    public get isConfig(): boolean {
        return (this._child) ? this._child.isConfig : (this._configs.length > 0);
    }

    public getTitleTag(): string {
        return (this._child) ? this._child.getTitleTag() : this.titleOptionTag;
    }

    public getEmojiTags(): string[] {
        return (this._child)
            ? this._child.getEmojiTags()
            : this.optionTags
                .slice((this.pageCurrent-1)*this.entitiesPerPage, this.pageCurrent*this.entitiesPerPage)
                .map((tag: string): string => tag + "_EMOJI");
    }

    public getOptionTags(): string[] {
        return (this._child)
            ? this._child.getOptionTags()
            : this.optionTags.slice((this.pageCurrent-1)*this.entitiesPerPage, this.pageCurrent*this.entitiesPerPage);
    }

    public getLastChild(): DynamicConfig {
        return (this._child) ? this._child.getLastChild() : this;
    }

    public createChild(index: number, optionTags: string[], configs: DynamicConfigEntity[] = []): void {
        (this._child)
            ? this._child.createChild(index, optionTags, configs)
            : this._child = (!this.isConfig)
                ? new DynamicConfig(
                    this.interaction as CommandInteraction,
                    this.entitiesPerPage,
                    this.lifeTimeMs,
                    this.optionTags[index+this.entitiesPerPage*(this._pageCurrent-1)],
                    optionTags,
                    configs
                ) : null;
    }

    public deleteLastChild(): void {
        if(this._child === null)
            return;
        if(this._child === this.getLastChild()) {
            this._child = null;
            return;
        }
        return this._child.deleteLastChild();
    }

    public getStringifiedValues(): string[] {
        return (this._child)
            ? this._child.getStringifiedValues()
            : this._configs
                .slice((this.pageCurrent-1)*this.entitiesPerPage, this.pageCurrent*this.entitiesPerPage)
                .map((entity: DynamicConfigEntity): string => entity.stringifiedValue);
    }

    // Получить конфиги с текущей страницы
    public get configs(): DynamicConfigEntity[] {
        return (this._child)
            ? this._child.configs
            : this._configs.slice((this.pageCurrent-1)*this.entitiesPerPage, this.pageCurrent*this.entitiesPerPage);

    }

    public getAllConfigs(): DynamicConfigEntity[] {
        return (this._child)
            ? this._child.getAllConfigs()
            : this._configs;
    }

    public updateConfigs(entities: DynamicConfigEntity[]): void {
        if(this._child)
            return this._child.updateConfigs(entities);
        if(!this.isConfig || (entities.length !== this._configs.length))
            return;
        if(entities.every((value, index): boolean => (entities[index].properties.configTag === this._configs[index].properties.configTag)))
            this._configs = entities;
    }

    public get pageCurrent(): number {
        return (this._child) ? this._child.pageCurrent : this._pageCurrent;
    }

    private set pageCurrent(page: number) {
        (this._child) ? this._child.pageCurrent = page : this._pageCurrent = Math.min(this._pageTotal, Math.max(page, 1));
    }

    public get pageTotal(): number {
        return (this._child) ? this._child.pageTotal : this._pageTotal;
    }

    public toFirstPage(): void { (this._child) ? this._child.toFirstPage() : this.pageCurrent = 1; }
    public toPreviousPage(): void { (this._child) ? this._child.toPreviousPage() : this.pageCurrent -= 1; }
    public toNextPage(): void { (this._child) ? this._child.toNextPage() : this.pageCurrent += 1; }
    public toLastPage(): void { (this._child) ? this._child.toLastPage() : this.pageCurrent = this.pageTotal; }
}

export abstract class DynamicConfigEntity {
    public readonly abstract type: string;

    public abstract check(value: string): boolean;
    public abstract get stringifiedValue(): string;
    public abstract properties: JSONDynamicConfigEntityNumber | JSONDynamicConfigEntityString | JSONDynamicConfigEntityBoolean;
}

export class DynamicConfigEntityNumber extends DynamicConfigEntity {
    public readonly type: string = "Number";
    public value: number;
    public readonly properties: JSONDynamicConfigEntityNumber;

    constructor(properties: JSONDynamicConfigEntityNumber, value: number) {
        super();
        this.value = value;
        this.properties = properties;
    }

    public get stringifiedValue(): string { return String(this.value); }

    public check(value: string): boolean {
        let numberValue: number = Math.floor(Number(value));
        if((numberValue >= this.properties.minValue) && (numberValue <= this.properties.maxValue)) {
            this.value = numberValue;
            return true;
        }
        return false;
    }
}

export class DynamicConfigEntityString extends DynamicConfigEntity {
    public readonly type: string = "String";
    public value: string;
    public readonly properties: JSONDynamicConfigEntityString;

    constructor(properties: JSONDynamicConfigEntityString, value: string) {
        super();
        this.value = value;
        this.properties = properties;
    }

    public get stringifiedValue(): string { return this.value; }

    public check(value: string): boolean {
        if (value !== "") {
            this.value = value;
            return true;
        }
        return false;
    }
}

export class DynamicConfigEntityBoolean extends DynamicConfigEntity {
    public readonly type: string = "Boolean";
    public value: boolean;
    public readonly properties: JSONDynamicConfigEntityBoolean;

    constructor(properties: JSONDynamicConfigEntityBoolean, value: boolean) {
        super();
        this.value = value;
        this.properties = properties;
    }

    public get stringifiedValue(): string { return this.value ? "✅" : "🚫"; }

    public check(value: string): boolean {
        this.value = (value === "true");
        return true;
    }
}

export class DynamicConfigEntityTeamersForbiddenPairs extends DynamicConfigEntity {
    public readonly type: string = "TeamersForbiddenPairs";
    public value: string;
    public readonly properties: JSONDynamicConfigEntityTeamersForbiddenPairs;

    public civilizationPairIndexes: number[][];
    public civilizationTexts: string[];
    public civilizationErrorIndexes: number[] = [];

    constructor(
        properties: JSONDynamicConfigEntityTeamersForbiddenPairs,
        value: string,
        civilizationTexts: string[]
    ) {
        super();
        this.value = value;
        this.properties = properties;

        this.civilizationPairIndexes = UtilsServiceCivilizations.getForbiddenPairs(value);
        this.civilizationTexts = civilizationTexts;
    }

    // не используется
    public get stringifiedValue(): string { return ""; }

    // На вход - человеческий текст
    // если всё ок - меняется строка для config и массив пар и возвращается true
    // Если нет - возвращается false
    public check(value: string): boolean {
        this.civilizationErrorIndexes = [];
        let civParseResult: number[][][] = value
            .replaceAll("-", " ")
            .split("\n")
            .map((civilizationsTextPairString: string): string[] => civilizationsTextPairString.split(","))
            .map((civTextPair: string[]): string[] =>
                civTextPair.map((civText: string, index: number): string =>
                    civTextPair[index] = civText.trim()
                )
            )
            .map((civilizationsTextPairString: string[]): number[][] =>
                civilizationsTextPairString.map((civText: string): number[] => {
                    let {bans, errors} = UtilsServiceCivilizations.parseBans(civText, this.civilizationTexts);
                    return bans;
                })
            )
            .filter((civDoubleNumber: number[][]): boolean =>
                civDoubleNumber.filter((civOneNumber: number[]): boolean =>
                    civOneNumber.length !== 0
                ).length !== 0
            );
        if(civParseResult.map((civDoubleArrayResult: number[][]): boolean =>
                (civDoubleArrayResult.length === 2) && civDoubleArrayResult.every((civOneArrayResult: number[]): boolean =>
                    civOneArrayResult.length === 1
                )
        ).some(result => !result) && civParseResult.length !== 0)
            return false;

        let civilizationNumberPairs: number[][] = civParseResult
            .map((civDoubleArrayResult: number[][]): number[] =>
                civDoubleArrayResult.map((civOneArrayResult: number[]): number =>
                    civOneArrayResult[0]
                ).sort()
            ).sort()
            .filter((value: number[], index: number, array: number[][]): boolean => {
                for(let i: number = index+1; i < array.length; i++)
                    if((array[i][0] === value[0]) && (array[i][1] === value[1]))
                        return false;
                return true;
            });

        let {isCorrect, errorIndexes} = UtilsServiceCivilizations.checkForbiddenPairsTriangles(civilizationNumberPairs);
        if(isCorrect) {
            this.value = UtilsServiceCivilizations.getTeamersForbiddenPairsConfigString(civilizationNumberPairs);
            this.civilizationPairIndexes = civilizationNumberPairs;
            return true;
        }
        this.civilizationErrorIndexes = errorIndexes;
        return false;
    }
}

export class DynamicConfigEntityBooleanGameSetting extends DynamicConfigEntity {
    public readonly type: string = "BooleanGameSetting";
    public value: boolean;
    public readonly properties: JSONDynamicConfigEntityBoolean;

    protected dynamicConfigPointer: DynamicConfig;

    constructor(
        properties: JSONDynamicConfigEntityBoolean,
        value: boolean,
        dynamicConfigPointer: DynamicConfig
    ) {
        super();
        this.value = value;
        this.properties = properties;
        this.dynamicConfigPointer = dynamicConfigPointer;
    }

    public get stringifiedValue(): string { return this.value ? "✅" : "🚫"; }

    public check(value: string): boolean {
        let booleanValue: boolean = (value === "true");
        if((this.dynamicConfigPointer.getAllConfigs().slice(1) as DynamicConfigEntityBooleanGameSetting[])
            .map(config => config.value)
            .filter(configValue => configValue)
            .length + (booleanValue ? 1 : -1) > 1)
        {
            this.value = booleanValue;
            return true;
        }
        return false;
    }
}

export class DynamicConfigEntityBooleanLanguage extends DynamicConfigEntityBooleanGameSetting {
    public readonly type: string = "BooleanLanguage";

    constructor(
        properties: JSONDynamicConfigEntityBooleanLanguage,
        value: boolean,
        dynamicConfigPointer: DynamicConfig
    ) {
        super(properties, value, dynamicConfigPointer);
    }

    override check(value: string): boolean {
        this.dynamicConfigPointer.getAllConfigs().forEach((dynamicConfigEntity): void => {
            (dynamicConfigEntity as DynamicConfigEntityBooleanLanguage).value = false;
        });
        this.value = true;
        return true;
    }
}

export class DynamicConfigEntityNumberMany extends DynamicConfigEntity {
    public readonly type: string = "NumberMany";
    public value: number[];
    public readonly properties: JSONDynamicConfigEntityNumberMany;

    constructor(properties: JSONDynamicConfigEntityNumberMany, value: string) {
        super();
        this.value = value
            .split(" ")
            .map(str => Number(str));
        this.properties = properties;
    }

    public check(value: string): boolean {
        let valueNumberArray: number[] = value
            .replaceAll(",", " ")
            .split(" ")
            .filter(str => str !== "")
            .map(str => Number(str));
        if(
            (valueNumberArray.length < this.properties.minAmount)
            || (valueNumberArray.length > this.properties.maxAmount)
            || (valueNumberArray.some(value => value < this.properties.minValue))
            || (valueNumberArray.some(value => value > this.properties.maxValue))
        ) return false;
        this.value = valueNumberArray;
        return true;
    }

    public get stringifiedValue(): string { return this.value.join(", "); }
}

export class DynamicConfigEntityRoleMany extends DynamicConfigEntity {
    public readonly type: string = "RoleMany";
    public value: string[];
    public readonly properties: JSONDynamicConfigEntityRoleMany;

    constructor(properties: JSONDynamicConfigEntityRoleMany, value: string) {
        super();
        this.value = value
            .split(" ")
            .filter(str => str !== "");
        this.properties = properties;
    }

    public check(value: string): boolean {
        let valueStringArray: string[] = value
            .replaceAll(",", " ")
            .split(" ")
            .filter(str => str !== "");
        if(
            (valueStringArray.length < this.properties.minAmount)
            || (valueStringArray.length > this.properties.maxAmount)
        ) return false;
        this.value = valueStringArray;
        return true;
    }

    public get stringifiedValue(): string {
        return this.value
            .map(roleID => `<@&${roleID}>`)
            .join(", ");
    }
}

export class DynamicConfigEntityChannelMany extends DynamicConfigEntity {
    public readonly type: string = "ChannelMany";
    public value: string[];
    public readonly properties: JSONDynamicConfigEntityChannelMany;

    constructor(properties: JSONDynamicConfigEntityChannelMany, value: string) {
        super();
        this.value = value
            .split(" ")
            .filter(str => str !== "");
        this.properties = properties;
    }

    public check(value: string): boolean {
        let valueStringArray: string[] = value
            .replaceAll(",", " ")
            .split(" ")
            .filter(str => str !== "")
        if(
            (valueStringArray.length < this.properties.minAmount)
            || (valueStringArray.length > this.properties.maxAmount)
        ) return false;
        this.value = valueStringArray;
        return true;
    }

    public get stringifiedValue(): string {
        return this.value
            .map(roleID => `<#${roleID}>`)
            .join(", ");
    }
}

export class DynamicConfigEntityNumberTimeSeconds extends DynamicConfigEntity {
    public readonly type: string = "NumberTimeSeconds";
    public value: number;
    public readonly properties: JSONDynamicConfigEntityNumberTimeSeconds;

    constructor(properties: JSONDynamicConfigEntityNumberTimeSeconds, value: number) {
        super();
        this.value = value/1000;
        this.properties = properties;
    }

    public get stringifiedValue(): string { return String(this.value); }

    public check(value: string): boolean {
        let numberValue: number = Math.floor(Number(value));
        if((numberValue >= this.properties.minValue) && (numberValue <= this.properties.maxValue)) {
            this.value = numberValue;
            return true;
        }
        return false;
    }
}
