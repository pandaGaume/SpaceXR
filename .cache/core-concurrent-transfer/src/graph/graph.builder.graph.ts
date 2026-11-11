import { ICartesian } from "../geometry";
import { Nullable } from "../types";
import { GraphNodeBuilder } from "./graph.builder.node";
import { Graph } from "./graph.graph";
import { IGraph, INode, IOlink, isNode, isOlink } from "./graph.interfaces";
import { IGraphBuilder, ILinkBuilder, INodeBuilder } from "./graph.interfaces.builder";

/**
 * Base builder for the concrete Graph<N, L> class. Subclasses
 * override _createGraph() (richer graph type) and / or _createLink()
 * (wire two nodes when withLinks() receives a node chain).
 *
 * All collection methods use rest parameters so callers write
 * `.withNodes(a, b, c)` without brackets; pass an existing array with
 * `.withNodes(...arr)`.
 */
export class GraphBuilder<N extends INode, L extends IOlink> implements IGraphBuilder<N, L> {
    protected _position?: ICartesian;
    // Graph-as-node input/output links (the channels feeding into / leaving
    // the graph when it is embedded as a node in a parent graph).
    protected _nodeInputLinks: Nullable<Array<L>> = null;
    protected _nodeOutputLinks: Nullable<Array<L>> = null;
    protected _nodes: N[] = [];
    protected _links: L[] = [];
    // Graph's own input/output/hidden NODE sets (the input/output neurons
    // for a neural-network graph, for example). When null, the Graph
    // constructor auto-detects them from connectivity.
    protected _inputs: Nullable<Array<N>> = null;
    protected _outputs: Nullable<Array<N>> = null;
    protected _hiddens: Nullable<Array<N>> = null;

    /**
     * Optionally seed the builder from an existing graph. Topology arrays are
     * copied, while node and link identities are preserved.
     */
    public constructor(graph?: IGraph<N, L>) {
        if (graph) this._hydrateGraph(graph);
    }

    /** Reset and seed this builder from an existing graph. */
    public withGraph(graph: IGraph<N, L>): this {
        this.reset();
        this._hydrateGraph(graph);
        return this;
    }

    /** Set the node position. The graph is assumed to be a node through inheritance. */
    public withNodePosition(p: ICartesian): this {
        this._position = p;
        return this;
    }

    /** Set input links (the graph-as-node side, used when embedded in a parent). */
    public withNodeInputs(...links: Array<IOlink | ILinkBuilder>): this {
        this._nodeInputLinks = this._nodeInputLinks ?? [];
        this._nodeInputLinks.push(...GraphNodeBuilder.Resolve(links, isOlink<L>));
        return this;
    }

    /** Set output links (the graph-as-node side, used when embedded in a parent). */
    public withNodeOutputs(...links: Array<IOlink | ILinkBuilder>): this {
        this._nodeOutputLinks = this._nodeOutputLinks ?? [];
        this._nodeOutputLinks.push(...GraphNodeBuilder.Resolve(links, isOlink<L>));
        return this;
    }

    /**
     * Declare the graph's input NODE set (e.g. input neurons of an
     * MLP). When omitted, the Graph constructor auto-detects them as
     * nodes with empty opsc().
     */
    public withInputs(...nodes: Array<N | INodeBuilder>): this {
        this._inputs = this._inputs ?? [];
        this._inputs.push(...GraphNodeBuilder.Resolve(nodes, isNode<N>));
        return this;
    }

    /**
     * Declare the graph's output NODE set. When omitted, auto-detected
     * as nodes with empty onsc().
     */
    public withOutputs(...nodes: Array<N | INodeBuilder>): this {
        this._outputs = this._outputs ?? [];
        this._outputs.push(...GraphNodeBuilder.Resolve(nodes, isNode<N>));
        return this;
    }

    /**
     * Declare the graph's hidden NODE set. When omitted, auto-detected
     * as the nodes that are neither inputs nor outputs.
     */
    public withHiddens(...nodes: Array<N | INodeBuilder>): this {
        this._hiddens = this._hiddens ?? [];
        this._hiddens.push(...GraphNodeBuilder.Resolve(nodes, isNode<N>));
        return this;
    }

    /** Add nodes to the graph. */
    public withNodes(...nodes: Array<N | INodeBuilder>): this {
        this._nodes.push(...GraphNodeBuilder.Resolve(nodes, isNode<N>));
        return this;
    }

    /**
     * Replace a node in place, preserve its topology index and partition
     * membership, and rewire all links owned by this builder.
     */
    public replaceNode(current: N, replacement: N): this {
        if (current === replacement) return this;
        const index = this._nodes.indexOf(current);
        if (index < 0) throw new Error("replaceNode: current node is not part of this builder.");
        if (this._nodes.includes(replacement)) throw new Error("replaceNode: replacement node is already part of this builder.");

        for (const link of this._links) {
            if (link.oini === current) link.oini = replacement;
            if (link.ofin === current) link.ofin = replacement;
        }
        this._nodes[index] = replacement;
        this._inputs = replacePartitionNode(this._inputs, current, replacement);
        this._outputs = replacePartitionNode(this._outputs, current, replacement);
        this._hiddens = replacePartitionNode(this._hiddens, current, replacement);
        return this;
    }

    /**
     * Replace a link in place and detach the previous link from its endpoints.
     * The replacement keeps its own configured endpoints and properties.
     */
    public replaceLink(current: L, replacement: L): this {
        if (current === replacement) return this;
        const index = this._links.indexOf(current);
        if (index < 0) throw new Error("replaceLink: current link is not part of this builder.");
        if (this._links.includes(replacement)) throw new Error("replaceLink: replacement link is already part of this builder.");

        current.dispose();
        current.oini = null;
        current.ofin = null;
        this._links[index] = replacement;
        return this;
    }

    /**
     * Add links to the graph. Three accepted shapes (per call):
     *   - pre-built links: `withLinks(linkA, linkB, ...)`
     *   - link builders:   `withLinks(builderA, builderB, ...)`
     *   - a chain of nodes: `withLinks(nodeA, nodeB, nodeC, ...)` —
     *     creates one link per consecutive pair via `_createLink`.
     *     The default `_createLink` throws; subclass builders that
     *     know the concrete link type (RuntimeGraphBuilder, ...)
     *     override it.
     */
    public withLinks(...items: Array<L | ILinkBuilder | N>): this {
        if (items.length === 0) {
            return this;
        }
        // Sniff the first item to decide the branch. All items must
        // be of the same family (we don't support mixing).
        const first = items[0];
        if (isNode<N>(first)) {
            const nodes = items as N[];
            if (nodes.length < 2) {
                throw new Error("withLinks: a node chain needs at least 2 nodes");
            }
            for (let i = 0; i < nodes.length - 1; i++) {
                this._links.push(this._createLink(nodes[i], nodes[i + 1]));
            }
            return this;
        }
        // Otherwise it's links or link builders.
        this._links.push(...GraphNodeBuilder.Resolve(items as Array<L | ILinkBuilder>, isOlink<L>));
        return this;
    }

    /**
     * Build and return an `IGraph<N, L>`. Typed against the INTERFACE, not
     * the concrete `Graph<N, L>`, so a subclass factory can return any
     * IGraph implementation (e.g. `RuntimeGraph`, which is an `IRuntimeGraph`
     * but no longer extends the `Graph` class) without relying on structural
     * assignability to that class.
     */
    public build(): IGraph<N, L> {
        return this._createGraph(
            this._nodes,
            this._links,
            this._inputs ? [...this._inputs] : null,
            this._outputs ? [...this._outputs] : null,
            this._hiddens ? [...this._hiddens] : null,
            this._nodeInputLinks ? [...this._nodeInputLinks] : null,
            this._nodeOutputLinks ? [...this._nodeOutputLinks] : null,
            this._position
        );
    }

    // ── Concrete-class factories (override in subclasses) ─────────────

    /**
     * Factory for the graph instance. The base builds the concrete
     * `Graph<N, L>` but the RETURN TYPE is the `IGraph<N, L>` interface, so
     * subclass overrides can instantiate a richer implementation (e.g.
     * `RuntimeGraph`) that satisfies the contract without sharing the
     * concrete class's prototype.
     */
    protected _createGraph(
        nodes: N[],
        links: L[],
        inputs: Nullable<N[]>,
        outputs: Nullable<N[]>,
        hiddens: Nullable<N[]>,
        onsc: Nullable<L[]>,
        opsc: Nullable<L[]>,
        position?: ICartesian
    ): IGraph<N, L> {
        return new Graph<N, L>(nodes, links, inputs, outputs, hiddens, onsc, opsc, position);
    }

    /**
     * Factory for an internal link wiring two graph nodes. Invoked by
     * `withLinks(...nodes)` chain form. The default throws because the
     * base builder cannot know which concrete link type to construct.
     * Subclasses (RuntimeGraphBuilder, ...) override this to produce
     * their domain-specific link type.
     */
    protected _createLink(_from: N, _to: N): L {
        throw new Error("withLinks(nodes): the base GraphBuilder cannot infer the link type. Override _createLink in a subclass (e.g. RuntimeGraphBuilder).");
    }

    /** Reset the builder to its initial state. */
    public reset(): this {
        this._position = undefined;
        this._nodeInputLinks = null;
        this._nodeOutputLinks = null;
        this._nodes = [];
        this._links = [];
        this._inputs = null;
        this._outputs = null;
        this._hiddens = null;
        return this;
    }

    private _hydrateGraph(graph: IGraph<N, L>): void {
        this._position = graph.position;
        this._nodeInputLinks = [...graph.onsc<L>()];
        this._nodeOutputLinks = [...graph.opsc<L>()];
        this._nodes = [...graph.nodes];
        this._links = [...graph.links];
        this._inputs = [...graph.inputs];
        this._outputs = [...graph.outputs];
        this._hiddens = [...graph.hiddens];
    }
}

function replacePartitionNode<N extends INode>(partition: Nullable<N[]>, current: N, replacement: N): Nullable<N[]> {
    if (partition === null) return null;
    return partition.map((node) => (node === current ? replacement : node));
}
