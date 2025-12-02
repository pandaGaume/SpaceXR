import { VertexData } from "@babylonjs/core";
import { IVerticesData, TerrainGridOptions, TerrainGridOptionsBuilder, TerrainNormalizedGridBuilder } from "core/geometry";
import { IsNumber } from "core/types";
import { IElevationGridFactory } from "./map.interfaces";
import { ISize2, IsSize } from "core/geometry";

export class ElevationGridFactory implements IElevationGridFactory {
    /*private static InitZ(column: number, row: number, w: number, h: number): number {
        let i = column == w - 1 ? 1 : 0;
        let j = row == h - 1 ? 2 : 0;
        return i + j;
    }*/

    public buildTopology(options: number | ISize2 | TerrainGridOptions | TerrainGridOptionsBuilder): IVerticesData {
        const o = this._buildTerrainOptions(options);
        const data = new TerrainNormalizedGridBuilder().withOptions(o).build<VertexData>(new VertexData());
        return data;
    }

    protected _buildTerrainOptions(options: number | ISize2 | TerrainGridOptions | TerrainGridOptionsBuilder): TerrainGridOptions {
        if (options instanceof TerrainGridOptions) {
            return options;
        }
        if (options instanceof TerrainGridOptionsBuilder) {
            return options.build();
        }
        const builder = new TerrainGridOptionsBuilder()
            .withScale(-1, 1) // we consider a grid oriented with babylonjs coordinate system, left handed
            .withInvertIndices(true);
        //.withZInitializer(ElevationGridFactory.InitZ); // register the z initializer, which serve as referencing the elevation depth

        if (IsSize(options)) {
            builder
                .withColumns(options.width + 1) // add one column to fill the gap
                .withRows(options.height + 1); // add one row to fill the gap - optional as by default the builder build a square if one of the dimension is missing. Added for clarity.
        }
        if (IsNumber(options)) {
            const s = options;
            builder
                .withColumns(s + 1) // add one column to fill the gap
                .withRows(s + 1); // add one row to fill the gap - optional as by default the builder build a square if one of the dimension is missing. Added for clarity.
        }
        return builder.build();
    }
}
