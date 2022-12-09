import {
    JSONDynamicConfigEntityBoolean, JSONDynamicConfigEntityBooleanGameSetting, JSONDynamicConfigEntityChannelMany,
    JSONDynamicConfigEntityNumber, JSONDynamicConfigEntityNumberMany, JSONDynamicConfigEntityRoleMany,
    JSONDynamicConfigEntityString, JSONDynamicConfigEntityTeamersForbiddenPairs
} from "../../types/type.JSON.DynamicConfigEntities";

export const tagsMap: Map<string, string[]> = new Map<string, string[]>([
    ["DYNAMIC_CONFIG_TITLE", [
        "DYNAMIC_CONFIG_LANGUAGE", "DYNAMIC_CONFIG_MODERATION"
    ]],
]);

export const configsMap = new Map<string, (JSONDynamicConfigEntityNumber
    |JSONDynamicConfigEntityString
    |JSONDynamicConfigEntityBoolean
    |JSONDynamicConfigEntityTeamersForbiddenPairs
    |JSONDynamicConfigEntityBooleanGameSetting
    |JSONDynamicConfigEntityNumberMany
    |JSONDynamicConfigEntityRoleMany
    |JSONDynamicConfigEntityChannelMany
    )[]>([
    ["DYNAMIC_CONFIG_LANGUAGE", []],
    ["DYNAMIC_CONFIG_MODERATION", [
        {
            configTag: "MODERATION_ROLE_MODERATORS_ID",
            textTag: "DYNAMIC_CONFIG_MODERATION_ROLE_MODERATORS_ID",
            type: "RoleMany",
            minAmount: 0,
            maxAmount: 10
        }
    ]]
]);
