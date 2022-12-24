export class BestCivsEntity {
    public id: number;
    public victories: number;
    public defeats: number;

    public constructor(id: number) {
        this.id = id;
        this.victories = 0;
        this.defeats = 0;
    }

    public get winrate(): number { 
        return Math.round(this.victories*100/(this.victories+this.defeats)) || 0;
    }
}
