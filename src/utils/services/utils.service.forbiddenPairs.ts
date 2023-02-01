export class UtilsServiceForbiddenPairs {
    // Из строки - массив массивов чисел.
    public static getForbiddenPairs(pairs: string): number[][] {
        return pairs.split(" ")
            .filter(str => str.length)
            .map( (pair: string): number[] => pair.split("_")
                .map( (x: string): number => Number(x)));
    }

    // Принимает на вход список нормальных пар (массив массивов чисел).
    // Возвращает сложный объект:
    // isCorrect - корректный ли результат;
    // errorIndexes - массив массивов (разного размера) с ошибочными индексами.
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

    // Из массива массивов чисел - строку.
    public static getTeamersForbiddenPairsConfigString(pairs: number[][]): string {
        return pairs.map((pair: number[]): string => pair.join("_")).join(" ");
    }
}
