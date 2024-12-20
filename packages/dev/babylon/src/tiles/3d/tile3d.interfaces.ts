import { Nullable } from "@babylonjs/core";
import { IGeoBounded } from "core/geography";

export enum RefinementStrategy {
    ADDITIVE,
    REPLACEMENT,
}

export interface INodeCollection {
    [Symbol.iterator](predicate?: (n: Nullable<Node>) => boolean): IterableIterator<Nullable<Node>>;
}

export interface ITile3DContentGroup extends INodeCollection, IGeoBounded {}

export interface ITile3DContent extends IGeoBounded {
    refinementStrategy: RefinementStrategy;
    geometricError: number;
    [Symbol.iterator](predicate?: (n: Nullable<Node>) => boolean): IterableIterator<Nullable<ITile3DContentGroup>>;
}
