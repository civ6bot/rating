export class UtilsServiceCivilizations {
    public static readonly civilizationsTags: string[] = [
        "DRAFT_AUSTRALIA", "DRAFT_AMERICA", "DRAFT_ENGLAND", "DRAFT_ENGLAND_ELEANOR",
        "DRAFT_ARABIA", "DRAFT_AZTECS", "DRAFT_BRAZIL", "DRAFT_HUNGARY",
        "DRAFT_GERMANY", "DRAFT_GREECE_PERICLES", "DRAFT_GREECE_GORGO", "DRAFT_GEORGIA",
        "DRAFT_EGYPT", "DRAFT_ZULU", "DRAFT_INDIA", "DRAFT_INDIA_CHANDRAGUPTA",
        "DRAFT_INDONESIA", "DRAFT_INCA", "DRAFT_SPAIN", "DRAFT_CANADA",
        "DRAFT_CHINA", "DRAFT_KONGO", "DRAFT_KOREA", "DRAFT_CREE",
        "DRAFT_KHMER", "DRAFT_MACEDONIA" ,"DRAFT_MALI", "DRAFT_MAORI",
        "DRAFT_MONGOLIA", "DRAFT_MAPUCHE", "DRAFT_NETHERLANDS", "DRAFT_NORWAY",
        "DRAFT_NUBIA", "DRAFT_OTTOMAN", "DRAFT_PERSIA", "DRAFT_POLAND",
        "DRAFT_ROME", "DRAFT_RUSSIA", "DRAFT_SCYTHIA", "DRAFT_PHOENICIA",
        "DRAFT_FRANCE", "DRAFT_FRANCE_ELEANOR", "DRAFT_SWEDEN", "DRAFT_SCOTLAND",
        "DRAFT_SUMERIA", "DRAFT_JAPAN", "DRAFT_MAYA", "DRAFT_COLOMBIA",
        "DRAFT_ETHIOPIA", "DRAFT_AMERICA_ROUGH_RIDER", "DRAFT_FRANCE_MAGNIFICENCE", "DRAFT_BYZANTIUM",
        "DRAFT_GAUL", "DRAFT_BABYLON", "DRAFT_CHINA_KUBLAI", "DRAFT_MONGOLIA_KUBLAI",
        "DRAFT_VIETNAM", "DRAFT_PORTUGAL"
    ];

    private static searchTexts(substr: string, civilizationsTexts: string[]): number[] {
        let searchedIndexes: number[] = [];
        civilizationsTexts.forEach((text: string, index: number) => {
            if(text.toLowerCase().includes(substr.toLowerCase()))
                searchedIndexes.push(index);
        });
        return searchedIndexes;
    }

    // возвращает сложный объект
    // rawBans - просматриваемая строка, civilizationsTexts = const
    // возвращает индексы по const
    public static parseBans(rawBans: string, civilizationTexts: string[]) {
        let rawBansArray: string[] = rawBans.replaceAll("\n", " ").split(" ").filter(str => str.length > 0);
        let bans: number[] = [], errors: string[] = [];

        for(let i: number = 0; i < rawBansArray.length; i++) {
            let currentBannedArray: number[] = this.searchTexts(rawBansArray[i], civilizationTexts);
            if((currentBannedArray.length === 0))
                errors.push(rawBansArray[i]);
            else if(currentBannedArray.length === 1)
                bans.push(currentBannedArray[0]);
            else if(i+1 === rawBansArray.length)
                errors.push(rawBansArray[i]);   // элемент последний, поэтому поиска для следующего не существует
            else {                              // заглядываем в следующий
                currentBannedArray = currentBannedArray
                    .concat(this.searchTexts(rawBansArray[i+1], civilizationTexts))
                    .filter((value, index, array) => array.indexOf(value) !== index);   // НЕ уникальные
                if(currentBannedArray.length !== 1)
                    errors.push(rawBansArray[i]);
                else {
                    bans.push(currentBannedArray[0])
                    i++;    // уже проверили следующий, значит можно пропустить
                }
            }
        }

        return {
            bans: Array.from(new Set(bans)),    // уникальные индексы
            errors: errors
        };
    }

    public static getForbiddenPairs(pairs: string): number[][] {
        return pairs.split(" ")
            .map( (pair: string): number[] => pair.split("_")
                .map( (x: string): number => Number(x)));
    }

    // принимает на вход список нормальных пар
    // возвращает сложный объект
    public static checkForbiddenPairsTriangles(civilizationNumberPairs: readonly number[][]) {
        let triangleSearch: Map<number, number[]> = new Map<number, number[]>;
        let currentCivIndex: number = -1, currentCivPairIndexes: number[] = [];
        for(let i: number = 0; i < civilizationNumberPairs.length; i++) {
            if(civilizationNumberPairs[i][0] === currentCivIndex)
                currentCivPairIndexes.push(civilizationNumberPairs[i][1]);
            if((civilizationNumberPairs[i][0] !== currentCivIndex) || i === civilizationNumberPairs.length-1) {
                if(currentCivPairIndexes.length > 1)
                    triangleSearch.set(currentCivIndex, currentCivPairIndexes.slice());
                currentCivIndex = civilizationNumberPairs[i][0];
                currentCivPairIndexes = [civilizationNumberPairs[i][1]];
            }
        }
        let isCorrect: boolean = true;
        let errorIndexes: number[] = [];
        triangleSearch.forEach((value: number[], key: number): void => {
            if(!isCorrect)
                return;
            for(let i in value)
                if(key === value[i]) {
                    isCorrect = false;
                    errorIndexes = [key];
                    return;
                }
            for(let i: number = 0; i < value.length; i++)
                for(let j: number = i+1; j < value.length; j++)
                    for(let k in civilizationNumberPairs)
                        if((civilizationNumberPairs[k][0] === value[i]) && (civilizationNumberPairs[k][1] === value[j])) {
                            isCorrect = false;
                            errorIndexes = [key, ...value];
                            return;
                        }
        });
        return {isCorrect, errorIndexes};
    }

    public static getTeamersForbiddenPairsConfigString(pairs: number[][]): string {
        return pairs.map((pair: number[]): string => pair.join("_")).join(" ");
    }
}
