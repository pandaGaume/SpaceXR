import { IOlink, INode } from "./graph.interfaces";
import { ILinkBuilder } from "./graph.interfaces.builder";
import { GraphOLink } from "./graph.olink";

/**
 * Base builder for the concrete GraphOLink class. Subclasses (e.g.
 * SynapseBuilder) extend this and override build() to construct their
 * own link type with a typed signature. The base class no longer
 * accepts a constructor reference at runtime: see the doc on
 * graph.interfaces.builder.ts for the rationale.
 */
export class LinkBuilder implements ILinkBuilder {
    protected _from?: INode;
    protected _to?: INode;

    public withFrom(node: INode): this {
        this._from = node;
        return this;
    }

    public withTo(node: INode): this {
        this._to = node;
        return this;
    }

    public build(): IOlink {
        if (!this._from || !this._to) {
            throw new Error("From and To MUST be defined before building a link.");
        }
        return this._createLink(this._from, this._to);
    }

    /**
     * Factory for the concrete link class. Subclass builders override
     * this to instantiate their own link type (e.g. SynapseBuilder
     * returns a Synapse, ChannelBuilder returns a Channel). The base
     * implementation returns a plain GraphOLink.
     */
    protected _createLink(from: INode, to: INode): IOlink {
        return new GraphOLink(from, to);
    }

    public reset(): this {
        this._from = undefined;
        this._to = undefined;
        return this;
    }
}
