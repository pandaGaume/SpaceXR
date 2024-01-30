import { IEnvelope, IGeoBounded } from "./geography.interfaces";
export declare enum SpatialIndexType {
    QUADTREE = 0,
    OCTREE = 1
}
export declare class SpatialIndexOptions {
    static readonly DefaultType = SpatialIndexType.QUADTREE;
    static readonly DefaultMaxCount = 32;
    static readonly DefaultMaxDepth = 10;
    static readonly DefaultThreshold = 8;
    type: SpatialIndexType;
    maxDepth: number;
    maxCount: number;
    threshold: number;
}
export declare class SpatialIndexNode {
    _content?: IGeoBounded[];
    _children: SpatialIndexNode[];
    _parent?: SpatialIndexNode;
    _env: IEnvelope;
    constructor(bounds: IEnvelope, parent?: SpatialIndexNode);
    get children(): SpatialIndexNode[];
    bounds(): IEnvelope;
    get depth(): number;
    get count(): number;
    contents(predicate?: (n: IGeoBounded) => boolean): IterableIterator<IGeoBounded>;
    add(item: IGeoBounded, options: SpatialIndexOptions): void;
    remove(item: IGeoBounded, options: SpatialIndexOptions): void;
    get(bounds: IEnvelope | IGeoBounded | undefined): IGeoBounded[];
    clear(): void;
    isLeaf(): boolean;
}
export declare class SpatialIndex {
    _root: SpatialIndexNode;
    _options: SpatialIndexOptions;
    constructor(bounds: IEnvelope, options?: SpatialIndexOptions);
    get root(): SpatialIndexNode;
    get bounds(): IEnvelope | undefined;
    add(item: IGeoBounded): void;
    remove(item: IGeoBounded): void;
    get(bounds: IEnvelope | IGeoBounded | undefined): IGeoBounded[];
    iterateLeaves(node: SpatialIndexNode): Generator<SpatialIndexNode>;
    static IterateNodes(node: SpatialIndexNode, predicate: (node: SpatialIndexNode, depth: number, x: number, y: number) => void, depth?: number, x?: number, y?: number): void;
}
