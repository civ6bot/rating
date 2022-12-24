import {Column, Entity, PrimaryColumn} from "typeorm";

@Entity()
export class EntityRatingNote {
    @PrimaryColumn()
    guildID!: string;
    @PrimaryColumn()
    gameID!: number;
    @PrimaryColumn()
    userID!: string;

    @Column({type: "timestamp"})
    date!: Date;
    @Column({default: true})
    isActive!: boolean;

    @Column()
    gameType!: string;  // FFA, Teamers
    @Column({type: "integer", nullable: true, default: null})
    civilizationID!: number | null;  // FFA, Teamers
    @Column()
    place!: number;     // при ничье указывать высшее место
    @Column()
    placeTotal!: number;     // сколько всего игроков или команд в игре
    @Column({type: "tinytext", nullable: true, default: null})    // указывать только для победителя
    victoryType!: string | null;   // null, CC, GG, Science, Culture, Domination, Religious, Diplomatic
    @Column()
    rating!: number;
    @Column()
    typedRating!: number;

    @Column()
    isHost!: boolean;
    @Column()
    isSubIn!: boolean;
    @Column()
    isSubOut!: boolean;
    @Column()
    isLeave!: boolean;
}
