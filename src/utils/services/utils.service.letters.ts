export class UtilsServiceLetters {
    private static letters: string[] = ["🇦", "🇧", "🇨", "🇩", "🇪", "🇫", "🇬", "🇭", "🇮", "🇯", "🇰", "🇱", "🇲", "🇳", "🇴", "🇵"];

    public static getLetters(): string[] {
        return this.letters.slice();
    }
}
