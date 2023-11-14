import { Mesh, Scene, VertexData } from "@babylonjs/core";
import { TerrainGridOptions, TerrainNormalizedGridBuilder } from "core/meshes/terrain.grid";

export class PatchOption extends TerrainGridOptions {}

export class Patch extends Mesh {
    public constructor(name: string, options: PatchOption, scene?: Scene) {
        super(name, scene);
        const builder = new TerrainNormalizedGridBuilder().withOptions(options);
        const grid = builder.build<VertexData>(new VertexData());
        grid.applyToMesh(this, true);
    }
}
