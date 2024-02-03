import { Nullable, TransformNode } from "@babylonjs/core";
import { IEnvelope } from "core/geography";
import { ITile3DContent, ITile3DContentGroup, RefinementStrategy } from "./tile3d.interfaces";
export declare class Tile3DContentGroup implements ITile3DContentGroup {
    _name: string;
    _enabled: boolean;
    _envelope?: IEnvelope;
    constructor(name: string);
    get name(): string;
    get enabled(): boolean;
    set enabled(v: boolean);
    get bounds(): IEnvelope | undefined;
    set bounds(v: IEnvelope | undefined);
    [Symbol.iterator](predicate?: (n: Nullable<Node>) => boolean): IterableIterator<Nullable<Node>>;
}
export declare class Tile3DContent extends TransformNode implements ITile3DContent {
    private _refinementStrategy;
    private _geometricError;
    constructor(name: string);
    get refinementStrategy(): RefinementStrategy;
    set refinementStrategy(v: RefinementStrategy);
    get geometricError(): number;
    set geometricError(v: number);
    [Symbol.iterator](predicate?: (n: Nullable<Node>) => boolean): IterableIterator<Nullable<Tile3DContentGroup>>;
}
