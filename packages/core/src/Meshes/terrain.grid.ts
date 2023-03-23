import { IVerticesData, IVerticesDataBuilder } from "./meshes.interfaces";
import { Nullable } from "../types";

export class TerrainGridOptions {
    public static DefaultGridSize = 64;
    public static DefaultInvertIndices = false;
    public static DefaultGenerateUvs = false;
    public static Shared = new TerrainGridOptions();

    public width: number;
    public height?: number;
    public invertIndices: boolean;
    public generateUvs: boolean;

    public constructor(size: number = TerrainGridOptions.DefaultGridSize, height?: number) {
        this.width = size;
        this.height = height || size;
        this.invertIndices = TerrainGridOptions.DefaultInvertIndices;
        this.generateUvs = TerrainGridOptions.DefaultGenerateUvs;
    }
}

export class TerrainGridBuilder implements IVerticesDataBuilder {
    private _o?: TerrainGridOptions;

    constructor(options: Nullable<TerrainGridBuilder> = null) {
        this.withOptions(options);
    }

    public withOptions(options: Nullable<TerrainGridBuilder>): TerrainGridBuilder {
        // merge options and default.
        this._o = { ...TerrainGridOptions.Shared, ...options };
        return this;
    }

    public build(data: IVerticesData): IVerticesData {
        data = data || <IVerticesData>{};
        const w = this._o?.width || TerrainGridOptions.DefaultGridSize;
        const h = this._o?.height || w;
        const sx = 1;
        const sy = 1;
        const positions = [];
        const indices = [];
        const uvs = [];

        // we decided to center the grid.
        const x0 = -0.5;
        const y0 = 0.5;
        const dx = 1 / (w - 1);
        const dy = 1 / (h - 1);

        // positions and uvs. Note the uvs origin upper left.
        const generateUvs = this._o?.generateUvs || TerrainGridOptions.DefaultGenerateUvs;
        for (let row = 0; row < h; row++) {
            const v = row * dy;
            const y = (y0 - v) * sy;
            for (let column = 0; column < w; column++) {
                const u = column * dx;
                const x = (x0 + u) * sx;
                positions.push(x, y, 0);
                if (generateUvs) {
                    uvs.push(u, 1 - v);
                }
            }
        }

        // indices
        const showInterior = this._o?.invertIndices || TerrainGridOptions.DefaultInvertIndices;
        for (let row = 0; row < h - 1; row++) {
            for (let col = 0; col < w - 1; col++) {
                const idx1 = col + row * w;
                const idx2 = idx1 + w;
                const idx3 = idx2 + 1;
                const idx4 = idx1 + 1;
                if (showInterior) {
                    indices.push(idx1, idx3, idx2, idx4, idx3, idx1);
                } else {
                    indices.push(idx1, idx2, idx3, idx4, idx1, idx3);
                }
            }
        }

        // populate the data
        data.indices = indices;
        data.positions = positions;
        if (generateUvs) {
            data.uvs = uvs;
        }

        return data;
    }
}
