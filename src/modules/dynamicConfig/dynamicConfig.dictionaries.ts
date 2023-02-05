import { DynamicConfigEntity } from "./dynamicConfig.models";

export const tagsMap: Map<string, string[]> = new Map<string, string[]>([
    ["DYNAMIC_CONFIG_TITLE", [
        "DYNAMIC_CONFIG_LANGUAGE", "DYNAMIC_CONFIG_MODERATION",
        "DYNAMIC_CONFIG_RATING_POINTS_AND_ROLES", "DYNAMIC_CONFIG_RATING_REPORTS", 
        "DYNAMIC_CONFIG_RATING_NOTIFICATION", "DYNAMIC_CONFIG_LEADERBOARD"
    ]],
]);

export const configsMap = new Map<string, DynamicConfigEntity[]>([
    ["DYNAMIC_CONFIG_LANGUAGE", []],        // Особая конфигурация, берётся из БД и реализуется в методах
    ["DYNAMIC_CONFIG_MODERATION", [
        {
            configTag: "MODERATION_ROLE_MODERATORS_ID",
            textTag: "DYNAMIC_CONFIG_MODERATION_ROLE_MODERATORS_ID",
            type: "RoleMany",
            minAmount: 0,
            maxAmount: 10
        }
    ]],
    ["DYNAMIC_CONFIG_RATING_POINTS_AND_ROLES", [
        {
            configTag: "RATING_DEFAULT_POINTS",
            textTag: "DYNAMIC_CONFIG_RATING_POINTS_AND_ROLES_DEFAULT_POINTS",
            type: "Number",
            minValue: 1,
            maxValue: 10000
        },
        {
            configTag: "RATING_ELO_K",
            textTag: "DYNAMIC_CONFIG_RATING_POINTS_AND_ROLES_ELO_K",
            type: "Number",
            minValue: 1,
            maxValue: 1000
        },
        {
            configTag: "RATING_ELO_D",
            textTag: "DYNAMIC_CONFIG_RATING_POINTS_AND_ROLES_ELO_D",
            type: "Number",
            minValue: 1,
            maxValue: 10000
        },
        {
            configTag: "RATING_VICTORY_MULTIPLIER_PERCENT",
            textTag: "DYNAMIC_CONFIG_RATING_POINTS_AND_ROLES_VICTORY_MULTIPLIER_PERCENT",
            type: "Number",
            minValue: 0,
            maxValue: 100
        },
        {
            configTag: "RATING_ROLES_ID",
            textTag: "DYNAMIC_CONFIG_RATING_POINTS_AND_ROLES_IDS",
            type: "RoleMany",
            minAmount: 0,
            maxAmount: 32
        },
        {
            configTag: "RATING_POINTS_TO_ROLE",
            textTag: "DYNAMIC_CONFIG_RATING_POINTS_AND_ROLES_MIN_POINTS",
            type: "NumberMany",
            minAmount: 0,
            maxAmount: 32
        }
    ]],
    ["DYNAMIC_CONFIG_RATING_REPORTS", [
        {
            configTag: "RATING_REPORTS_HOST",
            textTag: "DYNAMIC_CONFIG_RATING_REPORTS_HOST",
            type: "Boolean"
        },
        {
            configTag: "RATING_REPORTS_CIVS",
            textTag: "DYNAMIC_CONFIG_RATING_REPORTS_CIVS",
            type: "Boolean"
        },
        {
            configTag: "RATING_USER_REPORTS_CHANNEL_ID",
            textTag: "DYNAMIC_CONFIG_RATING_REPORTS_USER",
            type: "ChannelMany",
            minAmount: 0,
            maxAmount: 1
        },
        {
            configTag: "RATING_MODERATOR_REPORTS_CHANNEL_ID",
            textTag: "DYNAMIC_CONFIG_RATING_REPORTS_MODERATOR",
            type: "ChannelMany",
            minAmount: 0,
            maxAmount: 1
        },
        {
            configTag: "RATING_BOT_REPORTS_CHANNEL_ID",
            textTag: "DYNAMIC_CONFIG_RATING_REPORTS_BOT",
            type: "ChannelMany",
            minAmount: 0,
            maxAmount: 1
        },
        {
            configTag: "RATING_REPORT_MODERATION_EMOJIS",
            textTag: "DYNAMIC_CONFIG_RATING_REPORTS_EMOJIS_VOTE",
            type: "Boolean"
        }
    ]],
    ["DYNAMIC_CONFIG_RATING_NOTIFICATION", [
        {
            configTag: "RATING_REJECT_AUTHOR_PM_NOTIFY",
            textTag: "DYNAMIC_CONFIG_RATING_NOTIFICATION_REJECT_AUTHOR",
            type: "Boolean"
        },
        {
            configTag: "RATING_REPORT_ALL_PM_NOTIFY",
            textTag: "DYNAMIC_CONFIG_RATING_NOTIFICATION_REPORT_ALL",
            type: "Boolean"
        },
        {
            configTag: "RATING_ACCEPT_AUTHOR_PM_NOTIFY",
            textTag: "DYNAMIC_CONFIG_RATING_NOTIFICATION_ACCEPT_AUTHOR",
            type: "Boolean"
        },
        {
            configTag: "RATING_ACCEPT_ALL_PM_NOTIFY",
            textTag: "DYNAMIC_CONFIG_RATING_NOTIFICATION_ACCEPT_ALL",
            type: "Boolean"
        }
    ]],
    ["DYNAMIC_CONFIG_LEADERBOARD", [
        {
            configTag: "LEADERBOARD_MAX_LENGTH",
            textTag: "DYNAMIC_CONFIG_LEADERBOARD_LENGTH",
            type: "Number",
            minValue: 3,
            maxValue: 500
        },
        {
            configTag: "LEADERBOARD_STATIC_MAX_LENGTH",
            textTag: "DYNAMIC_CONFIG_LEADERBOARD_STATIC_LENGTH",
            type: "Number",
            minValue: 3,
            maxValue: 500
        },
        {
            configTag: "LEADERBOARD_SHOW_GAMES",
            textTag: "DYNAMIC_CONFIG_LEADERBOARD_SHOW_GAMES",
            type: "Boolean",
        },
        {
            configTag: "LEADERBOARD_STATIC_SHOW_GAMES",
            textTag: "DYNAMIC_CONFIG_LEADERBOARD_STATIC_SHOW_GAMES",
            type: "Boolean",
        },
    ]],
]);
