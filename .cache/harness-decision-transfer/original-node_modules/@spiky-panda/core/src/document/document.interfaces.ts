/**
 * A `.spikypanda` document as the runtime reads it (version 3: a model of
 * nodes with their type id and serialized data, and connections between
 * ports), and what instantiating it yields. These are runtime notions: the
 * node editor writes such documents, but a process with no editor reads and
 * runs them the same way (the factory's jobs, a twin behind a broker).
 */
import type { Channel } from "../execution/execution.channel";
import type { IRuntimeNode } from "../execution/execution.interfaces";
import type { Session } from "../execution/execution.session";
import type { RuntimeGraph } from "../execution/execution.graph";

export interface SavedModelNode {
    id: string;
    label?: string;
    typeId?: string;
    data?: Record<string, unknown>;
}

export interface SavedConnection {
    id: string;
    from: { node: string; port: string };
    to: { node: string; port: string };
}

export interface SavedGraph {
    version: number;
    model: { nodes: SavedModelNode[]; connections: SavedConnection[] };
}

export class DocumentError extends Error {
    public constructor(message: string) {
        super(message);
        this.name = "DocumentError";
    }
}

/** One value to set on an instantiated node: a public property (`pitch`) or a saved data key (`_pitch`). */
export interface IDocumentSetting {
    /** Saved node id in the document (`model.nodes[].id`). */
    readonly node: string;
    readonly property: string;
    readonly value: unknown;
}

export interface LoadedDocument {
    session: Session;
    graph: RuntimeGraph<IRuntimeNode, Channel>;
    /** Every instantiated node (runtime nodes AND GraphItems), by saved id. */
    instances: Map<string, unknown>;
    /** Saved node by id, for the data-key fallback of `applySetting`. */
    saved: Map<string, SavedModelNode>;
    /** typeIds present in the file that the registry could not resolve. */
    missingTypeIds: string[];
    /** Saved connections skipped because an endpoint is not a runtime node. */
    skippedConnections: string[];
    /** Whether a root Scene item bound the session's scene state view. */
    sceneBound: boolean;
}
