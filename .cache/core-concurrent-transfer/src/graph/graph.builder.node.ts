import { ICartesian } from "../geometry";
import { Nullable } from "../types";
import { INode, IOlink, isOlink } from "./graph.interfaces";
import { ILinkBuilder, INodeBuilder } from "./graph.interfaces.builder";
import { GraphNode } from "./graph.node";

/**
 * Base builder for the concrete GraphNode class. Subclasses extend
 * this and override _createNode() to swap the concrete node type. The
 * base class no longer accepts a constructor reference at runtime; see
 * graph.interfaces.builder.ts for the rationale.
 *
 * Collection methods use rest parameters so callers write
 * `.withInputs(linkA, linkB)` without brackets; pass an existing array
 * with `.withInputs(...arr)`.
 */
export class GraphNodeBuilder implements INodeBuilder {
    /**
     * Helper: resolves builders by calling .build(), leaves pre-built
     * items as-is. Used by the GraphNodeBuilder / GraphBuilder family
     * to accept mixed (concrete + builder) inputs uniformly.
     */
    public static Resolve<T, B>(items: Array<T | B>, isType: (item: T | B) => item is T): T[] {
        return items.map((item) => (isType(item) ? item : (item as any).build()));
    }

    protected _position?: ICartesian;
    protected _inputs: Nullable<Array<IOlink>> = null;
    protected _outputs: Nullable<Array<IOlink>> = null;

    public withPosition(p: ICartesian): this {
        this._position = p;
        return this;
    }

    public withInputs(...links: Array<IOlink | ILinkBuilder>): this {
        this._inputs = this._inputs ?? [];
        this._inputs.push(...GraphNodeBuilder.Resolve(links, isOlink<IOlink>));
        return this;
    }

    public withOutputs(...links: Array<IOlink | ILinkBuilder>): this {
        this._outputs = this._outputs ?? [];
        this._outputs.push(...GraphNodeBuilder.Resolve(links, isOlink<IOlink>));
        return this;
    }

    public build(): INode {
        return this._createNode(this._inputs, this._outputs, this._position);
    }

    /**
     * Factory for the concrete node class. Subclass builders override
     * this to instantiate their own node type (e.g. MlpNeuronBuilder
     * returns an MlpNeuron). The base implementation returns a plain
     * GraphNode.
     */
    protected _createNode(onsc: Nullable<IOlink[]>, opsc: Nullable<IOlink[]>, position?: ICartesian): INode {
        return new GraphNode(onsc, opsc, position);
    }

    public reset(): this {
        this._position = undefined;
        this._inputs = null;
        this._outputs = null;
        return this;
    }
}
