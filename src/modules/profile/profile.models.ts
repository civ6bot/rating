export class BestCivsEntity {
    public id: number;
    public victories: number;
    public defeats: number;
    public places: number[];
    public placesTotal: number[];
    public averagePlace: number;

    public constructor(id: number) {
        this.id = id;
        this.victories = 0;
        this.defeats = 0;

        this.places = [];
        this.placesTotal = [];
        this.averagePlace = 0;
    }

    public get winrate(): number { 
        return Math.round(this.victories*100/(this.victories+this.defeats)) || 0;
    }

    public setAveragePlace(): void {
        if(
            (this.places.length === 0) || 
            (this.placesTotal.length === 0) ||
            (this.places.length !== this.placesTotal.length)
        )
            return;
        this.averagePlace = this.places
            .map((place: number, index: number): number => 1+(place-1)*(10-1)/((this.placesTotal[index]-1) || 1))   // от 1 до 10 мест
            .reduce((a: number, b: number): number => a+b, 0) / this.places.length;
    }
}
