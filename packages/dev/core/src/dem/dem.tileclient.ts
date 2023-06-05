import { Nullable } from "../types";
import { FetchResult, ITileAddress, ITileClient, ITileMetrics } from "../tiles/tiles.interfaces";
import { IDemInfos } from "./dem.interfaces";
import { DemInfos } from "./dem.infos";

export class DemTileWebClient implements ITileClient<IDemInfos> {
    _elevationsDataSource: ITileClient<Float32Array>;
    _normalsDataSource?: ITileClient<Float32Array>;

    public constructor(elevationSrc: ITileClient<Float32Array>, normalSrc?: ITileClient<Float32Array>) {
        this._elevationsDataSource = elevationSrc;
        this._normalsDataSource = normalSrc;
    }

    public get metrics(): ITileMetrics {
        return this._elevationsDataSource.metrics;
    }

    public async fetchAsync(request: ITileAddress, ...userArgs: unknown[]): Promise<FetchResult<Nullable<IDemInfos>>> {
        const requests: Array<Promise<FetchResult<Nullable<Float32Array>>>> = [];
        requests.push(this._elevationsDataSource.fetchAsync(request, ...userArgs));
        if (this._normalsDataSource) {
            requests.push(this._normalsDataSource.fetchAsync(request, ...userArgs));
        }

        const results = await Promise.allSettled(requests);

        let elevations: Nullable<Float32Array> = null;
        let normals: Nullable<Float32Array> = null;

        // elevations
        if (results[0].status == "fulfilled") {
            elevations = results[0].value.content;
        } else {
            throw new Error(results[0].reason);
        }

        if (elevations == null) {
            return new FetchResult<Nullable<IDemInfos>>(request, null, userArgs);
        }

        // normals
        if (results.length > 1) {
            if (results[1].status == "fulfilled") {
                normals = results[0].value.content;
            }
        }
        if (normals == null) {
            const s = this.metrics.tileSize;
            normals = this.computeNormals(elevations, s, s);
        }

        return new FetchResult(request, new DemInfos(elevations, normals), userArgs);
    }

    private computeNormals(positions: Float32Array, w: number, h: number): Float32Array {
        const normals: Float32Array = new Float32Array(w * h);
        const indices = [0, 3, 6, 15, 24, 21, 18, 9];
        let i = 0;
        for (let row = 0; row < w; row++) {
            for (let col = 0; col < h; col++) {
                let nx = 0;
                let ny = 0;
                let nz = 0;
                let nn = 0;
                const v = this.getNormalsWindows(positions, row, col, w, h);
                let k = indices[0];
                let a1 = v[k++];
                let a2 = v[k++];
                let a3 = v[k];
                for (let i = 1; i < indices.length; i++) {
                    k = indices[i];
                    const b1 = v[k++];
                    const b2 = v[k++];
                    const b3 = v[k];

                    if (a3 !== undefined && b3 !== undefined) {
                        const na = a2 * b3 - a3 * b2;
                        const nb = a3 * b1 - a1 * b3;
                        const nc = a1 * b2 - a2 * b1;
                        nx += na;
                        ny += nb;
                        nz += nc;
                        nn++;
                    }
                    a1 = b1;
                    a2 = b2;
                    a3 = b3;
                }
                const x = nx / nn;
                const y = ny / nn;
                const z = nz / nn;

                const l = Math.sqrt(x * x + y * y + z * z);
                normals[i++] = x / l;
                normals[i++] = y / l;
                normals[i++] = z / l;
            }
        }
        return normals;
    }

    private getNormalsWindows(positions: Float32Array, i: number, j: number, w: number, h: number): any[] {
        let index = (i * w + j) * 3;
        const xref = positions[index++];
        const yref = positions[index++];
        const zref = positions[index];

        const windows = new Array(27);
        const startRow = i - 1;
        const endRow = i + 1;
        const startCol = j - 1;
        const endCol = j + 1;
        let k = 0;
        for (let row = startRow; row <= endRow; row++) {
            const offset = row * w;
            for (let col = startCol; col <= endCol; col++) {
                index = (offset + col) * 3;
                let dx = col < 0 ? undefined : col >= w ? undefined : positions[index] - xref;
                let dy = row < 0 ? undefined : row >= h ? undefined : positions[index + 1] - yref;
                let dz = dx === undefined || dy === undefined ? undefined : positions[index + 2] - zref;
                windows[k++] = dx;
                windows[k++] = dy;
                windows[k++] = dz;
            }
        }
        return windows;
    }
}
