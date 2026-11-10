import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildPilot, configuration, type IPilotManifest, type PolarProduct } from "./pilot";
import { createPilotServer } from "./server";
import { initializeStorage, sha256, storagePath, withImportLock, writeJson } from "./storage";
import { inspectPolarSource } from "./trek";
import { buildGlobalMoon, verifyGlobalFiles } from "./global";
import { importGlobalSources } from "./global-sources";
import { createGlobalServer, loadGlobalManifest } from "./global-server";
import { importShackletonSources } from "./shackleton-source";
import { buildShackletonRefinement } from "./shackleton-refinement";

/** Small explicit command surface: imports and cloud publication are separate operations. */
async function main(): Promise<void> {
    const [command, ...args] = process.argv.slice(2);
    let root = process.env.LUNAR_DATA_ROOT ?? "F:/LunarData";
    let port = command === "global-serve" ? 8792 : 8791;
    let maxLOD = 6;
    let polarMaxLOD = 11;
    let workers = 8;
    let dem: PolarProduct = "trek";
    for (let i = 0; i < args.length; i += 2) {
        if (args[i] === "--root" && args[i + 1]) root = args[i + 1]!;
        else if (args[i] === "--port" && args[i + 1]) port = Number(args[i + 1]);
        else if (args[i] === "--max-lod" && args[i + 1]) maxLOD = Number(args[i + 1]);
        else if (args[i] === "--workers" && args[i + 1]) workers = Number(args[i + 1]);
        else if (args[i] === "--polar-max-lod" && args[i + 1]) polarMaxLOD = Number(args[i + 1]);
        else if (args[i] === "--dem" && (args[i + 1] === "pgda-site04" || args[i + 1] === "trek"))
            dem = args[i + 1] as PolarProduct;
        else
            throw new Error(
                "Expected --root DIRECTORY, --port PORT, --dem pgda-site04|trek, --max-lod LEVEL or --workers COUNT",
            );
    }
    root = resolve(root);
    if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Invalid port");
    if (command === "global-import") {
        await importGlobalSources(root);
    } else if (command === "shackleton-import") {
        await initializeStorage(root, 10 * 1024 ** 3);
        const imported = await withImportLock(root, () => importShackletonSources(root));
        console.log(JSON.stringify(imported, null, 2));
    } else if (command === "shackleton-refine") {
        const result = await buildShackletonRefinement(root, console.log, polarMaxLOD);
        console.log(JSON.stringify({ directory: result.directory, revision: result.manifest.revision, files: result.manifest.files.length }, null, 2));
    } else if (command === "global") {
        await buildGlobalMoon(root, maxLOD, workers);
    } else if (command === "global-verify") {
        const { directory, manifest } = await loadGlobalManifest(root);
        console.log({
            files: manifest.files.length,
            borders: await verifyGlobalFiles(root, directory, manifest.files, manifest.maxLOD),
        });
    } else if (command === "global-serve") {
        const server = createGlobalServer(root);
        await new Promise<void>((accept, reject) => {
            server.once("error", reject);
            server.listen(port, "127.0.0.1", accept);
        });
        console.log(`Global Moon: http://127.0.0.1:${port}/`);
        for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => server.close());
    } else if (command === "init") {
        const free = await initializeStorage(root);
        console.log(JSON.stringify({ root, freeBytes: free, configuration: await configuration(root) }, null, 2));
    } else if (command === "inspect") {
        await initializeStorage(root);
        const { metadata } = await inspectPolarSource(root);
        console.log(JSON.stringify(metadata, null, 2));
    } else if (command === "pilot") {
        await buildPilot(root, console.log, dem);
    } else if (command === "verify") {
        const latest = JSON.parse(await readFile(storagePath(root, "catalog/latest-pilot.json"), "utf8")) as {
            directory: string;
        };
        const manifest = JSON.parse(
            await readFile(storagePath(root, `${latest.directory}/pilot.json`), "utf8"),
        ) as IPilotManifest;
        for (const tile of manifest.tiles) {
            const bytes = await readFile(storagePath(root, `${latest.directory}/${tile.path}`));
            if (bytes.length !== tile.bytes || sha256(bytes) !== tile.sha256)
                throw new Error(`Corrupt tile: ${tile.path}`);
        }
        const report = {
            revision: manifest.revision,
            verifiedAt: new Date().toISOString(),
            files: manifest.tiles.length,
            bytes: manifest.tiles.reduce((n, t) => n + t.bytes, 0),
        };
        await writeJson(storagePath(root, `reports/${manifest.revision}.json`), report);
        console.log(JSON.stringify(report, null, 2));
    } else if (command === "serve") {
        const server = await createPilotServer(root);
        await new Promise<void>((accept, reject) => {
            server.once("error", reject);
            server.listen(port, "127.0.0.1", accept);
        });
        console.log(`Lunar pilot: http://127.0.0.1:${port}/`);
        for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => server.close());
    } else
        throw new Error(
            "Usage: npm run lunar -- init|inspect|pilot|verify|serve|global-import|global|global-verify|global-serve|shackleton-import|shackleton-refine [--root DIRECTORY] [--port PORT] [--dem pgda-site04|trek] [--max-lod LEVEL] [--polar-max-lod LEVEL] [--workers COUNT]",
        );
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
