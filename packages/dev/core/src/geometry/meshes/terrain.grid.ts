import { IVerticesData, IVerticesDataBuilder } from "./meshes.interfaces";
import { FloatArray, Nullable } from "../../types";

type InitializerFn = (column: number, row: number, w: number, h: number, ...data: any[]) => number | number[];

export class TerrainGridOptions {
    public static DefaultGridSize = 32;
    public static DefaultInvertIndices = false;
    public static DefaultScale = 1;

    public static Shared = new TerrainGridOptions({
        columns: TerrainGridOptions.DefaultGridSize,
    });

    public uvs?: boolean;
    public normals?: boolean;
    public columns?: number;
    public rows?: number;
    public sx?: number;
    public sy?: number;
    public ox?: number;
    public oy?: number;
    public invertIndices?: boolean;
    public invertYZ?: boolean;
    public zInitializer?: InitializerFn;
    public uvInitializer?: InitializerFn;
    public edgeRefinement?: number;

    public constructor(p: Partial<TerrainGridOptions>) {
        Object.assign(this, p);
    }
    public clone(): TerrainGridOptions {
        return new TerrainGridOptions(this);
    }
}

export class TerrainGridOptionsBuilder {
    _uvs?: boolean;
    _normals?: boolean;
    _cols?: number;
    _rows?: number;
    _sx?: number;
    _sy?: number;
    _ox?: number;
    _oy?: number;
    _invertIndices?: boolean;
    _invertYZ?: boolean;
    _zInitializer?: InitializerFn;
    _uvInitializer?: InitializerFn;
    public edgeRefinement?: number;

    public withEdgeRefinement(v?: 1 | 2): TerrainGridOptionsBuilder {
        if (v !== undefined && v !== 1 && v !== 2) {
            throw new Error("edgeRefinement must be 1 or 2");
        }
        this.edgeRefinement = v;
        return this;
    }

    public withUvs(flag: boolean): TerrainGridOptionsBuilder {
        this._uvs = flag;
        return this;
    }
    public withNormals(flag: boolean): TerrainGridOptionsBuilder {
        this._normals = flag;
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

    public withZInitializer(zinit: InitializerFn): TerrainGridOptionsBuilder {
        this._zInitializer = zinit;
        return this;
    }

    public withUVInitializer(uvinit: InitializerFn): TerrainGridOptionsBuilder {
        this._uvInitializer = uvinit;
        return this;
    }

    public build() {
        return new TerrainGridOptions({
            uvs: this._uvs,
            normals: this._normals,
            columns: this._cols || this._rows,
            rows: this._rows || this._cols,
            sx: this._sx,
            sy: this._sy,
            invertIndices: this._invertIndices,
            invertYZ: this._invertYZ,
            zInitializer: this._zInitializer,
            uvInitializer: this._uvInitializer,
            edgeRefinement: this.edgeRefinement,
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

        const positions: number[] = [];
        const indices: number[] = [];
        const uvs: Nullable<FloatArray> = this._o?.uvs ? [] : null;
        const normals: Nullable<FloatArray> = this._o?.normals ? [] : null;

        const dx = 1 / (w - 1);
        const dy = 1 / (h - 1);
        const x0 = -0.5 + ox * dx;
        const y0 = 0.5 + oy * dy;

        const refineEdges = this._o?.edgeRefinement === 2;
        const isWEven = w % 2 === 0;

        const id = (row: number, col: number) => row * w + col;

        const evalZ = (col: number, row: number): number => (this._o?.zInitializer ? <number>this._o.zInitializer(col, row, w, h, ...params) : 0);

        const evalUV = (col: number, row: number): number[] => {
            if (this._o?.uvInitializer) {
                return <number[]>this._o.uvInitializer(col, row, w, h, ...params);
            }
            const u = col === w - 1 ? 1 : col * dx;
            const v = row === h - 1 ? 1 : row * dy;
            return [u, v];
        };

        const pushTri = (a: number, b: number, c: number) => {
            if (this._o?.invertIndices) indices.push(a, c, b);
            else indices.push(a, b, c);
        };

        const pushTri2 = (t1: [number, number, number], t2: [number, number, number]) => {
            pushTri(...t1);
            pushTri(...t2);
        };

        const pushTri3 = (t1: [number, number, number], t2: [number, number, number], t3: [number, number, number]) => {
            pushTri(...t1);
            pushTri(...t2);
            pushTri(...t3);
        };

        const pushTri4 = (t1: [number, number, number], t2: [number, number, number], t3: [number, number, number], t4: [number, number, number]) => {
            pushTri(...t1);
            pushTri(...t2);
            pushTri(...t3);
            pushTri(...t4);
        };

        const pushVertex = (x: number, y: number, z: number, col: number, row: number): number => {
            const index = positions.length / 3;

            if (this._o?.invertYZ) positions.push(x, z, y);
            else positions.push(x, y, z);

            if (uvs) {
                uvs.push(...evalUV(col, row));
            }

            if (normals) {
                if (this._o?.invertYZ) normals.push(0, 1, 0);
                else normals.push(0, 0, 1);
            }

            return index;
        };

        for (let row = 0; row < h; row++) {
            const v = row === h - 1 ? 1 : row * dy;
            const y = (y0 - v) * sy;

            for (let col = 0; col < w; col++) {
                const u = col === w - 1 ? 1 : col * dx;
                const x = (x0 + u) * sx;
                const z = evalZ(col, row);
                pushVertex(x, y, z, col, row);
            }
        }

        const topMid = refineEdges ? new Array<number>(w - 1) : null;
        const bottomMid = refineEdges ? new Array<number>(w - 1) : null;
        const leftMid = refineEdges ? new Array<number>(h - 1) : null;
        const rightMid = refineEdges ? new Array<number>(h - 1) : null;

        if (refineEdges) {
            for (let col = 0; col < w - 1; col++) {
                const u = (col + 0.5) * dx;
                const x = (x0 + u) * sx;

                topMid![col] = pushVertex(x, y0 * sy, 0.5 * (evalZ(col, 0) + evalZ(col + 1, 0)), col + 0.5, 0);

                bottomMid![col] = pushVertex(x, (y0 - 1) * sy, 0.5 * (evalZ(col, h - 1) + evalZ(col + 1, h - 1)), col + 0.5, h - 1);
            }

            for (let row = 0; row < h - 1; row++) {
                const v = (row + 0.5) * dy;
                const y = (y0 - v) * sy;

                leftMid![row] = pushVertex(x0 * sx, y, 0.5 * (evalZ(0, row) + evalZ(0, row + 1)), 0, row + 0.5);

                rightMid![row] = pushVertex((x0 + 1) * sx, y, 0.5 * (evalZ(w - 1, row) + evalZ(w - 1, row + 1)), w - 1, row + 0.5);
            }
        }

        for (let row = 0; row < h - 1; row++) {
            const indice = isWEven ? row % 2 : 0;

            for (let col = 0; col < w - 1; col++) {
                const tl = id(row, col);
                const tr = id(row, col + 1);
                const bl = id(row + 1, col);
                const br = id(row + 1, col + 1);

                const top = row === 0;
                const bottom = row === h - 2;
                const left = col === 0;
                const right = col === w - 2;
                const border = refineEdges && (top || bottom || left || right);

                if (!border) {
                    if (tl % 2 !== indice) {
                        pushTri2([tl, tr, bl], [bl, tr, br]);
                    } else {
                        pushTri2([tl, br, bl], [tl, tr, br]);
                    }
                    continue;
                }

                const tm = top ? topMid![col] : -1;
                const bm = bottom ? bottomMid![col] : -1;
                const lm = left ? leftMid![row] : -1;
                const rm = right ? rightMid![row] : -1;

                if (top && left) {
                    pushTri4([tl, tm, br], [tm, tr, br], [tl, br, bl], [tl, bl, lm]);
                } else if (top && right) {
                    pushTri4([tl, tm, bl], [tm, tr, rm], [tm, rm, bl], [bl, rm, br]);
                } else if (bottom && left) {
                    pushTri4([tl, tr, br], [tl, br, bm], [tl, bm, lm], [lm, bm, bl]);
                } else if (bottom && right) {
                    pushTri4([tl, tr, rm], [tl, rm, bm], [tl, bm, bl], [rm, br, bm]);
                } else if (top) {
                    pushTri3([tl, tm, bl], [tm, br, bl], [tm, tr, br]);
                } else if (bottom) {
                    pushTri3([tl, tr, bm], [tl, bm, bl], [tr, br, bm]);
                } else if (left) {
                    pushTri3([tl, tr, br], [tl, br, lm], [lm, br, bl]);
                } else if (right) {
                    pushTri3([tl, tr, rm], [tl, rm, bl], [bl, rm, br]);
                }
            }
        }

        data.indices = indices;
        data.positions = positions;
        data.uvs = uvs;
        data.normals = normals;

        return data;
    }

    public build0<T extends IVerticesData>(data?: T, ...params: any[]): T {
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
        const normals: Nullable<FloatArray> = this._o?.normals ? [] : null;

        const dx = 1 / (w - 1);
        const dy = 1 / (h - 1);

        const x0 = -0.5 + ox * dx;
        const y0 = 0.5 + oy * dy;

        // positions origin center of the grid with cartesian coordinate.
        // uvs origin upper left with v vertical and u horizontal.
        for (let row = 0; row < h; row++) {
            const v = row === h - 1 ? 1 : row * dy;
            const y = (y0 - v) * sy;
            for (let column = 0; column < w; column++) {
                const u = column === w - 1 ? 1 : column * dx;
                const x = (x0 + u) * sx;
                const z: number = this._o?.zInitializer ? <number>this._o.zInitializer(column, row, w, h, ...params) : 0;
                if (this._o?.invertYZ) positions.push(x, z, y);
                else positions.push(x, y, z);
                if (uvs) {
                    const uv: number[] = this._o?.uvInitializer ? <number[]>this._o.uvInitializer(column, row, w, h, ...params) : [u, v];
                    uvs.push(...uv);
                }
                if (normals) {
                    if (this._o?.invertYZ) normals.push(0, 1, 0);
                    else normals.push(0, 0, 1);
                }
            }
        }

        // indices
        const isWEven = w % 2 === 0;
        for (let row = 0; row < h - 1; row++) {
            const indice = isWEven ? row % 2 : 0;
            const offset = row * w;
            for (let col = 0; col < w - 1; col++) {
                const idx1 = offset + col;
                const idx2 = idx1 + w;
                const idx3 = idx2 + 1;
                const idx4 = idx1 + 1;
                if (idx1 % 2 !== indice) {
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
        data.normals = normals;

        return data;
    }
}
