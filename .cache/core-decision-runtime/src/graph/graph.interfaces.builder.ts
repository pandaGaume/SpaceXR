import { ICartesian } from "../geometry/geometry.interfaces";
import { IGraph, INode, IOlink } from "./graph.interfaces";

/**
 * Fluent builders for the graph layer.
 *
 * The base builders (LinkBuilder, GraphNodeBuilder, GraphBuilder) each
 * produce their own concrete class (GraphOLink, GraphNode, Graph). When
 * a caller needs to construct a subclass (Synapse, MlpNeuron, CnnGraph,
 * ...), the right way is to extend the relevant base builder and
 * override `build()` (or the dedicated `_createXxx` factory) with a
 * typed signature. The base builders never accept a constructor at
 * runtime.
 *
 * All collection-style methods (withNodes, withLinks, withInputs, ...)
 * use rest parameters so callers can write `.withNodes(a, b, c)` without
 * brackets; pass an existing array with the spread operator
 * (`.withNodes(...arr)`).
 */

export interface ILinkBuilder {
    withFrom(node: INode): ILinkBuilder;
    withTo(node: INode): ILinkBuilder;
    build(): IOlink;
}

export interface INodeBuilder {
    withPosition(p: ICartesian): INodeBuilder;
    withInputs(...links: Array<IOlink | ILinkBuilder>): INodeBuilder;
    withOutputs(...links: Array<IOlink | ILinkBuilder>): INodeBuilder;
    build(): INode;
}

export interface IGraphBuilder<N extends INode, L extends IOlink> {
    /** Seed this builder from an existing graph without cloning its items. */
    withGraph(graph: IGraph<N, L>): IGraphBuilder<N, L>;

    // the Node part of the graph (graph is also a node through inheritance)
    withNodePosition(p: ICartesian): IGraphBuilder<N, L>;
    withNodeInputs(...links: Array<IOlink | ILinkBuilder>): IGraphBuilder<N, L>;
    withNodeOutputs(...links: Array<IOlink | ILinkBuilder>): IGraphBuilder<N, L>;

    // the graph part of the graph
    withNodes(...nodes: Array<N | INodeBuilder>): IGraphBuilder<N, L>;

    /**
     * Register graph links. Accepts three shapes (mutually exclusive
     * per call):
     *   - pre-built link instances `(linkA, linkB, ...)`
     *   - link builders `(builderA, builderB, ...)`
     *   - a chain of nodes `(nodeA, nodeB, nodeC, ...)` — the builder
     *     creates one link per consecutive pair via the internal
     *     `_createLink(from, to)` factory; throws if the subclass does
     *     not override that factory.
     */
    withLinks(...items: Array<L | ILinkBuilder | N>): IGraphBuilder<N, L>;

    /** Declare the graph input nodes explicitly. When omitted, the Graph
     * constructor auto-detects them from opsc()-empty nodes. */
    withInputs(...nodes: Array<N | INodeBuilder>): IGraphBuilder<N, L>;
    /** Declare the graph output nodes explicitly. When omitted, auto-
     * detected from onsc()-empty nodes. */
    withOutputs(...nodes: Array<N | INodeBuilder>): IGraphBuilder<N, L>;
    /** Declare the graph hidden nodes explicitly. When omitted, auto-
     * detected as nodes not in inputs or outputs. */
    withHiddens(...nodes: Array<N | INodeBuilder>): IGraphBuilder<N, L>;

    /** Replace one graph node and rewire every graph link that references it. */
    replaceNode(current: N, replacement: N): IGraphBuilder<N, L>;
    /** Replace one graph link at the same topology index. */
    replaceLink(current: L, replacement: L): IGraphBuilder<N, L>;

    build(): IGraph<N, L>;
}
