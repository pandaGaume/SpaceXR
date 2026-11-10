import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
    resolve: {
        alias: {
            "@spacexr/raster": fileURLToPath(new URL("../raster/src/index.ts", import.meta.url)),
            "@spacexr/tiles": fileURLToPath(new URL("../tiles/src/index.ts", import.meta.url)),
        },
    },
    test: {
        include: ["tests/**/*.test.ts"],
        environment: "node",
    },
});
