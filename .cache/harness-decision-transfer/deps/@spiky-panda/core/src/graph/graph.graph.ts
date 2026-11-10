import { ICartesian } from "../geometry";
import { Nullable } from "../types";
import { IGraph, INode, IOlink } from "./graph.interfaces";
import { GraphNode } from "./graph.node";

export class Graph<N extends INode, L extends IOlink> extends GraphNode implements IGraph<N, L> {
    public nodes: N[];
    public links: L[];
    public inputs: N[];
    public outputs: N[];
    public hiddens: N[];

    public constructor(
        nodes: N[] = [],
        links: L[] = [],
        inputs: Nullable<N[]> = null,
        outputs: Nullable<N[]> = null,
        hiddens: Nullable<N[]> = null,
        onsc: Nullable<L[]> = null,
        opsc: Nullable<L[]> = null,
        position?: ICartesian
    ) {
        super(onsc, opsc, position); // Pass `position` to `GraphNode`
        this.nodes = nodes;
        this.links = links;
        this.inputs = inputs ?? this.nodes.filter((n) => n.opsc().length === 0);
        this.outputs = outputs ?? this.nodes.filter((n) => n.onsc().length === 0);
        this.hiddens = hiddens ?? this.nodes.filter((n) => !this.inputs.includes(n) && !this.outputs.includes(n));
    }

    public clone(): any {
        const copy = super.clone();
        copy.nodes = this.nodes.map((n) => n.clone());
        copy.links = this.links.map((l) => {
            const cloned = l.clone();
            cloned.oini = copy.nodes[this.nodes.indexOf(<N>l.oini)]; // the underlying setter is taking care of unbind/bind the link from/to node
            cloned.ofin = copy.nodes[this.nodes.indexOf(<N>l.ofin)]; // ...
            return cloned;
        });

        copy.inputs = copy.nodes.filter((n) => n.opsc().length === 0);
        copy.outputs = copy.nodes.filter((n) => n.onsc().length === 0);
        copy.hiddens = copy.nodes.filter((n) => !copy.inputs.includes(n) && !copy.outputs.includes(n));
        return copy;
    }
}
