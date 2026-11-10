/**
 * Materialize a Sim.Graph container's serialized interior into a live
 * RuntimeGraph topology, in place.
 *
 * A `SimGraphNode` (and any `RuntimeGraph`) embeds a sub-graph through
 * its own nodes / links arrays + dangling boundary-port channels. A
 * palette-dropped container ships its interior as a serialized v3
 * document on `subGraphJson` instead of being wired live; nothing runs
 * until that document is turned back into node instances + channels and
 * grafted onto the container. This module is that step, shared by the
 * editor session-builder and the headless loader so a saved container
 * plays identically in both.
 *
 * Document shape (a subset of the v3 `.spikypanda` model, plus an
 * explicit boundary-port section):
 *
 *   {
 *     version: 3,
 *     model: {
 *       nodes:       [{ id, typeId, data }],         // data restored via deserialize()
 *       connections: [{ from:{node,port}, to:{node,port} }]   // addressed by NAME
 *     },
 *     boundaryPorts: {
 *       inputs:  [{ node, slot }],   // -> builder.withInputPort(node, slot)
 *       outputs: [{ node, slot }]    // -> builder.withOutputPort(node, slot)
 *     }
 *   }
 *
 * Boundary ports use the slot NAME as the public port name, matching
 * the RuntimeGraph embedding contract (an input-port channel's slot is
 * what the parent's `toSlot` is matched against; an output-port
 * channel's slot is what the parent's outgoing `slot` pulls from). The
 * container's palette registration declares the SAME slot names so the
 * editor renders the ports before the interior is ever materialized.
 *
 * Connections and boundary ports are addressed by NAME (node id + slot),
 * never by positional index, so the document is robust to a node's port
 * set changing between save and load (the whole point of the container:
 * adding an output inside grows a port outside).
 *
 * A node instance that is itself a container (carries its own
 * `subGraphJson`) is materialized recursively, so nesting works to any
 * depth from a single top-level call.
 */
import { Channel } from "../execution/execution.channel";
import type { IChannel, IRuntimeNode } from "../execution/execution.interfaces";
import type { IOlink } from "../graph/graph.interfaces";
import { RuntimeGraph } from "../execution/execution.graph";
import { RuntimeGraphBuilder } from "../execution/execution.builder";

/** A model node in the serialized interior. `typeId` is absent for
 *  layout-only markers (lifecycle Start / Stop) that carry no runtime
 *  instance; those are skipped. */
interface SubGraphModelNode {
    id: string;
    typeId?: string;
    data?: Record<string, unknown>;
}

/** A name-addressed connection between two interior nodes. */
interface SubGraphModelConnection {
    typeId?: string;
    data?: unknown;
    from: { node: string; port: string | number };
    to: { node: string; port: string | number };
}

/** One boundary port: the interior (node, slot) it binds to. The slot
 *  name doubles as the public port name on the container. */
interface SubGraphBoundaryPort {
    node: string;
    slot: string | number;
}

interface SubGraphDocument {
    version?: number;
    model?: {
        nodes?: SubGraphModelNode[];
        connections?: SubGraphModelConnection[];
    };
    boundaryPorts?: {
        inputs?: SubGraphBoundaryPort[];
        outputs?: SubGraphBoundaryPort[];
    };
}

/** A node instance that can restore its @cloneable state from a blob. */
interface Deserializable {
    deserialize(blob: unknown): void;
}

/** Outcome of a materialization pass, for diagnostics + chained binding
 *  (the caller may want to reach the instances by their saved id). */
export interface SubGraphMaterializeResult {
    /** Every instantiated interior node, keyed by its saved id. */
    instances: Map<string, IRuntimeNode>;
    /** typeIds present in the document the factory could not resolve. */
    missingTypeIds: string[];
    /** Concrete link typeIds the optional link factory could not resolve. */
    missingLinkTypeIds: string[];
    /** Connection / boundary-port specs dropped because an endpoint is
     *  missing or not a runtime node. */
    skipped: string[];
}

function isRuntimeNode(x: unknown): x is IRuntimeNode {
    return !!x && typeof (x as IRuntimeNode).fire === "function";
}

function isDeserializable(x: unknown): x is Deserializable {
    return !!x && typeof (x as Deserializable).deserialize === "function";
}

/** Anything carrying a non-empty `subGraphJson` is a nested container we
 *  must materialize in turn. Duck-typed (not `instanceof SimGraphNode`)
 *  so a plugin subclass or a future container type is handled too. */
interface NestedContainerLike {
    subGraphJson: string;
    adoptTopologyFrom(other: RuntimeGraph): void;
}
function isNestedContainer(x: unknown): x is NestedContainerLike {
    const c = x as Partial<NestedContainerLike> | null;
    return !!c && typeof c.subGraphJson === "string" && c.subGraphJson.length > 0 && typeof c.adoptTopologyFrom === "function";
}

/**
 * Parse `json` and graft the resulting topology onto `host` in place.
 *
 * `createNode(typeId)` instantiates an interior node (the editor /
 * headless `NodeRegistry.create`); it returns null for an unknown
 * typeId, which is recorded in `missingTypeIds` and skips that node.
 *
 * Returns the instance map + diagnostics. On a malformed document the
 * host is left with an empty interior (no throw): a container that
 * cannot be parsed simply does nothing, matching the editor's tolerance
 * for transient invalid state during edits.
 */
export function materializeSubGraphInto(
    host: RuntimeGraph,
    json: string,
    createNode: (typeId: string) => IRuntimeNode | null,
    createLink?: (typeId: string) => IOlink | null
): SubGraphMaterializeResult {
    const result: SubGraphMaterializeResult = { instances: new Map(), missingTypeIds: [], missingLinkTypeIds: [], skipped: [] };

    let doc: SubGraphDocument;
    try {
        doc = JSON.parse(json) as SubGraphDocument;
    } catch {
        host.adoptTopologyFrom(new RuntimeGraphBuilder<IRuntimeNode, IChannel>().withMode("dynamic").build());
        return result;
    }

    const modelNodes = doc.model?.nodes ?? [];
    const modelConns = doc.model?.connections ?? [];

    // 1) Instantiate every interior node, restore its state, recurse into
    //    nested containers.
    for (const saved of modelNodes) {
        if (!saved.typeId) continue; // layout-only marker (Start / Stop)
        const instance = createNode(saved.typeId);
        if (!instance) {
            result.missingTypeIds.push(saved.typeId);
            continue;
        }
        if (saved.data !== undefined && isDeserializable(instance)) {
            instance.deserialize(saved.data);
        }
        if (isNestedContainer(instance)) {
            materializeSubGraphInto(instance as unknown as RuntimeGraph, instance.subGraphJson, createNode, createLink);
        }
        result.instances.set(saved.id, instance);
    }

    // 2) Collect the runtime nodes (every interior instance is one, but
    //    guard anyway) and seed the builder.
    const runtimeNodes: IRuntimeNode[] = [];
    for (const inst of result.instances.values()) {
        if (isRuntimeNode(inst)) runtimeNodes.push(inst);
    }
    const builder = new RuntimeGraphBuilder<IRuntimeNode, IChannel>().withMode("dynamic").withNodes(...runtimeNodes);

    // 3) Interior channels, addressed by name. A v4 document may carry a
    // concrete link type and serialized data. Older endpoint-only documents
    // keep the local generic Channel fallback.
    for (const conn of modelConns) {
        const from = result.instances.get(String(conn.from.node));
        const to = result.instances.get(String(conn.to.node));
        if (!isRuntimeNode(from) || !isRuntimeNode(to)) {
            result.skipped.push(`conn ${String(conn.from.node)}.${String(conn.from.port)} -> ${String(conn.to.node)}.${String(conn.to.port)}`);
            continue;
        }
        let link: IOlink | null = null;
        if (conn.typeId && createLink) {
            link = createLink(conn.typeId);
            if (!link) result.missingLinkTypeIds.push(conn.typeId);
        }
        link ??= new Channel();
        if (conn.data !== undefined && isDeserializable(link)) {
            link.deserialize(conn.data);
        }
        if (!isChannel(link)) {
            result.skipped.push(`link ${conn.typeId ?? "unknown"} is not an IChannel`);
            link.dispose();
            continue;
        }
        const mutable = link as IChannel & { slot: string | number; toSlot?: string | number };
        mutable.slot = conn.from.port;
        mutable.toSlot = conn.to.port;
        link.oini = from;
        link.ofin = to;
        builder.withLinks(mutable);
    }

    // 4) Boundary ports: dangling channels whose slot name is the public
    //    port. These are what make the container's inputPorts / outputPorts
    //    getters report named ports and what the parent's routing matches
    //    against (see RuntimeGraph._routeInputsFromParent / _routeOutputsToParent).
    for (const port of doc.boundaryPorts?.inputs ?? []) {
        const node = result.instances.get(String(port.node));
        if (!isRuntimeNode(node)) {
            result.skipped.push(`input-port ${String(port.node)}.${String(port.slot)}`);
            continue;
        }
        builder.withInputPort(node, port.slot);
    }
    for (const port of doc.boundaryPorts?.outputs ?? []) {
        const node = result.instances.get(String(port.node));
        if (!isRuntimeNode(node)) {
            result.skipped.push(`output-port ${String(port.node)}.${String(port.slot)}`);
            continue;
        }
        builder.withOutputPort(node, port.slot);
    }

    host.adoptTopologyFrom(builder.build());
    return result;
}

function isChannel(link: IOlink): link is IChannel {
    const candidate = link as Partial<IChannel>;
    return "slot" in candidate && "delayed" in candidate && "enabled" in candidate;
}
