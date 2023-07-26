import {Column, Entity, PrimaryColumn} from "typeorm";

@Entity()
export class EntityConfig {
    @PrimaryColumn()
    guildID!: string;

    @PrimaryColumn()
    setting!: string;

    @Column({type: "text"})
    value!: string;
}
