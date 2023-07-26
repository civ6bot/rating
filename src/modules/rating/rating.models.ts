import { Message } from "discord.js";

// Этот объект нужен, чтобы хранить сообщения, в которых
// пользователь изменяет отчет.
// Когда проходит слишком много времени, но отчет за всё это
// время не изменяет своего состояния и не отправляется автором,
// то сообщение удаляется.
export type RatingChatMessageData = {
    botMessage: Message;
    userMessage: Message|undefined;
    timeOfDelete: number;
    timeout: NodeJS.Timeout;
    pendingGameID: number;
};
