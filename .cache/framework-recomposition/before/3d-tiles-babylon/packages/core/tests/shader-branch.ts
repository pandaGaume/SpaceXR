/** Resolves the conditional directives used by the terrain shaders and rejects unsupported expressions. */
export function shaderBranch(source: string, defines: readonly string[]): string {
    const enabled = new Set(defines);
    const condition = (expression: string): boolean =>
        expression.split("||").some((alternative) =>
            alternative.split("&&").every((term) => {
                const match = /^\s*(!)?\s*defined\s*(?:\(\s*(\w+)\s*\)|\s+(\w+))\s*$/.exec(term);
                if (!match) throw new Error(`Unsupported shader condition: ${expression}`);
                const value = enabled.has(match[2] ?? match[3]!);
                return match[1] ? !value : value;
            }),
        );
    const kept: string[] = [];
    const stack: { parent: boolean; active: boolean; matched: boolean; fallback: boolean }[] = [];
    const active = (): boolean => stack.at(-1)?.active ?? true;
    for (const line of source.split("\n")) {
        const directive = /^\s*#(ifdef|ifndef|if|elif|else|endif)\b\s*(.*)$/.exec(line);
        if (!directive) {
            if (active()) kept.push(line);
            continue;
        }
        const [, command, argument] = directive;
        if (command === "ifdef" || command === "ifndef" || command === "if") {
            const matches = command === "if" ? condition(argument!) : enabled.has(argument!.trim()) === (command === "ifdef");
            stack.push({ parent: active(), active: active() && matches, matched: matches, fallback: false });
            continue;
        }
        const frame = stack.at(-1);
        if (!frame) throw new Error(`Unmatched shader directive: ${line}`);
        if (command === "endif") stack.pop();
        else if (command === "else") {
            if (frame.fallback) throw new Error("Repeated shader #else.");
            frame.active = frame.parent && !frame.matched;
            frame.matched = true;
            frame.fallback = true;
        } else {
            if (frame.fallback) throw new Error("Shader #elif after #else.");
            const matches = condition(argument!);
            frame.active = frame.parent && !frame.matched && matches;
            frame.matched ||= matches;
        }
    }
    if (stack.length > 0) throw new Error("Unclosed shader condition.");
    return kept.join("\n");
}
