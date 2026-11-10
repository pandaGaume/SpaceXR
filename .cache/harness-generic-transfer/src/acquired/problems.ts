/**
 * A refusal, as the next prompt says it, whatever refused (2026-09-28): the
 * reinjection had been written refusal kind by refusal kind (a constant with
 * no justification, a name that is no constant), and a kind it did not know
 * (a safety constant justified by a fact of another unit) looped nineteen
 * times with the same text. Here every refusal becomes problems, each with
 * the path it is about, what is expected there and what was sent, when the
 * guard knows them; a refusal that is only text is read into problems the
 * same way (a schema's `data/<path> must ...`, a guard's `<kind>: <path> ...`).
 * The runner keeps the streak of refusals on the same points, whatever the
 * input sent: the second says what is expected at each point and nothing
 * else, the third ends the task, naming them (`STUCK_AFTER`).
 */

export interface IProblem {
    /** What the guard says, whole. */
    says: string;
    /** The kind of problem, when the guard gives one (floor, justification, shape...). */
    kind?: string;
    /** The path of the proposal it is about (`steps.2.speedPercent`), when there is one. */
    path?: string;
    /** What is expected there, in words: a bound, a unit, a fact to cite, a type. */
    expected?: string;
    /** What was sent there. */
    got?: string;
    /** What must change with this point, nothing else (`rules.ts`, dependentsOf): its justification, the constants the rules compare it with. */
    dependentPaths?: string[];
}

/** What the next prompt says of the refusals of this task: the last one's problems, and how many refusals in a row were on the same points. */
export interface IRefusalStreak {
    capability: string;
    /** The points the refusals are on, as a key: the problems' paths (or their words when they have none). */
    key: string;
    times: number;
    problems: IProblem[];
}

/** A refusal on the same points this many times in a row ends the task (a read between two refusals does not break the streak). */
export const STUCK_AFTER = 3;

/** Splits a text on "; " outside quotes, brackets and parentheses: the guards join their problems that way. */
function split(text: string): string[] {
    const out: string[] = [];
    let depth = 0;
    let quote = false;
    let start = 0;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (c === '"') quote = !quote;
        else if (!quote && (c === "(" || c === "[" || c === "{")) depth++;
        else if (!quote && (c === ")" || c === "]" || c === "}")) depth = Math.max(0, depth - 1);
        else if (!quote && depth === 0 && c === ";" && text[i + 1] === " ") {
            out.push(text.slice(start, i));
            start = i + 2;
        }
    }
    out.push(text.slice(start));
    return out.map((s) => s.trim()).filter(Boolean);
}

const PATH = /^([A-Za-z_][\w]*(?:\.[\w*]+)+)\b/;

/** One problem read from a guard's words: its kind before a colon, its path at the start, a schema's path and expectation. */
export function problemOf(text: string): IProblem {
    const says = text.trim();
    // A schema's refusal: "data/abort/1/threshold must be number".
    const schema = /(?:^|\s)data\/([^\s]+) (must .*)$/.exec(says);
    if (schema) return { says, kind: "schema", path: schema[1]!.split("/").join("."), expected: schema[2]! };
    let rest = says;
    let kind: string | undefined;
    const k = /^([a-z][a-z-]*): (.*)$/s.exec(rest);
    if (k && !PATH.test(rest)) {
        kind = k[1];
        rest = k[2]!;
    }
    const path = PATH.exec(rest)?.[1];
    return { says, ...(kind ? { kind } : {}), ...(path ? { path } : {}) };
}

/** The problems of a refusal's text, one per problem the guard joined; a topic's own prefix ("procedure refused: ") left out. */
export function problemsOfReason(reason: string): IProblem[] {
    const body = reason.replace(/^[a-z ]+ refused: /i, "");
    return split(body).map(problemOf);
}

/** The points a refusal is on: its problems' paths, or their words without numbers when they have none; sorted, so the order says nothing. */
export function refusalKey(problems: IProblem[]): string {
    return [...new Set(problems.map((p) => p.path ?? `${p.kind ?? ""}:${p.says.replace(/[\d.]+/g, "#").slice(0, 120)}`))].sort().join("|");
}

/** The next streak after a refusal: one more when it is on the same points as the last, one otherwise. */
export function nextStreak(previous: IRefusalStreak | null, capability: string, problems: IProblem[]): IRefusalStreak {
    const key = refusalKey(problems);
    return { capability, key, problems, times: previous && previous.key === key ? previous.times + 1 : 1 };
}

/** What a refusal leaves in the progress, as the runner notes it; the fields of `Progress` it reads and writes. */
interface IRefusalProgress {
    pendingProblems?: IProblem[] | null;
    refusal?: IRefusalStreak | null;
}

/**
 * A refusal noted, whatever refused: the guard's own problems when it left them, its words read otherwise; the streak counted on
 * its points. What the runner does at every refusal, and what the conformance test does for every factory.
 */
export function noteRefusal(progress: IRefusalProgress, capability: string, reason: string): IRefusalStreak {
    const problems = progress.pendingProblems?.length ? progress.pendingProblems : problemsOfReason(reason);
    progress.pendingProblems = null;
    progress.refusal = nextStreak(progress.refusal ?? null, capability, problems);
    return progress.refusal;
}

const line = (p: IProblem): string => `${p.path ? `${p.path}: ` : ""}${p.says}${p.expected ? ` (expected: ${p.expected})` : ""}${p.got ? ` (sent: ${p.got})` : ""}`;

/**
 * The note the brief opens on after a refusal, whatever refused: the first time, each problem with what is expected; the
 * second time on the same points, only the points and what is expected at each, said differently, since the same text
 * read again changed nothing.
 */
export function refusalNote(streak: IRefusalStreak | null | undefined): string {
    if (!streak || !streak.problems.length) return "";
    const shown = streak.problems.slice(0, 10);
    const more = streak.problems.length > shown.length ? ` And ${streak.problems.length - shown.length} more.` : "";
    if (streak.times < 2) return `Your last ${streak.capability} was refused, on ${streak.problems.length} point(s): ${shown.map((p, i) => `(${i + 1}) ${line(p)}`).join(" ")}${more} Change what each point names. `;
    const points = [...new Set(shown.map((p) => p.path ?? p.kind ?? "the proposal"))];
    const expected = shown.map((p) => `${p.path ?? p.kind ?? "the proposal"} needs ${p.expected ?? p.says}`).join("; ");
    return `Refused ${streak.times} times in a row on the same point(s), ${points.join(", ")}, whatever else changed: what you changed was not what is refused. At each of these points, and nothing else, give what is expected: ${expected}. One more refusal on these points ends the task. `;
}
