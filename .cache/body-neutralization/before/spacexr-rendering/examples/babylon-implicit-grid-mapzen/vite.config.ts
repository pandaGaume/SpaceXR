import { fileURLToPath } from "node:url";

import { defineConfig, type Plugin } from "vite";

/**
 * Serves the dependencies Vite pre-bundles without browser caching. Vite marks them immutable for a year, but the dev
 * server starts with `--force` and rebuilds them every time: a browser keeping the chunks of an earlier session mixed
 * two builds of Babylon.js in one page, whose shader includes then went missing.
 */
function noStoreDependencies(): Plugin {
    return {
        name: "no-store-dependencies",
        configureServer(server) {
            server.middlewares.use((request, response, next) => {
                if (request.url?.includes("/node_modules/.vite/")) {
                    const setHeader = response.setHeader.bind(response);
                    response.setHeader = ((
                        name: string,
                        value: number | string | readonly string[],
                    ) =>
                        setHeader(
                            name,
                            name.toLowerCase() === "cache-control"
                                ? "no-store"
                                : value,
                        )) as typeof response.setHeader;
                }
                next();
            });
        },
    };
}

export default defineConfig({
    plugins: [noStoreDependencies()],
    resolve: {
        alias: {
            "@spacexr/3d-tiles-babylon": fileURLToPath(
                new URL("../../packages/core/src/index.ts", import.meta.url),
            ),
        },
        // The 3D Tiles packages are linked from 3d-tiles-core; keep their imports resolved from this workspace.
        preserveSymlinks: true,
    },
    server: {
        port: 5174,
        // Reload the packages linked from 3d-tiles-core when they are rebuilt.
        watch: { ignored: ["!**/node_modules/@spacexr/**"] },
        open: true,
    },
    esbuild: {
        target: "es2022",
        supported: {
            destructuring: true,
        },
    },
    optimizeDeps: {
        // Linked from 3d-tiles-core: served from their build so that rebuilding core needs no Vite cache reset.
        exclude: [
            "@spacexr/3d-tiles-core",
            "@spacexr/3d-tiles-runtime",
            "@spacexr/tiles",
            "@spacexr/raster",
            "@spacexr/dem",
            "@spacexr/grid",
        ],
        esbuildOptions: { target: "es2022" },
    },
    build: {
        target: "es2022",
        sourcemap: true,
    },
});
