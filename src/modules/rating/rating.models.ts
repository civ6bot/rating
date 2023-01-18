import { Message } from "discord.js";

export type RatingChatMessageData = {
    userMessage: Message;
    botMessage: Message;
    timeOfDelete: number;
    timeout: NodeJS.Timeout;
    pendingGameID: number;
};
