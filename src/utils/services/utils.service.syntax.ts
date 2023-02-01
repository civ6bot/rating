export class UtilsServiceSyntax {
    // Является ли строка особым эмодзи Discord
    private static isEmoji(str: string): boolean {
        return (str[0] === "<") && (str[str.length-1] === ">");
    }

    // Поиск подстроки substr
    // на предмет ЛЮБОГО вхождения в один из элементов
    // массива строк texts.
    // Возвращает индексы строк, в которых есть подстрока
    public static searchTexts(substr: string, texts: string[]): number[] {
        let searchedIndexes: number[] = [];
        let isSubstrEmoji: boolean = this.isEmoji(substr);
        substr = substr.toLowerCase();
        texts.forEach((text: string, index: number) => {
            if(text.replaceAll(",", " ")
                .toLowerCase()
                .split(" ")
                .filter(str => isSubstrEmoji || (!this.isEmoji(str)))
                .join(" ")
                .includes(substr)
            ) 
                searchedIndexes.push(index);
        });
        return searchedIndexes;
    }

    // Поиск подстроки substr
    // на предмет ТОЧНОГО вхождения (без учёта регистра) в один из элементов
    // массива строк texts.
    // Возвращает индексы строк, в которых есть подстрока
    public static searchExactlyTexts(substr: string, texts: string[]): number[] {
        let searchedIndexes: number[] = [];
        let isSubstrEmoji: boolean = this.isEmoji(substr);
        substr = substr.toLowerCase();
        texts.forEach((text: string, index: number) => {
            if(text.replaceAll(",", " ")
                .toLowerCase()
                .split(" ")
                .filter(str => isSubstrEmoji || (!this.isEmoji(str)))
                .some(splittedText => splittedText === substr)
            ) 
                searchedIndexes.push(index);
        });
        return searchedIndexes;
    }

    // Принимает на вход
    // строку с исходным текстом rawBans
    // и массив строк civilizationTexts.
    //
    // Возвращает сложный объект:
    // bans - индексы по массиву civilizationTexts,
    // errors - несоотнесённые части строки rawBans.
    public static parseBans(rawBans: string, civilizationTexts: string[]) {
        let rawBansArray: string[] = rawBans
            .replaceAll(",", " ")
            .replaceAll("\n", " ")
            .replaceAll("<", " <")
            .replaceAll(">", "> ")
            .split(" ")
            .filter(str => str.length > 0);
        let bans: number[] = [], errors: string[] = [];
        for(let i: number = 0; i < rawBansArray.length; i++) {      // Нельзя заменить на forEach, т.к. i может увеличиться в цикле ещё раз
            let currentBannedArray: number[] = this.searchTexts(rawBansArray[i], civilizationTexts);
            if((currentBannedArray.length === 0)) {
                errors.push(rawBansArray[i]);
                continue;
            }
            else if(currentBannedArray.length === 1) {
                bans.push(currentBannedArray[0]);
                continue;
            }
            // Если 2 <=, то проверяем дальше
            let currentExactlyBannedArray: number[] = this.searchExactlyTexts(rawBansArray[i], civilizationTexts);
            currentExactlyBannedArray = currentExactlyBannedArray.filter(banIndex => currentBannedArray.indexOf(banIndex) !== -1);
            if(currentExactlyBannedArray.length === 1) {    // Проверка на точное вхождение
                bans.push(currentExactlyBannedArray[0]);    // если было найдено несколько.
                continue;                                   // Пример: Кри - Кристина
            }

            if(i+1 === rawBansArray.length) {   // Тут пробуем посмотреть на следующий.
                errors.push(rawBansArray[i]);   // Этот элемент последний, поэтому поиска для следующего не существует
                continue; 
            }
            let nextBannedArray = this.searchTexts(rawBansArray[i+1], civilizationTexts);
            nextBannedArray = nextBannedArray.filter(banIndex => currentBannedArray.indexOf(banIndex) !== -1);
            if(nextBannedArray.length !== 1)        // Поиск по пересечению множеств для текущего и следующего
                errors.push(rawBansArray[i]);       // массивов полученных индексов, аналогично алгоритму в начале
            else {
                bans.push(nextBannedArray[0])
                i++;    // уже проверили следующий, значит можно пропустить
            }
        }

        return {
            bans: Array.from(new Set(bans)),    // массив уникальных индексов
            errors: errors                      // массив строк из исходных данных
        };
    }
}
