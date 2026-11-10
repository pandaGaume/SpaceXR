/**
 * Node signatures: what a node type can do, said for a planner rather than
 * for a person. A signature names the purpose, the ports with the quantity
 * and unit they carry, capability tags, and a cost that only a bench may
 * write. It is declared by the plugin next to the ports (`INodeMeta.signature`)
 * and validated against them: a signature port must exist among the meta's
 * ports, and where a port already declares a unit expectation, the
 * signature must agree. Units are never retyped: the bench, the twin runs
 * and the documentation are the sources; a contradiction is a failure.
 *
 * `searchSignatures` is the planner's question: "which node types produce
 * these outputs, with these capabilities?" It ranks exact output matches
 * (quantity and unit) first, then capability overlap, then measured cost.
 * The studio's MCP server and a broker slot serve the same answer from it.
 */
import type { INodeMeta } from "./graph.registry";
import type { IPortDescriptor } from "../execution/execution.interfaces";

export interface ISignaturePort {
    /** The quantity kind, as `IUnitExpectation.quantity` names it: "Power", "Dimensionless", "Concentration", ... */
    readonly quantity: string;
    /** The unit key within that quantity, as the units map names it ("watt", "ppm", "percent"); absent when any unit of the quantity will do. */
    readonly unit?: string;
    readonly description?: string;
}

/** Written by a bench or a certified run, never by hand: it says who measured, when, and on what. */
export interface ISignatureCost {
    readonly latencyUs?: number;
    readonly memoryKb?: number;
    readonly measuredBy: string;
    readonly at: string;
    readonly sha256: string;
}

export interface INodeSignature {
    /** One sentence, for the model that plans. */
    readonly purpose: string;
    /** By input port name. */
    readonly inputs: Readonly<Record<string, ISignaturePort>>;
    /** By output port name. */
    readonly outputs: Readonly<Record<string, ISignaturePort>>;
    /** Tags a planner can ask for: "prediction", "air_quality", "exchange", "identification", ... */
    readonly capabilities: ReadonlyArray<string>;
    readonly cost?: ISignatureCost;
}

export interface ISignatureProblem {
    readonly type: string;
    readonly where: string;
    readonly what: string;
}

const portNames = (ports: ReadonlyArray<IPortDescriptor> | undefined): Map<string, IPortDescriptor> => new Map((ports ?? []).map((p) => [String(p.slot), p]));

/**
 * The problems of one meta's signature: a port the meta does not have, a
 * unit expectation the port already declares and the signature contradicts,
 * an empty purpose, no capability. An absent signature is not a problem.
 */
export function validateSignature(meta: INodeMeta): ISignatureProblem[] {
    const s = meta.signature;
    if (!s) return [];
    const problems: ISignatureProblem[] = [];
    const type = meta.type;
    if (!s.purpose || !s.purpose.trim()) problems.push({ type, where: "purpose", what: "empty" });
    if (!s.capabilities?.length) problems.push({ type, where: "capabilities", what: "none" });
    const check = (side: "inputs" | "outputs", declared: Readonly<Record<string, ISignaturePort>>, ports: Map<string, IPortDescriptor>) => {
        for (const [name, sp] of Object.entries(declared)) {
            const port = ports.get(name);
            if (!port) {
                problems.push({ type, where: `${side}.${name}`, what: `no such port (ports: ${[...ports.keys()].join(", ") || "none"})` });
                continue;
            }
            if (!sp.quantity) problems.push({ type, where: `${side}.${name}`, what: "no quantity" });
            const expected = port.unit;
            if (expected) {
                if (expected.quantity !== sp.quantity) problems.push({ type, where: `${side}.${name}`, what: `the port expects quantity ${expected.quantity}, the signature says ${sp.quantity}` });
                if (expected.unit && sp.unit && expected.unit !== sp.unit) problems.push({ type, where: `${side}.${name}`, what: `the port expects unit ${expected.unit}, the signature says ${sp.unit}` });
            }
        }
    };
    check("inputs", s.inputs ?? {}, portNames([...(meta.inputPorts ?? []), ...(meta.controlInputPorts ?? [])]));
    check("outputs", s.outputs ?? {}, portNames([...(meta.outputPorts ?? []), ...(meta.controlOutputPorts ?? [])]));
    return problems;
}

export interface ISignatureQuery {
    /** What the plan must produce; a type matches when one of its outputs carries the quantity (and the unit, when given). */
    readonly requiredOutputs?: ReadonlyArray<{ readonly quantity: string; readonly unit?: string }>;
    /** Tags the type should carry; each one carried adds to the score. */
    readonly capabilities?: ReadonlyArray<string>;
    /** Free words looked for in the purpose. */
    readonly text?: string;
    readonly limit?: number;
}

export interface ISignatureMatch {
    readonly type: string;
    readonly label: string;
    readonly signature: INodeSignature;
    readonly score: number;
    /** Which required outputs this type produces, by port name. */
    readonly produces: ReadonlyArray<{ readonly port: string; readonly quantity: string; readonly unit?: string }>;
}

const EXACT_OUTPUT = 100;
const QUANTITY_ONLY = 40;
const CAPABILITY = 10;
const WORD = 2;

/**
 * The node types whose signature answers the query, best first. Without any
 * criterion, every signed type, in registration order. Ties are broken by
 * measured latency (a type with none sorts after one that has some, so a
 * bench-measured type is preferred when the planner cannot otherwise tell).
 */
export function searchSignatures(metas: Iterable<INodeMeta>, query: ISignatureQuery = {}): ISignatureMatch[] {
    const words = (query.text ?? "").toLowerCase().split(/\W+/).filter((w) => w.length > 2);
    const wanted = new Set((query.capabilities ?? []).map((c) => c.toLowerCase()));
    const matches: ISignatureMatch[] = [];
    for (const meta of metas) {
        const s = meta.signature;
        if (!s) continue;
        let score = 0;
        const produces: Array<{ port: string; quantity: string; unit?: string }> = [];
        for (const req of query.requiredOutputs ?? []) {
            let best = 0;
            for (const [port, out] of Object.entries(s.outputs ?? {})) {
                if (out.quantity !== req.quantity) continue;
                const exact = !req.unit || !out.unit || out.unit === req.unit;
                const value = exact ? EXACT_OUTPUT : QUANTITY_ONLY;
                if (value > best) best = value;
                if (exact) produces.push({ port, quantity: out.quantity, unit: out.unit });
            }
            score += best;
        }
        for (const c of s.capabilities ?? []) if (wanted.has(c.toLowerCase())) score += CAPABILITY;
        const purpose = s.purpose.toLowerCase();
        for (const w of words) if (purpose.includes(w)) score += WORD;
        const asked = (query.requiredOutputs?.length ?? 0) + wanted.size + words.length;
        if (asked > 0 && score === 0) continue;
        matches.push({ type: meta.type, label: meta.label, signature: s, score, produces });
    }
    matches.sort((a, b) => b.score - a.score || (a.signature.cost?.latencyUs ?? Number.POSITIVE_INFINITY) - (b.signature.cost?.latencyUs ?? Number.POSITIVE_INFINITY) || a.type.localeCompare(b.type));
    return matches.slice(0, query.limit ?? 10);
}
