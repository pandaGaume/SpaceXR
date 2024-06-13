export function Assert(condition: any, message?: string): asserts condition {
    if (!condition) {
        throw new Error(message || "Assertion failed");
    }
}
