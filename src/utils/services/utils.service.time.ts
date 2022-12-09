export class UtilsServiceTime {
    public static getMs(timeAmount: number, timeUnit: string): number {
        // noinspection FallThroughInSwitchStatementJS
        switch (timeUnit) {
            case "y":
                timeAmount *= 365;
            case "d":
                timeAmount *= 24;
            case "h":
                timeAmount *= 60;
            case "m":
                timeAmount *= 60;
            case "s":
            default:
                timeAmount *= 1000;
        }
        return timeAmount;
    }
}
