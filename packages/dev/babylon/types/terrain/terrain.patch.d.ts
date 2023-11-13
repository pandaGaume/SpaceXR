import { Mesh, Scene } from "@babylonjs/core";
import { TerrainGridOptions } from "core/meshes/terrain.grid";
export declare class PatchOption extends TerrainGridOptions {
}
export declare class Patch extends Mesh {
    constructor(name: string, options: PatchOption, scene?: Scene);
}
