/**
 * Episodes (2026-09-29, the memory audit): what a task's trace says of its submissions, as one semantic unit a model and the
 * reflection can read, instead of a signal to be found again in a long trace. Made by a pure function of the manifest's
 * steps: the manifest stays the ground truth, an episode is its structured reading, the working memory a window of them.
 *
 *   episode      one task's attempts at the capabilities its topic's guard judges (`judges`): the first is the action, the
 *                others its retries, each with the arguments that matter (the topic's digest), its outcome and who
 *                decided it (the guard, the harness before it, the output limit, the capability itself), and the
 *                episode's final outcome;
 *   contrast     a field a rejected attempt was refused on, with what the attempt sent there and what the next accepted
 *                attempt sent there: X refused, Y accepted, read from the trace, never written by hand.
 *
 * No application, no topic in here: the fields are paths, the arguments whatever the topic's digest gives.
 */
import type { JsonValue } from "../contracts/graph.js";
import { problemsOfReason } from "./problems.js";

/** Who decided an attempt: accepted by the guard, refused by it, stopped by the harness before it, cut by the output limit, failed when run. */
export type AttemptOutcome = "ACCEPTED" | "GUARD_REJECTED" | "PRE_GUARD_REJECTED" | "TRUNCATED" | "CAPABILITY_FAILED";

/** A step of the manifest, as much of it as an episode reads. */
export interface IStepLike {
    n: number;
    capability: string | null;
    input: JsonValue;
    outcome: string;
    reason: string | null;
    judged?: "accepted" | "refused";
    truncated?: boolean;
}

/** The arguments of an attempt that matter, by field path: what the topic's digest makes of an input. */
export type ArgumentDigest = Record<string, JsonValue>;

export interface IEpisodeAttempt {
    step: number;
    capability: string;
    arguments: ArgumentDigest;
    outcome: AttemptOutcome;
    /** The reason when it was not accepted. */
    reason: string | null;
    /** The problems of a refusal, each with its kind and its field. */
    problems: Array<{ kind?: string; path?: string; says: string }>;
}

export interface IContrast {
    path: string;
    /** The kind of problem the field was refused for. */
    kind: string | null;
    rejected: { step: number; argument: JsonValue; says: string };
    /** What the next accepted attempt sent at that field; null when it did not send it again (the fix was elsewhere). */
    accepted: { step: number; argument: JsonValue } | null;
}

export interface IEpisode {
    id: string;
    taskId: string;
    topic: string;
    at: string | null;
    /** What the task was for, in short. */
    intent: string;
    /** The first attempt's capability. */
    action: string | null;
    attempts: IEpisodeAttempt[];
    /** ACCEPTED once an attempt is; NOT_ACCEPTED when none was; NO_ATTEMPT when the task never tried. */
    finalOutcome: "ACCEPTED" | "NOT_ACCEPTED" | "NO_ATTEMPT";
    /** How the task ended. */
    ended: string | null;
    contrasts: IContrast[];
}

export interface IEpisodeSource {
    taskId: string;
    topic: string;
    startedAt?: string | null;
    ended?: string | null;
    intent: string;
    steps: IStepLike[];
}

/** Who decided a step of a judged capability. */
export function outcomeOf(step: IStepLike): AttemptOutcome {
    // Past the guard, the capability itself may still fail when run.
    if (step.judged === "accepted") return step.outcome === "completed" ? "ACCEPTED" : "CAPABILITY_FAILED";
    if (step.judged === "refused") return "GUARD_REJECTED";
    if (step.truncated) return "TRUNCATED";
    if (step.outcome === "refused") return "PRE_GUARD_REJECTED";
    return step.outcome === "completed" ? "ACCEPTED" : "CAPABILITY_FAILED";
}

/** Without a digest: the input itself when small, its head otherwise. */
const wholeInput = (input: JsonValue): ArgumentDigest => {
    const text = JSON.stringify(input ?? null);
    return { input: text.length <= 2000 ? input : `${text.slice(0, 2000)}...` };
};

/**
 * One task's episode: its attempts at the capabilities the guard judges, in order, until the first accepted one; the
 * contrasts between each refused field and what the next accepted attempt sent there.
 */
export function episodeOf(source: IEpisodeSource, judges: ReadonlyArray<RegExp>, digest?: (capability: string, input: JsonValue) => ArgumentDigest): IEpisode {
    const attempts: IEpisodeAttempt[] = [];
    for (const s of source.steps) {
        if (!s.capability || !judges.some((r) => r.test(s.capability!))) continue;
        const outcome = outcomeOf(s);
        const problems = outcome === "ACCEPTED" ? [] : problemsOfReason(s.reason ?? "").map((p) => ({ ...(p.kind ? { kind: p.kind } : {}), ...(p.path ? { path: p.path } : {}), says: p.says.slice(0, 400) }));
        attempts.push({ step: s.n, capability: s.capability, arguments: digest ? digest(s.capability, s.input) : wholeInput(s.input), outcome, reason: outcome === "ACCEPTED" ? null : (s.reason ?? null), problems });
        if (outcome === "ACCEPTED") break;
    }
    const accepted = attempts.find((a) => a.outcome === "ACCEPTED") ?? null;
    const contrasts: IContrast[] = [];
    if (accepted)
        for (const a of attempts.filter((x) => x.outcome === "GUARD_REJECTED"))
            for (const p of a.problems.filter((x) => x.path))
                contrasts.push({
                    path: p.path!,
                    kind: p.kind ?? null,
                    rejected: { step: a.step, argument: a.arguments[p.path!] ?? null, says: p.says },
                    accepted: Object.hasOwn(accepted.arguments, p.path!) ? { step: accepted.step, argument: accepted.arguments[p.path!]! } : null,
                });
    return {
        id: `${source.taskId}#${source.topic}`,
        taskId: source.taskId,
        topic: source.topic,
        at: source.startedAt ?? null,
        intent: source.intent,
        action: attempts[0]?.capability ?? null,
        attempts,
        finalOutcome: accepted ? "ACCEPTED" : attempts.length ? "NOT_ACCEPTED" : "NO_ATTEMPT",
        ended: source.ended ?? null,
        contrasts,
    };
}

/** The first attempt the guard judged: the episode's first try (none judged: null). */
export function firstJudged(e: IEpisode): IEpisodeAttempt | null {
    return e.attempts.find((a) => a.outcome === "ACCEPTED" || a.outcome === "GUARD_REJECTED") ?? null;
}
