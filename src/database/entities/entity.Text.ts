import {Column, Entity, PrimaryColumn} from "typeorm";

@Entity()
export class EntityText {
    @PrimaryColumn()
    tag!: string;

    @PrimaryColumn()
    lang!: string;

    @Column({type: "text", charset: "utf8mb4"})
    value!: string;
}
