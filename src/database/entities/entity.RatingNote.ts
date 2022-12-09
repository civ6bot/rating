import {Column, Entity, PrimaryColumn} from "typeorm";

@Entity()
export class EntityRatingNote {
    @PrimaryColumn()
    guildID!: string;
    @PrimaryColumn()
    gameID!: number;
    @PrimaryColumn()
    userID!: string;

    @Column({type: "timestamp", default: new Date()})
    date!: Date;
    @Column({default: true})
    isActive!: boolean;

    @Column()
    gameType!: string;  // FFA, Teamers
    @Column()
    civilizationID!: number;  // FFA, Teamers
    @Column()
    place!: number;     // при ничье указывать высшее место
    @Column({nullable: true, default: null})    // указывать только для победителя
    victoryType!: string;   // null, CC, GG, Science, Culture, Domination, Religious, Diplomatic
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
