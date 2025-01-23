import { VertexData } from "@babylonjs/core";
import { IVerticesData, TerrainGridOptions, TerrainGridOptionsBuilder, TerrainNormalizedGridBuilder } from "core/meshes";
import { IsNumber } from "core/types";
import { IElevationGridFactory } from "./map.interfaces";

export class ElevationGridFactory implements IElevationGridFactory {
    public buildTopology(options: number | TerrainGridOptions | TerrainGridOptionsBuilder): IVerticesData {
        const o = this._buildTerrainOptions(options);
        const data = new TerrainNormalizedGridBuilder().withOptions(o).build<VertexData>(new VertexData());
        return data;
    }

    protected _buildTerrainOptions(options: number | TerrainGridOptions | TerrainGridOptionsBuilder): TerrainGridOptions {
        if (IsNumber(options)) {
            const s = options;
            return new TerrainGridOptionsBuilder()
                .withColumns(s + 1) // add one column to fill the gap
                .withRows(s + 1) // add one row to fill the gap - optional as by default the builder build a square if one of the dimension is missing. Added for clarity.
                .withScale(-1, 1) // we consider a grid oriented with babylonjs coordinate system, left handed
                .withInvertIndices(true)
                .withUvs(true) // generate uvs.
                .withNormals(true) // generate normals
                .build();
        }
        if (options instanceof TerrainGridOptionsBuilder) {
            return options.build();
        }
        return options;
    }
}
