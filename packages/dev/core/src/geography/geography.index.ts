import { Envelope } from "./geography.envelope";
import { IEnvelope, IGeoBounded, isGeoBounded } from "./geography.interfaces";

export enum SpatialIndexType {
    QUADTREE = 0,
    OCTREE = 1,
}

export class SpatialIndexOptions {
    public static readonly DefaultType = SpatialIndexType.QUADTREE;
    public static readonly DefaultMaxCount = 32;
    public static readonly DefaultMaxDepth = 10;
    public static readonly DefaultThreshold = 8;

    public type: SpatialIndexType = SpatialIndexOptions.DefaultType;
    public maxDepth: number = SpatialIndexOptions.DefaultMaxDepth;
    public maxCount: number = SpatialIndexOptions.DefaultMaxCount;
    public threshold: number = SpatialIndexOptions.DefaultThreshold; // used to cut level when remove items
}

export class SpatialIndexNode {
    _content?: IGeoBounded[];
    _children: SpatialIndexNode[];
    _parent?: SpatialIndexNode;
    _env: IEnvelope;

    public constructor(bounds: IEnvelope, parent?: SpatialIndexNode) {
        this._parent = parent;
        this._env = bounds;
        this._children = [];
    }

    public get children(): SpatialIndexNode[] {
        return this._children;
    }

    public bounds(): IEnvelope {
        return this._env;
    }

    public get depth(): number {
        if (!this._parent) return 0;
        return this._parent.depth + 1;
    }

    public get count(): number {
        if (this._content) {
            return this._content.length;
        }
        let result = 0;
        if (this._children) {
            for (const child of this._children) {
                result += child.count;
            }
        }
        return result;
    }

    public *contents(predicate?: (n: IGeoBounded) => boolean): IterableIterator<IGeoBounded> {
        if (this._content) {
            for (const c of this._content) {
                if (!predicate || predicate(c)) {
                    yield c;
                }
            }
            return;
        }
        if (this._children) {
            for (const child of this._children) {
                yield* child.contents(predicate);
            }
        }
    }

    public add(item: IGeoBounded, options: SpatialIndexOptions): void {
        if (item && item.bounds?.intersectWith(this._env)) {
            if (!this._children || this._children.length === 0) {
                this._content = this._content || [];
                if ((this._content.length < options?.maxCount ?? SpatialIndexOptions.DefaultMaxCount)
                    || this.depth === options.maxDepth) {
                    this._content.push(item);
                    // console.log(`Item pushed into node content.`);
                    // console.log('Item: ', item);
                    // console.log('Node: ', this);
                    return;
                }
                // split
                const type = options?.type ?? SpatialIndexOptions.DefaultType;
                if (type === SpatialIndexType.QUADTREE) {
                    this._children.push(...Envelope.Split2(this._env).map((e) => new SpatialIndexNode(e, this)));
                } else {
                    this._children.push(...Envelope.Split3(this._env).map((e) => new SpatialIndexNode(e, this)));
                }
                // disptach content
                for (const child of this._children) {
                    for (const content of this._content) {
                        child.add(content, options);
                    }
                }
                this._content = [];
            }
            // disptach new item
            for (const child of this._children) {
                child.add(item, options);
            }
        } else {
            // console.log(`Item doesnt intersects with bounds.`);
            // console.log(item);
            // console.log(this._env);
        }
    }

    public remove(item: IGeoBounded, options: SpatialIndexOptions): void {
        if (item && item.bounds?.intersectWith(this._env)) {
            if (this._content) {
                const index = this._content.findIndex((c) => c === item);
                if (index >= 0) {
                    this._content.splice(index, 1);
                    return;
                }
            }
            if (this._children) {
                let count = 0;
                for (const child of this._children) {
                    child.remove(item, options);
                    count += child.count;
                }
                const max = options?.maxCount ?? SpatialIndexOptions.DefaultMaxCount;
                let t = options?.threshold ?? SpatialIndexOptions.DefaultThreshold;
                t = Math.min(t, max); // ensure t < max
                if (max - count >= t) {
                    this._content = [];
                    for (const child of this._children) {
                        for (const content of child.contents()) {
                            this._content.push(content);
                        }
                        child.clear();
                    }
                    this._children = [];
                }
            }
        }
    }

    public get(bounds: IEnvelope | IGeoBounded | undefined): IGeoBounded[] {
        if (bounds) {
            if (isGeoBounded(bounds)) {
                return this.get(bounds.bounds);
            }
            if (this._env.intersectWith(bounds)) {
                if (this._content) {
                    return this._content.filter((c) => c.bounds?.intersectWith(bounds));
                }
                const result: IGeoBounded[] = [];
                for (const child of this._children) {
                    result.push(...child.get(bounds));
                }
                return result;
            }
        }
        return [];
    }

    public clear(): void {
        this._content = undefined;
        if (this._children) {
            for (const child of this._children) {
                child.clear();
            }
        }
    }

    isLeaf(): boolean {
        return !this._children || this._children.length === 0;
    }
}

export class SpatialIndex {
    _root: SpatialIndexNode;
    _options: SpatialIndexOptions;

    public constructor(bounds: IEnvelope, options?: SpatialIndexOptions) {
        this._root = new SpatialIndexNode(bounds);
        this._options = options || new SpatialIndexOptions();
    }

    public get root(): SpatialIndexNode {
        return this._root;
    }

    public get bounds(): IEnvelope | undefined {
        return this._root.bounds();
    }

    public add(item: IGeoBounded): void {
        this._root.add(item, this._options);
    }

    public remove(item: IGeoBounded): void {
        this._root.remove(item, this._options);
    }

    public get(bounds: IEnvelope | IGeoBounded | undefined): IGeoBounded[] {
        return this._root.get(bounds);
    }

    *iterateLeaves(node: SpatialIndexNode): Generator<SpatialIndexNode> {
        if (!node.children?.length) {
            yield node;
        } else {
            for (const child of node.children) {
                if (child !== null) {
                    yield* this.iterateLeaves(child);
                }
            }
        }
    }

    static IterateNodes(
        node: SpatialIndexNode,
        predicate: (node: SpatialIndexNode, depth: number, x: number, y: number) => void,
        depth: number = 0,
        x: number = 0,
        y: number = 0
    ): void {
        predicate(node, depth, x, y);
        if (!node.isLeaf()) {
            // const childSize = Math.pow(2, depth);
            for (let i = 0; i < 4; i++) {
                // // const childX = x + (i % 2) * childSize;
                // const childX = x * childSize + (i % 2);
                // // const childY = y + Math.floor(i / 2) * childSize;
                // const childY = y * childSize + Math.floor(i / 2);
                // number of nodes on the left
                const offsetX = x * 2;
                const offsetY = y * 2;

                const childX = offsetX + (i % 2);
                const childY = offsetY + Math.floor(i / 2);
                const childNode = node.children[i];
                if (childNode !== null) {
                    SpatialIndex.IterateNodes(childNode, predicate, depth + 1, childX, childY);
                }
            }
        }
    }
}
