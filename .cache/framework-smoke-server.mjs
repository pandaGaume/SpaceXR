import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const rendering = "C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-rendering";
const require = createRequire(`${rendering}/package.json`);
const { createServer } = await import(pathToFileURL(require.resolve("vite")).href);
const root = `${rendering}/examples/babylon-implicit-grid-mapzen`;
const server = await createServer({
    root,
    configFile: `${root}/vite.config.ts`,
    server: { host: "127.0.0.1", port: 5187, strictPort: true, open: false },
});
await server.listen();
console.log("Migration smoke server: http://127.0.0.1:5187, canonical rendering sources only.");
for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, async () => {
        await server.close();
        process.exit(0);
    });
}
