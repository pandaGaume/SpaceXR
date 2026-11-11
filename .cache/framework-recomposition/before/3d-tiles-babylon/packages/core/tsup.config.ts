import { defineConfig } from "tsup";

export default defineConfig({
    entry: { index: "src/index.ts" },
    format: ["esm"],
    target: "es2022",
    dts: true,
    sourcemap: true,
    clean: true,
    treeshake: true,
    external: [/^@babylonjs\//, "@spacexr/3d-tiles-core", "@spacexr/3d-tiles-runtime", "@spacexr/geodesy"],
});
