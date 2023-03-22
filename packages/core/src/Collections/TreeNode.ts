import { IEventEmitter, EventEmitter } from "../events";

export interface ITreeNode extends IEventEmitter {
    parent?: ITreeNode;
    ancestors(filter?: (n: ITreeNode) => boolean, direct?: boolean): Generator<ITreeNode, void, unknown>;

    count: number;
    childrens(filter?: (n: ITreeNode) => boolean): Generator<ITreeNode, void, unknown>;
    descendants(filter?: (n: ITreeNode) => boolean, direct?: boolean): Generator<ITreeNode, void, unknown>;

    allowChildrens: boolean;
    isLeaf: boolean;
    isRoot: boolean;

    add(...items: Array<ITreeNode>): void;
    remove(...items: Array<ITreeNode>): Array<ITreeNode>;
}

export class TreeNode extends EventEmitter implements ITreeNode {
    _parent?: ITreeNode;
    _childrens?: Array<ITreeNode>;

    public get parent(): ITreeNode | undefined {
        return this._parent;
    }

    public set parent(p: ITreeNode | undefined) {
        if (this.parent !== p) {
            this._parent = p;
        }
    }

    public get count(): number {
        return this._childrens ? this._childrens.length : 0;
    }

    public *ancestors(filter?: (n: ITreeNode) => boolean, direct = false): Generator<ITreeNode, void, unknown> {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        let t: ITreeNode = this;
        if (t.parent) {
            do {
                t = t.parent;
                if (!filter || filter(t)) {
                    yield t;
                    if (direct) {
                        break;
                    }
                }
            } while (t.parent);
        }
    }

    public childrens<T extends ITreeNode>(filter?: (n: ITreeNode) => boolean): Generator<T, void, unknown> {
        return this.descendants<T>(filter, true);
    }

    public *descendants<T extends ITreeNode>(filter?: (n: ITreeNode) => boolean, direct = false): Generator<T, void, unknown> {
        if (this._childrens) {
            for (const c of this._childrens) {
                if (!filter || filter(c)) {
                    yield c as T;
                }
                if (!direct) {
                    for (const d of c.descendants(filter)) {
                        yield d as T;
                    }
                }
            }
        }
    }

    public get allowChildrens(): boolean {
        return true;
    }

    public get isLeaf(): boolean {
        return this._childrens && this._childrens.length !== 0 ? true : false;
    }

    public get isRoot(): boolean {
        return !this._parent;
    }

    public add(...items: Array<ITreeNode>): void {
        if (items && items.length) {
            if (!this._childrens) {
                this._childrens = new Array<ITreeNode>();
            }
            for (const v of items) {
                this._childrens.push(v);
                v.parent = this;
            }
        }
    }

    public remove(...items: Array<ITreeNode>): Array<ITreeNode> {
        const removed: Array<ITreeNode> = [];
        if (this.count) {
            for (const v of items) {
                if (v.parent === this) {
                    if (this._childrens) {
                        const i = this._childrens.indexOf(v);
                        if (i >= 0) {
                            removed.push(...this._childrens.splice(i, 1));
                            if (this._childrens.length === 0) {
                                this._childrens = undefined;
                            }
                            v.parent = undefined;
                        }
                    }
                }
            }
        }
        return removed;
    }
}
