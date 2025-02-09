import { Nullable, Node } from "@babylonjs/core";
import { IGeoBounded } from "core/geography";

export enum RefinementStrategy {
    ADDITIVE,
    REPLACEMENT,
}

export interface INodeCollection {
    [Symbol.iterator](predicate?: (n: Nullable<Node>) => boolean): IterableIterator<Nullable<Node>>;
}

export interface ITile3DGroup extends INodeCollection, IGeoBounded {}

export interface ITile3D extends IGeoBounded {
    refinementStrategy: RefinementStrategy;
    geometricError: number;
    [Symbol.iterator](predicate?: (n: Nullable<Node>) => boolean): IterableIterator<Nullable<ITile3DGroup>>;
}
