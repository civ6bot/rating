import {Column, Entity, PrimaryColumn} from "typeorm";

@Entity()
export class EntityPendingRatingNote {
    @PrimaryColumn()
    guildID!: string;
    @PrimaryColumn()
    gameID!: number;
    @PrimaryColumn()
    userID!: string;

    @Column({type: "timestamp"})
    date!: Date;

    @Column({type: "tinytext", nullable: true, default: null})
    gameType!: string | null;
    @Column({type: "integer", nullable: true, default: null})
    civilizationID!: number | null;  // FFA, Teamers
    @Column()
    place!: number;     // при ничье указывать высшее место
    @Column()
    placeTotal!: number;     // сколько всего игроков или команд в игре
    @Column({type: "tinytext", nullable: true, default: null})    // указывать только для победителя
    victoryType!: string | null;   // null, CC, GG, Science, Culture, Domination, Religious, Diplomatic, по умолчанию - зависит от типа игры
    @Column()
    rating!: number;
    @Column()
    typedRating!: number;

    @Column({default: false})
    isHost!: boolean;
    @Column({default: false})
    isSubIn!: boolean;
    @Column({default: false})
    isSubOut!: boolean;
    @Column({default: false})
    isLeave!: boolean;
}
