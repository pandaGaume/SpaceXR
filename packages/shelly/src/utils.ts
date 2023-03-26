export class Utils {
    public static DEBUG = true;

    /**
     * Checks if the condition evaluates to true if DEBUG is true.
     * @param condition - The condition to check.
     * @param opt_message - Error message in case of failure.
     * @throws - Assertion failed, the condition evaluates to false.
     */
    public static Assert(condition: boolean, opt_message: string): void {
        if (Utils.DEBUG && !condition) {
            throw new Error("Assertion failed" + (opt_message ? ": " + opt_message : ""));
        }
    }

    public static Format(text: string, ...substitutions: any[]): string {
        if (substitutions) {
            let field: string, start: number;
            for (let i = 0; i < substitutions.length; i++) {
                field = "{" + i + "}";
                start = text.indexOf(field);
                if (start >= 0) {
                    do {
                        const part1: string = text.substring(0, start);
                        const part2: string = text.substring(start + field.length);
                        text = part1 + substitutions[i] + part2;
                        start = text.indexOf(field);
                    } while (start >= 0);
                }
            }
        }
        return text;
    }
}
