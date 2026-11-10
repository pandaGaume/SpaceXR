import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PngDataDecoder, type IRgbaImage } from "@spacexr/raster";

import { findBrowser, openPage, sleep, startBrowser, type Devtools } from "./browser";
import { compareImages, rendererCases, type IImageDifference, type IRendererCase } from "./pixels";
import { encodePng } from "./png";

const USAGE = `Usage: renderer-compare [options]

Draws each view of the implicit grid example at rest in headless Chrome, with WebGL from GLSL and with WebGPU from
WGSL, and compares the two images pixel by pixel. The example must be running.

Reports the pixels that differ and the largest difference of each channel. Fails when a page does not run its
graphics API, compiles another shader language, logs a WebGPU validation error, or does not come to rest.

  --url <address>      Address of the example. Defaults to http://localhost:5174
  --browser <path>     Chrome or Chromium. Defaults to the usual locations
  --only <pattern>     Cases whose id matches this regular expression
  --out <folder>       Writes the images of each case, and of their difference
  --query <text>       More URL parameters of the example
  --max-requests <n>   Requests a page may send to tile servers. Defaults to 5000
`;

function option(name: string): string | undefined {
    const index = process.argv.indexOf(`--${name}`);
    return index >= 0 ? process.argv[index + 1] : undefined;
}

/** A way of drawing a case: the graphics API, and the shader language its effects must compile. */
interface IRenderingMode {
    name: string;
    renderer: "webgl" | "webgpu";
    language: "GLSL" | "WGSL";
}

const WEBGL: IRenderingMode = { name: "webgl", renderer: "webgl", language: "GLSL" };
const WEBGPU: IRenderingMode = { name: "webgpu", renderer: "webgpu", language: "WGSL" };

/** Shader language Babylon.js gives each value of its `ShaderLanguage` enumeration. */
const LANGUAGES = ["GLSL", "WGSL"];

/** WebGPU in headless Chrome. */
const WEBGPU_FLAGS = ["--enable-unsafe-webgpu"];

/** Overlays of the example, hidden so that only the canvas is compared. */
const HIDE_OVERLAYS = `document.head.insertAdjacentHTML("beforeend", "<style>#runtime-panel, #attribution, #tile-labels { visibility: hidden !important; }</style>")`;

/** Consecutive identical images that tell the scene is at rest, one second apart. */
const STABLE_IMAGES = 3;

/** Language of the effect each drawn material compiled: on WebGPU, a material reports WGSL even when it compiles GLSL. */
const EFFECT_LANGUAGES = `(() => {
    const example = window.__SPACEXR_EXAMPLE__;
    const languages = {};
    for (const mesh of example.scene.meshes) {
        const material = mesh.material;
        if (!material || !mesh.isEnabled() || !mesh.isVisible) continue;
        for (const subMesh of mesh.subMeshes ?? []) {
            const effect = material.storeEffectOnSubMeshes ? subMesh.effect : material.getEffect();
            if (effect) languages[material.name] = effect.shaderLanguage;
        }
    }
    return { renderer: example.renderer, languages };
})()`;

interface IRendering {
    image: IRgbaImage;
    png: Buffer;
    errors: string[];
}

async function render(devtools: Devtools, url: string, mode: IRenderingMode, maxRequests: number): Promise<IRendering> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const page = await openPage(devtools, `${url}&renderer=${mode.renderer}`, undefined, errors, maxRequests, warnings);
    try {
        await page.evaluate(HIDE_OVERLAYS);
        let png = await page.capture();
        let stable = 1;
        for (let attempt = 0; stable < STABLE_IMAGES && attempt < 60; attempt++) {
            await sleep(1000);
            const next = await page.capture();
            stable = next.equals(png) ? stable + 1 : 1;
            png = next;
        }
        if (stable < STABLE_IMAGES) errors.push("The image did not come to rest.");
        const state = await page.evaluate<{ renderer: string; languages: Record<string, number> }>(EFFECT_LANGUAGES);
        if (state.renderer !== mode.renderer) errors.push(`Ran ${state.renderer} instead of ${mode.renderer}.`);
        if (Object.keys(state.languages).length === 0) errors.push("No material was drawn.");
        for (const [name, value] of Object.entries(state.languages))
            if (LANGUAGES[value] !== mode.language)
                errors.push(`${name} compiled ${LANGUAGES[value] ?? value} instead of ${mode.language}.`);
        // Babylon.js logs WebGPU validation errors as warnings.
        errors.push(...warnings.filter((warning) => /WebGPU|WGSL|shader/i.test(warning)));
        return { image: await new PngDataDecoder().decode(png), png, errors: errors.map((error) => `${mode.name}: ${error}`) };
    } finally {
        await page.close();
    }
}

interface ICaseResult {
    id: string;
    difference: IImageDifference;
    errors: string[];
}

async function compareCase(
    devtools: Devtools,
    scenario: IRendererCase,
    out: string | undefined,
    maxRequests: number,
): Promise<ICaseResult> {
    const webgl = await render(devtools, scenario.url, WEBGL, maxRequests);
    const webgpu = await render(devtools, scenario.url, WEBGPU, maxRequests);
    const difference = compareImages(webgl.image, webgpu.image);
    if (out) {
        const base = join(out, scenario.id.replace(/\//g, "-"));
        mkdirSync(out, { recursive: true });
        writeFileSync(`${base}-webgl.png`, webgl.png);
        writeFileSync(`${base}-webgpu.png`, webgpu.png);
        writeFileSync(`${base}-difference.png`, encodePng(difference.image));
    }
    return { id: scenario.id, difference, errors: [...webgl.errors, ...webgpu.errors] };
}

async function main(): Promise<boolean> {
    if (process.argv.includes("--help")) {
        console.log(USAGE);
        return true;
    }
    if (typeof WebSocket === "undefined") throw new Error("The comparison needs Node.js 22 or later, for its WebSocket client.");
    const only = option("only");
    const query = option("query");
    const out = option("out");
    const maxRequests = Number(option("max-requests") ?? 5000);
    const cases = rendererCases(option("url") ?? "http://localhost:5174")
        .filter((scenario) => !only || new RegExp(only).test(scenario.id))
        .map((scenario) => ({ ...scenario, url: query ? `${scenario.url}&${query}` : scenario.url }));
    const profile = mkdtempSync(join(tmpdir(), "renderer-compare-"));
    const { devtools, stop } = await startBrowser(
        findBrowser(option("browser")),
        9400 + Math.floor(Math.random() * 400),
        profile,
        WEBGPU_FLAGS,
    );
    const results: ICaseResult[] = [];
    try {
        for (const scenario of cases) {
            const result = await compareCase(devtools, scenario, out, maxRequests);
            results.push(result);
            const { differingPixels, pixels, maxDifference } = result.difference;
            const [r, g, b] = maxDifference;
            console.log(`${result.id}: ${differingPixels} of ${pixels} pixels differ, largest difference R ${r} G ${g} B ${b}`);
            for (const error of result.errors.slice(0, 3)) console.log(`  ${error}`);
        }
    } finally {
        stop();
        await sleep(300);
        rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }
    const failed = results.filter((result) => result.errors.length > 0);
    const identical = results.filter((result) => result.difference.differingPixels === 0).length;
    console.log(
        `\n${identical} of ${results.length} cases identical.` +
            (failed.length ? ` ${failed.length} failed: ${failed.map((result) => result.id).join(", ")}.` : ""),
    );
    return failed.length === 0;
}

main().then(
    (passed) => process.exit(passed ? 0 : 1),
    (error: unknown) => {
        console.error(error);
        process.exit(1);
    },
);
