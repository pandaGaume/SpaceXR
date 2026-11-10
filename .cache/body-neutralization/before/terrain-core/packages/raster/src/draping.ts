import type { IResidentTileCover, ITileAddress, ResidentTiles } from "@spacexr/tiles";

/**
 * Raster pages draped on a terrain tile divided into `2^depth x 2^depth` cells, row-major from the north-west cell.
 *
 * Each cell is a tile `depth` levels below the terrain tile and uses the deepest resident page containing it: its own
 * page, or the page of a coarser tile. The area of each cover locates the cell in its page: cell coordinates `(s, t)`
 * in `[0, 1]` sample the page at `(west + s * size, north + t * size)`. A cell without any resident page is
 * `undefined`.
 */
export type DrapeCells<T> = readonly (IResidentTileCover<T> | undefined)[];

/** Pages draped on the cells of a terrain tile; see {@link DrapeCells}. */
export function drapeCells<T>(pages: ResidentTiles<T>, terrainTile: ITileAddress, depth: number, minLOD = 0): DrapeCells<T> {
    if (!Number.isInteger(depth) || depth < 0) throw new RangeError("The drape depth must be a non-negative integer.");
    const count = 2 ** depth;
    const cells: (IResidentTileCover<T> | undefined)[] = [];
    for (let row = 0; row < count; row++) {
        for (let column = 0; column < count; column++) {
            cells.push(pages.cover({ lod: terrainTile.lod + depth, x: terrainTile.x * count + column, y: terrainTile.y * count + row }, minLOD));
        }
    }
    return cells;
}

/**
 * Depth at which a terrain tile is draped: how many levels below it the imagery cut reaches, at most `maxDepth`.
 *
 * The imagery cut is the set of imagery tiles its runtime presents, refined on texel size, so the depth follows the
 * camera distance: `0` for distant terrain tiles, whose imagery is as coarse as the terrain or coarser, more for near
 * tiles.
 */
export function drapeDepth(cut: ResidentTiles<unknown>, terrainTile: ITileAddress, maxDepth: number): number {
    return cut.depthWithin(terrainTile, maxDepth) ?? 0;
}

/** Whether a page change can alter the drape of a terrain tile: the page overlaps it at most `maxDepth` levels finer. */
export function pageAffectsDrape(page: ITileAddress, terrainTile: ITileAddress, maxDepth = 1): boolean {
    if (page.lod > terrainTile.lod + maxDepth) return false;
    const [coarse, fine] = page.lod <= terrainTile.lod ? [page, terrainTile] : [terrainTile, page];
    const scale = 2 ** (fine.lod - coarse.lod);
    return Math.floor(fine.x / scale) === coarse.x && Math.floor(fine.y / scale) === coarse.y;
}
