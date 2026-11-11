/**
 * The claims registry of a task (2026-10-10, docs/registre-des-affirmations.fr.md): every proposition the task holds about the world,
 * a number or a sentence, with where it comes from, its epistemic status and the history of its status.
 *
 *   OBSERVED      present in a source read: a tool's answer, the description, a measurement
 *   VERIFIED      confirmed by a source with authority: a fact of a signed document, or a measurement; set by code, never by a model
 *   INFERRED      produced by a model with no source that confirms it
 *   AMBIGUOUS     more than one reading
 *   CONTRADICTED  contradicted by a VERIFIED claim, or by a reviewer naming the fact that contradicts it
 *   UNKNOWN       not determined, said as such
 *
 * Two rules hold it together: an inference never becomes a fact because it is repeated (only code, on a source with authority, makes a
 * claim VERIFIED); a contradicted claim stays in the registry with its history and never goes back into a prompt (`current`).
 *
 * The registry is the task's, kept in its progress and written to its workshop at the end (`claims.json`). It holds only what the task
 * introduced or used, never a copy of the library.
 */
import type { JsonValue } from "../contracts/graph.js";

export type ClaimStatus = "OBSERVED" | "VERIFIED" | "INFERRED" | "AMBIGUOUS" | "CONTRADICTED" | "UNKNOWN";
export const CLAIM_STATUSES: ReadonlyArray<ClaimStatus> = ["OBSERVED", "VERIFIED", "INFERRED", "AMBIGUOUS", "CONTRADICTED", "UNKNOWN"];

/** Where a claim comes from. */
export interface IClaimSource {
    /** fact: a fact of the library; measurement: a sensor, the telemetry, who is on board; tool: a tool's answer; model: a model wrote it; person: a person said it. */
    kind: "fact" | "measurement" | "tool" | "model" | "person";
    /** The fact's id, the capability that answered, the role of the model: what can be followed. */
    ref: string;
    /** The document a fact is stated in. */
    document?: string;
    /** Whether that document is signed and unchanged since. */
    signed?: boolean;
    /** The step of the task the claim entered at. */
    step?: number;
}

export interface IClaimTransition {
    status: ClaimStatus;
    at: string;
    /** Why: the source that confirmed it, the fact that contradicts it, the reviewer's reason. */
    cause: string;
}

export interface IClaim {
    id: string;
    /** What it is about, in words (the flow between the Lab and Hab-B with the hatch closed). */
    subject: string;
    value?: number;
    unit?: string;
    /** A claim that is a sentence, not a number. */
    text?: string;
    status: ClaimStatus;
    source: IClaimSource;
    /** Who brought it in: the harness, a tool, a model's role (observer, procedure), a reviewer (supervisor), a person. */
    by: string;
    history: IClaimTransition[];
}

export type ClaimInput = Omit<IClaim, "id" | "history"> & { cause?: string };

/** The registry as the task's progress keeps it: a list, serialisable. */
export interface IClaimsState {
    claims: IClaim[];
}

export const newClaims = (): IClaimsState => ({ claims: [] });

/** What makes two claims the same: a fact by its id; otherwise the subject and the source's reference. */
const keyOf = (c: Pick<IClaim, "subject" | "source">): string => (c.source.kind === "fact" ? `fact:${c.source.ref}` : `${c.source.kind}:${c.source.ref}:${c.subject.trim().toLowerCase()}`);

/**
 * Adds a claim, or returns the one already held for the same thing. A held claim keeps its status, but VERIFIED is the only status a
 * repetition may bring: an inference said again stays an inference.
 */
export function addClaim(state: IClaimsState, input: ClaimInput, at: string = new Date().toISOString()): IClaim {
    const held = state.claims.find((c) => keyOf(c) === keyOf(input));
    const { cause, ...rest } = input;
    if (held) {
        if (input.status === "VERIFIED" && held.status !== "VERIFIED" && held.status !== "CONTRADICTED") transition(held, "VERIFIED", cause ?? `confirmed by ${input.source.kind} ${input.source.ref}`, at);
        return held;
    }
    const claim: IClaim = { id: `c${state.claims.length + 1}`, ...rest, history: [{ status: input.status, at, cause: cause ?? `entered from ${input.source.kind} ${input.source.ref}` }] };
    state.claims.push(claim);
    return claim;
}

/**
 * Changes a claim's status, the cause kept. Nothing leaves CONTRADICTED but a new claim (the correction is another claim, the history
 * says what replaced what), and no model makes a claim VERIFIED: `by` says who asks, and only "harness" may.
 */
export function transition(claim: IClaim, status: ClaimStatus, cause: string, at: string = new Date().toISOString(), by = "harness"): boolean {
    if (claim.status === status) return false;
    if (claim.status === "CONTRADICTED") return false;
    if (status === "VERIFIED" && by !== "harness") return false;
    claim.status = status;
    claim.history.push({ status, at, cause });
    return true;
}

/** The claims a prompt may hold as they stand: every one but the contradicted. */
export const current = (state: IClaimsState): IClaim[] => state.claims.filter((c) => c.status !== "CONTRADICTED");

/** A claim in one line, as a model reads it: the subject, the value or the text, the status, the source. */
export function claimLine(c: IClaim): string {
    const what = typeof c.value === "number" ? `${c.value}${c.unit ? ` ${c.unit}` : ""}` : (c.text ?? "");
    const from = c.source.kind === "fact" ? `fact ${c.source.ref}${c.source.document ? ` (${c.source.document}${c.source.signed ? ", signed" : ""})` : ""}` : `${c.source.kind} ${c.source.ref}`;
    return `${c.subject}: ${what} [${c.status}, ${from}]`;
}

/** A recorded justification (justify.ts) as the registry reads it. */
export interface IJustifiedNumber {
    constant: string;
    value: number;
    source: string;
    reference: string;
    reason: string;
    by: "model" | "harness";
}

/**
 * The numbers of an accepted artifact as claims, each by its justification: a safety constant the harness justified from a signed fact
 * is VERIFIED; a number the model justified by a document read, a measurement, a formula or a page is OBSERVED, its source named; one it
 * justified as an assumption is INFERRED.
 */
export function claimJustified(state: IClaimsState, numbers: IJustifiedNumber[], role: string, step?: number, unitOf: (constant: string) => string | undefined = () => undefined): void {
    for (const n of numbers) {
        const unit = unitOf(n.constant);
        const base = { subject: n.constant, value: n.value, ...(unit ? { unit } : {}), by: n.by === "harness" ? "harness" : role };
        const at = typeof step === "number" ? { step } : {};
        if (n.by === "harness") addClaim(state, { ...base, status: "VERIFIED", source: { kind: "fact", ref: n.reference, signed: true, ...at }, cause: `within ${n.reason}` });
        else if (n.source === "assumed") addClaim(state, { ...base, status: "INFERRED", source: { kind: "model", ref: role, ...at }, cause: `assumed: ${n.reference}; ${n.reason}` });
        else if (n.source === "library") addClaim(state, { ...base, subject: `${n.constant} (${n.reference})`, status: "OBSERVED", source: { kind: "tool", ref: `library ${n.reference}`, ...at }, cause: n.reason });
        else if (n.source === "measured") addClaim(state, { ...base, status: "OBSERVED", source: { kind: "measurement", ref: n.reference, ...at }, cause: n.reason });
        else addClaim(state, { ...base, status: "OBSERVED", source: { kind: "tool", ref: `${n.source} ${n.reference}`, ...at }, cause: n.reason });
    }
}

/** The registry as written to the workshop. */
export const claimsJson = (state: IClaimsState): JsonValue => ({ version: 1, claims: state.claims }) as unknown as JsonValue;
