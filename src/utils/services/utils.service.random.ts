import {HexColorString} from "discord.js";

export class UtilsServiceRandom {
    public static shuffle<T>(array: T[]): T[] {
        let shuffledArray: T[] = [];
        while(array.length > 0)
            shuffledArray.push(array.splice(Math.floor(Math.random() * array.length), 1)[0]);
        return shuffledArray;
    }

    public static getBrightColor(): HexColorString {
        return '#' + this
            .shuffle([0, 255, Math.floor(Math.random()*256)])             // bright color
            .map(x => ("0" + x.toString(16)).slice(-2))                     // to hex
            .reduce((str, substr) => str+substr) as HexColorString; // to string
    }
}
