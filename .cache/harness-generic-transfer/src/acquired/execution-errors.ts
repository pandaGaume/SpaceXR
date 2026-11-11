/** A rejected execution permit, not a failed business action or a model decision. */
export class DecisionInvalidatedError extends Error {
    constructor() {
        super("Stale decision: observed world changed before execution");
        this.name = "DecisionInvalidatedError";
    }
}
