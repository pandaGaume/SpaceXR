import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
    resolve: {
        alias: {
            "@spacexr/3d-tiles-babylon": fileURLToPath(new URL("../../packages/core/src/index.ts", import.meta.url)),
        },
        preserveSymlinks: true,
    },
    test: {
        environment: "node",
        include: ["tests/**/*.test.ts"],
    },
});
