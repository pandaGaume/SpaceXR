import { VertexData } from "@babylonjs/core";
import { IVerticesData, TerrainGridOptions, TerrainGridOptionsBuilder, TerrainNormalizedGridBuilder } from "core/meshes";
import { IsNumber } from "core/types";

export class ElevationGridFactory {
    private static InitZ(column: number, row: number, w: number, h: number): number {
        let i = column == w - 1 ? 1 : 0;
        let j = row == h - 1 ? 2 : 0;
        return i + j;
    }

    private static InitUV(column: number, row: number, w: number, h: number): number[] {
        let u = column == w - 1 ? 0 : column / (w - 2);
        let v = row == h - 1 ? 0 : row / (h - 2);
        return [u, v];
    }

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
                .withZInitializer(ElevationGridFactory.InitZ) // register the z initializer, which serve as referencing the texture depth
                .withUvs(true) // generate uvs.
                .withUVInitializer(ElevationGridFactory.InitUV) // register the uv initializer, which serve as referencing the texture coordinate used in conjunction with depth
                .withNormals(true) // generate normals
                .build();
        }
        if (options instanceof TerrainGridOptionsBuilder) {
            return options.build();
        }
        return options;
    }
}
