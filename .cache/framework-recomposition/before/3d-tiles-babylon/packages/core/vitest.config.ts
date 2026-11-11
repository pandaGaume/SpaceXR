import { defineConfig } from "vitest/config";

export default defineConfig({
    resolve: {
        // The 3D Tiles packages are linked from 3d-tiles-core; keep their imports resolved from this workspace.
        preserveSymlinks: true,
    },
    test: {
        environment: "node",
        include: ["tests/**/*.test.ts"],
    },
});
