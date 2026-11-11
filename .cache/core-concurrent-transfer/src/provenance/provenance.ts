/**
 * Provenance stamped on a GRADED output (a verdict, classification, severity
 * zone, RUL estimate, or alarm) so a downstream consumer (a reliability
 * engineer, an auditor, or an LLM) can trace WHAT produced the grade: which
 * standard / model / heuristic, which edition or version, which threshold table
 * drove the boundary. Plain JSON, carried on the output alongside the value.
 * Credibility for near-zero compute.
 *
 * The rule (see docs/architecture/provenance-convention.md): a bare number or
 * class label is not enough. Any node that grades, classifies, or crosses a
 * decision threshold attaches an `IProvenance` to its output. Heuristic grades
 * MUST say so (`kind: "heuristic"`) and MUST NOT be dressed up as probabilities.
 */
export interface IProvenance {
    /** The kind of authority behind the grade. */
    kind: "standard" | "model" | "heuristic";
    /** Identifier: a standard ("ISO 20816-3"), a model name, or a heuristic name. */
    source: string;
    /** Edition / version: a standard's year, a model's semver or weight hash, a config revision. */
    version?: string;
    /** Which threshold table / config drove this particular decision
     *  (e.g. "machine group 2, rigid support"). */
    basis?: string;
    /** Honest free-text caveat: supersession, "this is a heuristic, not a
     *  probability", known limits. This is where intellectual honesty lives. */
    note?: string;
}
