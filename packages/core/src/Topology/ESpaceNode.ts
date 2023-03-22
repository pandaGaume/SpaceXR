import { ITreeNode, TreeNode } from "../Collections/TreeNode";

export interface IEspaceNode extends ITreeNode {
    id?: string;
}

export class ESpaceNode extends TreeNode implements IEspaceNode {
    _id?: string;

    constructor(id: string | undefined) {
        super();
        this._id = id;
    }

    public get id(): string | undefined {
        return this._id;
    }
}
