import {Column, Entity, PrimaryColumn} from "typeorm";

@Entity()
export class EntityUserRating {
    @PrimaryColumn()
    guildID!: string;
    @PrimaryColumn()
    userID!: string;

    @Column()
    rating!: number;
    @Column({default: 0})
    host!: number;
    @Column({default: 0})
    subIn!: number;
    @Column({default: 0})
    subOut!: number;
    @Column({default: 0})
    leave!: number;
    @Column({type: "timestamp", nullable: true, default: null})
    lastGame!: Date | null;

    @Column()
    ffaRating!: number;
    @Column({default: 0})
    ffaTotal!: number;
    @Column({default: 0})
    ffaWin!: number;
    @Column({default: 0})
    ffaLose!: number;
    @Column({default: 0})
    ffaFirst!: number;

    @Column({default: 0})
    ffaVictoryScience!: number;
    @Column({default: 0})
    ffaVictoryCulture!: number;
    @Column({default: 0})
    ffaVictoryDomination!: number;
    @Column({default: 0})
    ffaVictoryReligious!: number;
    @Column({default: 0})
    ffaVictoryDiplomatic!: number;
    @Column({default: 0})
    ffaVictoryCC!: number;

    @Column()
    teamersRating!: number;
    @Column({default: 0})
    teamersTotal!: number;
    @Column({default: 0})
    teamersWin!: number;
    @Column({default: 0})
    teamersLose!: number;

    @Column({default: 0})
    teamersVictoryScience!: number;
    @Column({default: 0})
    teamersVictoryCulture!: number;
    @Column({default: 0})
    teamersVictoryDomination!: number;
    @Column({default: 0})
    teamersVictoryReligious!: number;
    @Column({default: 0})
    teamersVictoryDiplomatic!: number;
    @Column({default: 0})
    teamersVictoryGG!: number;
}
