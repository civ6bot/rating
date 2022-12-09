import {DynamicConfigEntityNumberTimeSeconds} from "../modules/dynamicConfig/dynamicConfig.models";

export interface JSONDynamicConfigEntity {
    configTag: string,
    textTag: string,
    type: string
}

export interface JSONDynamicConfigEntityNumber extends JSONDynamicConfigEntity {
    minValue: number,
    maxValue: number
}

export interface JSONDynamicConfigEntityString extends JSONDynamicConfigEntity {
    isEmoji: boolean
}

export interface JSONDynamicConfigEntityBoolean extends JSONDynamicConfigEntity {}

export interface JSONDynamicConfigEntityTeamersForbiddenPairs extends JSONDynamicConfigEntity {}

export interface JSONDynamicConfigEntityBooleanGameSetting extends JSONDynamicConfigEntity {}

export interface JSONDynamicConfigEntityBooleanLanguage extends JSONDynamicConfigEntityBooleanGameSetting {}

export interface JSONDynamicConfigEntityNumberMany extends JSONDynamicConfigEntity {
    minAmount: number,
    maxAmount: number,

    minValue: number,
    maxValue: number
}

export interface JSONDynamicConfigEntityRoleMany extends JSONDynamicConfigEntity {
    minAmount: number,
    maxAmount: number
}

export interface JSONDynamicConfigEntityChannelMany extends JSONDynamicConfigEntity {
    minAmount: number,
    maxAmount: number
}

export interface JSONDynamicConfigEntityNumberTimeSeconds extends JSONDynamicConfigEntityNumber {}
