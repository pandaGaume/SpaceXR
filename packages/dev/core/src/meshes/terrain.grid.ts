import { IVerticesData, IVerticesDataBuilder } from "./meshes.interfaces";
import { FloatArray, Nullable } from "../types";

type VInitializerFn = (column: number, row: number, w: number, h: number, ...data: any[]) => number | number[];

export class TerrainGridOptions {
    public static DefaultGridSize = 256;
    public static DefaultInvertIndices = false;
    public static DefaultScale = 1;

    public static Shared = new TerrainGridOptions({
        columns: TerrainGridOptions.DefaultGridSize,
    });

    public uvs?: boolean;
    public columns?: number;
    public rows?: number;
    public sx?: number;
    public sy?: number;
    public ox?: number;
    public oy?: number;
    public invertIndices?: boolean;
    public zInitializer?: VInitializerFn;
    public uvInitializer?: VInitializerFn;

    public constructor(p: Partial<TerrainGridOptions>) {
        Object.assign(this, p);
    }
    public clone(): TerrainGridOptions {
        return new TerrainGridOptions(this);
    }
}

export class TerrainGridOptionsBuilder {
    _uvs?: boolean;
    _cols?: number;
    _rows?: number;
    _sx?: number;
    _sy?: number;
    _ox?: number;
    _oy?: number;
    _invertIndices?: boolean;
    _invertYZ?: boolean;
    _zInitializer?: VInitializerFn;
    _uvInitializer?: VInitializerFn;

    public withUvs(flag: boolean): TerrainGridOptionsBuilder {
        this._uvs = flag;
        return this;
    }
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

    public withOffset(x: number, y?: number): TerrainGridOptionsBuilder {
        this._ox = x;
        this._oy = y || x;
        return this;
    }

    public withZInitializer(zinit: VInitializerFn): TerrainGridOptionsBuilder {
        this._zInitializer = zinit;
        return this;
    }

    public withUVInitializer(uvinit: VInitializerFn): TerrainGridOptionsBuilder {
        this._uvInitializer = uvinit;
        return this;
    }

    public build() {
        return new TerrainGridOptions({
            uvs: this._uvs,
            columns: this._cols || this._rows,
            rows: this._rows || this._cols,
            sx: this._sx,
            sy: this._sy,
            invertIndices: this._invertIndices,
            zInitializer: this._zInitializer,
            uvInitializer: this._uvInitializer,
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

    public build<T extends IVerticesData>(data?: T, ...params: any[]): T {
        data = data || <T>{};
        const w = this._o?.columns || TerrainGridOptions.DefaultGridSize;
        const h = this._o?.rows || w;
        const sx = this._o?.sx || TerrainGridOptions.DefaultScale;
        const sy = this._o?.sy || TerrainGridOptions.DefaultScale;
        const ox = this._o?.ox || 0;
        const oy = this._o?.oy || 0;
        const positions = [];
        const indices = [];
        const uvs: Nullable<FloatArray> = this._o?.uvs ? [] : null;

        const dx = 1 / (w - 1);
        const dy = 1 / (h - 1);

        const x0 = -0.5 + ox * dx;
        const y0 = 0.5 + oy * dy;

        // positions  origin upper left.
        for (let row = 0; row < h; row++) {
            const v = row * dy;
            const y = (y0 - v) * sy;
            for (let column = 0; column < w; column++) {
                const u = column * dx;
                const x = (x0 + u) * sx;
                const z: number = this._o?.zInitializer ? <number>this._o.zInitializer(column, row, w, h, ...params) : 0;
                positions.push(x, y, z);
                if (uvs) {
                    const uv: number[] = this._o?.uvInitializer ? <number[]>this._o.uvInitializer(column, row, w, h, ...params) : [u, v];
                    uvs.push(...uv);
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
                        indices.push(idx1, idx2, idx4, idx2, idx3, idx4);
                    } else {
                        indices.push(idx1, idx4, idx2, idx2, idx4, idx3);
                    }
                } else {
                    if (this._o?.invertIndices) {
                        indices.push(idx1, idx2, idx3, idx3, idx4, idx1);
                    } else {
                        indices.push(idx1, idx3, idx2, idx3, idx1, idx4);
                    }
                }
            }
        }

        // populate the data
        data.indices = indices;
        data.positions = positions;
        data.uvs = uvs;

        return data;
    }
}
