import {GuildMember, EmbedBuilder, User} from "discord.js";
import {discordClient} from "../../client/client";

export class UtilsServicePM {
    public static async send(
        userDataInstance: string | GuildMember | User,
        message: string | EmbedBuilder[]
    ): Promise<boolean> {
        let user: User;
        try {
            switch(userDataInstance.constructor.name){
                case "String":
                    user = await discordClient.users.fetch(userDataInstance as string);
                    break;
                case "GuildMember":
                    user = (userDataInstance as GuildMember).user;
                    break;
                default:
                    user = userDataInstance as User;
                    break;
            }
            await user.send(
                (message.constructor.name === "String")
                ? message as string
                : {embeds: message as EmbedBuilder[]}
            );
            return true;
        } catch {
            return false;
        }
    }
}
