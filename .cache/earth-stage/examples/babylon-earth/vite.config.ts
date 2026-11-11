import {defineConfig} from "vite";
import {fileURLToPath} from "node:url";
export default defineConfig({resolve:{preserveSymlinks:true,dedupe:["@babylonjs/core","@spacexr/geodesy"],alias:{
"@spacexr/babylon-earth":fileURLToPath(new URL("../../packages/babylon-earth/src/index.ts",import.meta.url)),
"@spacexr/3d-tiles-babylon":fileURLToPath(new URL("../../packages/core/src/index.ts",import.meta.url))}},
server:{port:5180,host:"127.0.0.1",open:false,fs:{allow:[fileURLToPath(new URL("../../..",import.meta.url))]}},
optimizeDeps:{exclude:["@spacexr/babylon-earth","@spacexr/3d-tiles-babylon","@spacexr/3d-tiles-runtime","@spacexr/atmosphere","@spacexr/celestial-core"]},
build:{target:"es2022",sourcemap:true}});
