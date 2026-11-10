import { Tile, type ITileAddress } from "@spacexr/tiles";

import { DemInfos, computeGridNormals, type IDecodeHeightGridOptions, type IDemDecoder } from "../codecs";
import type { IDemTileSource } from "./presets";

/** Options of {@link loadDemTile}. */
export interface ILoadDemTileOptions extends IDecodeHeightGridOptions {
    /** Computes surface normals from the heights. Defaults to `false`. */
    normals?: boolean;
    signal?: AbortSignal;
}

/**
 * Fetches and decodes one elevation tile.
 *
 * Use a `WorkerDemDecoder` in browsers so that image decoding runs off the rendering thread.
 *
 * Normals use the Web Mercator ground resolution at the tile centre latitude as the sample spacing; the projection
 * is conformal, so the spacing is the same along rows and columns.
 *
 * @returns The tile with its {@link DemInfos}, or `undefined` when the source reports the tile as absent.
 */
export async function loadDemTile(dem: IDemTileSource, address: ITileAddress, decoder: IDemDecoder, options: ILoadDemTileOptions = {}): Promise<Tile<DemInfos> | undefined> {
    const { source, encoding } = dem;
    const result = await source.fetchTile(address, options.signal);
    if (result.status === "absent") return undefined;

    const grid = await decoder.decodeDem(result.bytes, encoding, options);
    const tile = new Tile<DemInfos>(address, source.metrics, undefined, source.id);
    let normals: Float32Array | undefined;
    if (options.normals) {
        const centerLatitude = (tile.geoBounds.north + tile.geoBounds.south) / 2;
        const spacing = (source.metrics.groundResolution(centerLatitude, address.lod) * source.metrics.tileSize) / grid.width;
        normals = computeGridNormals(grid, spacing);
    }
    tile.content = new DemInfos(grid, normals);
    return tile;
}
