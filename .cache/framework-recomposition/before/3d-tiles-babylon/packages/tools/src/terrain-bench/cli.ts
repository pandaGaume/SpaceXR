import { execSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { findBrowser, openPage, sleep, startBrowser } from "./browser";
import {
    formatComparison,
    formatReport,
    integrityFailures,
    type IBenchIntegrity,
    type IBenchPerformance,
    type IBenchReport,
    type IBenchResult,
} from "./report";
import { benchScenarios, type IBenchPath } from "./scenarios";

const USAGE = `Usage: terrain-bench [options]

Flies fixed camera paths in headless Chrome over the implicit grid example, which must be running.

  --url <address>      Address of the example. Defaults to http://localhost:5174
  --browser <path>     Chrome or Chromium. Defaults to the usual locations
  --only <pattern>     Scenarios whose id matches this regular expression
  --seconds <n>        Length of each path. Defaults to 8
  --label <text>       Name of what is measured. Defaults to the current commit
  --out <file>         Writes the report as JSON
  --compare <file>     Compares with a report written earlier
  --query <text>       More URL parameters of the example, such as demCache=2048
  --shots <folder>     Writes an image of each scenario, once at rest after its path
  --max-requests <n>   Requests a page may send to tile servers before they are blocked and the
                       path fails, which protects public servers. Defaults to 5000
`;

function option(name: string): string | undefined {
    const index = process.argv.indexOf(`--${name}`);
    return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<void> {
    if (process.argv.includes("--help")) {
        console.log(USAGE);
        return;
    }
    if (typeof WebSocket === "undefined") throw new Error("The bench needs Node.js 22 or later, for its WebSocket client.");
    const seconds = Number(option("seconds") ?? 8);
    const only = option("only");
    const probe = readFileSync(fileURLToPath(new URL("./page-probe.js", import.meta.url)), "utf8");
    const query = option("query");
    const shots = option("shots");
    const maxRequests = Number(option("max-requests") ?? 5000);
    const scenarios = benchScenarios(option("url") ?? "http://localhost:5174").filter(
        (scenario) => !only || new RegExp(only).test(scenario.id),
    );
    const label = option("label") ?? execSync("git rev-parse --short HEAD").toString().trim();
    const profile = mkdtempSync(join(tmpdir(), "terrain-bench-"));
    const { devtools, stop } = await startBrowser(findBrowser(option("browser")), 9400 + Math.floor(Math.random() * 400), profile);
    const results: IBenchResult[] = [];
    try {
        for (const scenario of scenarios) {
            const errors: string[] = [];
            const result: IBenchResult = { id: scenario.id, url: scenario.url, errors };
            const run = async <T>(pass: "performancePass" | "integrityPass"): Promise<T | undefined> => {
                const page = await openPage(devtools, `${scenario.url}${query ? `&${query}` : ""}`, probe, errors, maxRequests);
                try {
                    const engine = await page.evaluate<string | undefined>("window.__TERRAIN_BENCH__.engine()");
                    if (engine !== scenario.engine) {
                        result.skipped = `runs ${engine ?? "nothing"}`;
                        return undefined;
                    }
                    const path: IBenchPath = scenario.path;
                    const value = await page.evaluate<T>(`window.__TERRAIN_BENCH__.${pass}(${JSON.stringify(path)}, ${seconds})`);
                    if (pass === "integrityPass" && shots) {
                        mkdirSync(shots, { recursive: true });
                        await page.screenshot(join(shots, `${scenario.id.replace("/", "-")}.png`));
                    }
                    const urls = page.tileUrls();
                    return {
                        ...value,
                        tileRequests: page.tileRequests(),
                        distinctTileRequests: urls.length,
                        tileHosts: [...new Set(urls.map((address) => new URL(address).host))],
                        loadSeconds: page.loadSeconds,
                    };
                } finally {
                    await page.close();
                }
            };
            const performance = await run<IBenchPerformance>("performancePass");
            if (performance) result.performance = performance;
            if (!result.skipped) {
                const integrity = await run<IBenchIntegrity>("integrityPass");
                if (integrity) result.integrity = integrity;
            }
            results.push(result);
            console.error(
                `${scenario.id}: ${result.skipped ?? `${performance?.framesPerSecond} fps, ${result.integrity?.worstHoles} holes, ${result.integrity?.worstSharedEdgeMetres} m`}${errors.length ? `, ${errors.length} errors` : ""}`,
            );
        }
    } finally {
        stop();
        await sleep(300);
        rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }
    const report: IBenchReport = { label, date: new Date().toISOString(), seconds, results };
    const out = option("out");
    if (out) writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
    const compare = option("compare");
    console.log(compare ? formatComparison(JSON.parse(readFileSync(compare, "utf8")) as IBenchReport, report) : formatReport(report));
    const failures = integrityFailures(report);
    if (failures.length) console.log(`\nIntegrity:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
    for (const result of results) for (const error of result.errors.slice(0, 2)) console.log(`\n${result.id}: ${error}`);
}

main().then(
    () => process.exit(0),
    (error: unknown) => {
        console.error(error);
        process.exit(1);
    },
);
