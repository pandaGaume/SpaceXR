import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// Match the reference demo: linked packages and Babylon resolve from this app.
export default defineConfig({
  resolve: {
    preserveSymlinks: true,
    dedupe: ["@babylonjs/core"],
    alias: {
      "@spacexr/3d-tiles-babylon": fileURLToPath(
        new URL(
          "../3d-tiles-babylon/packages/core/src/index.ts",
          import.meta.url,
        ),
      ),
    },
  },
  optimizeDeps: {
    exclude: [
      "@spacexr/celestial-core",
      "@spacexr/3d-tiles-core",
      "@spacexr/3d-tiles-runtime",
      "@spacexr/tiles",
      "@spacexr/raster",
      "@spacexr/dem",
      "@spacexr/grid",
    ],
  },
  plugins: [
    {
      name: "no-store-dependencies",
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          if (request.url?.includes("/node_modules/.vite/")) {
            const setHeader = response.setHeader.bind(response);
            response.setHeader = (name, value) =>
              setHeader(
                name,
                name.toLowerCase() === "cache-control" ? "no-store" : value,
              );
          }
          next();
        });
      },
    },
  ],
  build: { outDir: "web-dist", chunkSizeWarningLimit: 1800 },
  server: { strictPort: true },
});
