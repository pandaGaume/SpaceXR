import { IVerticesData, IVerticesDataBuilder } from "./meshes.interfaces";
import { Nullable } from "../types";

export class TerrainGridOptions {
    public static DefaultGridSize = 256;
    public static DefaultInvertIndices = false;
    public static DefaultInvertYZ = false;
    public static DefaultScale = 1;

    public static Shared = new TerrainGridOptions({
        columns: TerrainGridOptions.DefaultGridSize,
        rows: TerrainGridOptions.DefaultGridSize,
        invertIndices: TerrainGridOptions.DefaultInvertIndices,
        invertYZ: TerrainGridOptions.DefaultInvertYZ,
        sx: TerrainGridOptions.DefaultScale,
        sy: TerrainGridOptions.DefaultScale,
    });

    public columns?: number;
    public rows?: number;
    public sx?: number;
    public sy?: number;
    public invertIndices?: boolean;
    public invertYZ?: boolean;

    public constructor(p: Partial<TerrainGridOptions>) {
        Object.assign(this, p);
    }
    public clone(): TerrainGridOptions {
        return new TerrainGridOptions(this);
    }
}

export class TerrainGridOptionsBuilder {
    _cols?: number;
    _rows?: number;
    _sx?: number;
    _sy?: number;
    _invertIndices?: boolean;
    _invertYZ?: boolean;

    public withColumns(v?: number): TerrainGridOptionsBuilder {
        this._cols = v;
        return this;
    }
    public withRows(v?: number): TerrainGridOptionsBuilder {
        this._rows = v;
        return this;
    }
    public withInvertIndices(v?: boolean): TerrainGridOptionsBuilder {
        this._invertIndices = v;
        return this;
    }
    public withInvertYZ(v?: boolean): TerrainGridOptionsBuilder {
        this._invertYZ = v;
        return this;
    }

    public withScale(x: number, y?: number): TerrainGridOptionsBuilder {
        this._sx = x;
        this._sy = y || x;
        return this;
    }
    public build() {
        return new TerrainGridOptions({
            columns: this._cols || this._rows,
            rows: this._rows || this._cols,
            sx: this._sx,
            sy: this._sy,
            invertIndices: this._invertIndices,
            invertYZ: this._invertYZ,
        });
    }
}

export class TerrainNormalizedGridBuilder implements IVerticesDataBuilder {
    private _o?: TerrainGridOptions;

    constructor(options: Nullable<TerrainGridOptions> = null) {
        this.withOptions(options);
    }

    public withOptions(options: Nullable<TerrainGridOptions>): TerrainNormalizedGridBuilder {
        // merge options and default.
        this._o = <TerrainGridOptions>{ ...TerrainGridOptions.Shared, ...options };
        return this;
    }

    public build<T extends IVerticesData>(data?: T): T {
        data = data || <T>{};
        const w = this._o?.columns || TerrainGridOptions.DefaultGridSize;
        const h = this._o?.rows || w;
        const sx = this._o?.sx || TerrainGridOptions.DefaultScale;
        const sy = this._o?.sy || TerrainGridOptions.DefaultScale;
        const positions = [];
        const indices = [];

        const x0 = -0.5;
        const y0 = 0.5;
        const dx = 1 / (w - 1);
        const dy = 1 / (h - 1);

        // positions and uvs. Note the uvs origin upper left.
        for (let row = 0; row < h; row++) {
            const v = row * dy;
            const y = (y0 - v) * sy;
            for (let column = 0; column < w; column++) {
                const u = column * dx;
                const x = (x0 + u) * sx;
                const z = 0;
                if (this._o?.invertYZ) {
                    positions.push(x, z, y);
                } else {
                    positions.push(x, y, z);
                }
            }
        }

        // indices
        const isWEven = w % 2 == 0;
        for (let row = 0; row < h - 1; row++) {
            const indice = isWEven ? row % 2 : 0;
            const offset = row * w;
            for (let col = 0; col < w - 1; col++) {
                const idx1 = offset + col;
                const idx2 = idx1 + w;
                const idx3 = idx2 + 1;
                const idx4 = idx1 + 1;
                if (idx1 % 2 != indice) {
                    if (this._o?.invertIndices) {
                        indices.push(idx1, idx4, idx2, idx2, idx4, idx3);
                    } else {
                        indices.push(idx1, idx2, idx4, idx2, idx3, idx4);
                    }
                } else {
                    if (this._o?.invertIndices) {
                        indices.push(idx1, idx3, idx2, idx3, idx1, idx4);
                    } else {
                        indices.push(idx1, idx2, idx3, idx3, idx4, idx1);
                    }
                }
            }
        }

        // populate the data
        data.indices = indices;
        data.positions = positions;

        return data;
    }
}
