import { watch } from "node:fs";

import { buildShaders } from "./build-shaders";

const USAGE = "Usage: cli <folder> [--check | --watch]";

function run(root: string, check: boolean): boolean {
    const report = buildShaders(root, { check });
    for (const file of report.changed) console.log(`${check ? "out of date" : "generated"}: ${file}`);
    for (const file of report.orphans) console.error(`no shader file: ${file}`);
    console.log(
        `${report.unchanged.length} up to date, ${report.changed.length} ${check ? "out of date" : "generated"}, ${report.orphans.length} orphans.`,
    );
    return report.orphans.length === 0 && (!check || report.changed.length === 0);
}

const flags = process.argv.slice(2).filter((argument) => argument.startsWith("--"));
const folders = process.argv.slice(2).filter((argument) => !argument.startsWith("--"));
const root = folders[0];
if (!root || folders.length > 1 || flags.some((flag) => flag !== "--check" && flag !== "--watch") || flags.length > 1) {
    console.error(USAGE);
    process.exit(2);
}

try {
    const ok = run(root, flags[0] === "--check");
    if (flags[0] === "--watch") {
        console.log(`Watching ${root}`);
        watch(root, { recursive: true }, (_event, file) => {
            if (!file || !/\.(glsl|wgsl)$/.test(file)) return;
            try {
                run(root, false);
            } catch (error) {
                console.error(error instanceof Error ? error.message : error);
            }
        });
    } else if (!ok) {
        process.exit(1);
    }
} catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
}
