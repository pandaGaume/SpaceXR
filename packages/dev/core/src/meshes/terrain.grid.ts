import { IVerticesData, IVerticesDataBuilder } from "./meshes.interfaces";
import { Nullable } from "../types";

export class TerrainGridOptions {
    public static DefaultGridSize = 256;
    public static DefaultInvertIndices = false;
    public static DefaultInvertYZ = false;

    public static Shared = new TerrainGridOptions({
        width: TerrainGridOptions.DefaultGridSize,
        height: TerrainGridOptions.DefaultGridSize,
        invertIndices: TerrainGridOptions.DefaultInvertIndices,
        invertYZ: TerrainGridOptions.DefaultInvertYZ,
    });

    public width?: number;
    public height?: number;
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
    _width?: number;
    _height?: number;
    _invertIndices?: boolean;
    _invertYZ?: boolean;

    public withWidth(v?: number): TerrainGridOptionsBuilder {
        this._width = v;
        return this;
    }
    public withHeight(v?: number): TerrainGridOptionsBuilder {
        this._height = v;
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
    public build() {
        return new TerrainGridOptions({
            width: this._width || this._height,
            height: this._height || this._width,
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
        const w = this._o?.width || TerrainGridOptions.DefaultGridSize;
        const h = this._o?.height || w;
        const sx = 1;
        const sy = 1;
        const positions = [];
        const indices = [];

        const x0 = -0.5;
        const y0 = 0.5;
        const dx = 1 / (w - 1);
        const dy = 1 / (h - 1);

        // positions and uvs. Note the uvs origin upper left.
        for (let row = 0; row < h; row++) {
            const v = row * dy;
            const y = (y0 + v) * sy;
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
