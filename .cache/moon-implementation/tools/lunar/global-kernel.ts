import { createHash } from "node:crypto";
import { CUBE_FACE_EDGES, CUBE_FACE_FRAMES, cubeTileNeighbor } from "@spacexr/tiles/cube";
import { assertValidTileAddress, TileNeighbor, type ITileAddress } from "@spacexr/tiles/addressing";
import { globalSourcePpd } from "./global-sources";

/** Decoded native PDS pixels. Longitude runs 0..360; values are signed half-metres. */
export interface ILolaPixels {
    width: number;
    height: number;
    values: Int16Array;
    north: number;
    south: number;
}
/** RGB atlas centred on longitude zero, as supplied by NASA SVS. */
export interface ILunarColourPixels {
    width: number;
    height: number;
    values: Uint8Array;
}
/** Small metadata entry for one generated file, including its ordered border fingerprints. */
export interface IGlobalFile {
    kind: "elevation" | "imagery";
    address: ITileAddress;
    path: string;
    bytes: number;
    sha256: string;
    /** N, E, S, W, each forward then reversed. Rows read left-to-right, columns top-to-bottom. */
    borders: string[];
    minHeight?: number;
    maxHeight?: number;
}

/** Pixel-centred bilinear LOLA height. Poles are a single position, not a longitude seam. */
export function sampleLolaMetres(raster: ILolaPixels, longitude: number, latitude: number): number {
    if (latitude >= 90) return raster.north;
    if (latitude <= -90) return raster.south;
    const lon = ((longitude % 360) + 360) % 360;
    const x = (lon / 360) * raster.width - 0.5;
    const y = Math.max(0, Math.min(raster.height - 1, ((90 - latitude) / 180) * raster.height - 0.5));
    const left = Math.floor(x),
        top = Math.floor(y),
        fx = x - left,
        fy = y - top;
    const x0 = (left + raster.width) % raster.width,
        x1 = (x0 + 1) % raster.width;
    const bottom = Math.min(top + 1, raster.height - 1),
        a = top * raster.width,
        b = bottom * raster.width;
    return (
        ((raster.values[a + x0]! * (1 - fx) + raster.values[a + x1]! * fx) * (1 - fy) +
            (raster.values[b + x0]! * (1 - fx) + raster.values[b + x1]! * fx) * fy) *
        0.5
    );
}

/** Write display RGB without treating it as terrain height data. */
function sampleColour(
    atlas: ILunarColourPixels,
    longitude: number,
    latitude: number,
    output: Uint8Array,
    offset: number,
): void {
    const x = ((longitude + 180) / 360) * atlas.width - 0.5;
    const y = Math.max(0, Math.min(atlas.height - 1, ((90 - latitude) / 180) * atlas.height - 0.5));
    const left = Math.floor(x),
        top = Math.floor(y),
        fx = x - left,
        fy = y - top;
    const x0 = ((left % atlas.width) + atlas.width) % atlas.width,
        x1 = (x0 + 1) % atlas.width;
    const a = top * atlas.width,
        b = Math.min(top + 1, atlas.height - 1) * atlas.width;
    for (let c = 0; c < 3; c++)
        output[offset + c] = Math.round(
            (atlas.values[(a + x0) * 3 + c]! * (1 - fx) + atlas.values[(a + x1) * 3 + c]! * fx) * (1 - fy) +
                (atlas.values[(b + x0) * 3 + c]! * (1 - fx) + atlas.values[(b + x1) * 3 + c]! * fx) * fy,
        );
}

/**
 * Generate the two vertex rasters using the shared cube face frames.
 * The equiangular plane is evaluated once per row/column. Angle formulas use
 * unnormalized directions; the target radial surface is evaluated without
 * assuming equal axes. Exact plane endpoints canonicalize shared face edges.
 */
export function globalTilePixels(
    address: ITileAddress,
    rasters: ReadonlyMap<number, ILolaPixels>,
    colours: ReadonlyMap<number, ILunarColourPixels>,
    radii: readonly [number, number, number],
    cells = 256,
): { heights: Float32Array; rgb: Uint8Array } {
    assertValidTileAddress(address);
    const face = address.face ?? 0,
        frame = CUBE_FACE_FRAMES[face]!;
    const raster = rasters.get(globalSourcePpd(address.lod)),
        colour = colours.get(Math.min(16384, 1024 * 2 ** address.lod));
    if (!raster || !colour) throw new Error("Missing native raster resolution");
    const side = cells + 1,
        heights = new Float32Array(side ** 2),
        rgb = new Uint8Array(side ** 2 * 3);
    const denominator = cells * 2 ** address.lod;
    const plane = (numerator: number): number =>
        numerator === 0
            ? -1
            : numerator === denominator
              ? 1
              : Math.tan((Math.PI / 4) * ((2 * numerator) / denominator - 1));
    const horizontal = Float64Array.from({ length: side }, (_, i) => plane(address.x * cells + i));
    const inverse = radii.map((radius) => 1 / (radius * radius));
    const equalAxes = radii[0] === radii[1] && radii[1] === radii[2];
    for (let row = 0; row < side; row++) {
        const v = plane(address.y * cells + row);
        for (let column = 0; column < side; column++) {
            const u = horizontal[column]!;
            // Preserve the library's global axes even when a face rotates a texture edge.
            const x = frame.center.x + frame.u.x * u + frame.v.x * v;
            const y = frame.center.y + frame.u.y * u + frame.v.y * v;
            const z = frame.center.z + frame.u.z * u + frame.v.z * v;
            const latitude = (Math.atan2(z, Math.hypot(x, y)) * 180) / Math.PI;
            const longitude = x === 0 && y === 0 ? 0 : (Math.atan2(y === 0 ? 0 : y, x === 0 ? 0 : x) * 180) / Math.PI;
            const referenceRadius = equalAxes
                ? radii[0]
                : Math.sqrt(
                      (x * x + y * y + z * z) / (x * x * inverse[0]! + y * y * inverse[1]! + z * z * inverse[2]!),
                  );
            const index = row * side + column;
            heights[index] = sampleLolaMetres(raster, longitude, latitude) + 1737400 - referenceRadius;
            if (!Number.isFinite(heights[index])) throw new Error("Global DEM contains an invalid height");
            sampleColour(colour, longitude, latitude, rgb, index * 3);
        }
    }
    return { heights, rgb };
}

/** Fingerprint exact numerical/display border bytes before their lossless container encoding. */
export function borderHashes(pixels: Uint8Array | Uint8ClampedArray, channels: number, side = 257): string[] {
    if (pixels.length !== side * side * channels) throw new Error("Invalid border raster length");
    const hashes: string[] = [];
    for (let edge = 0; edge < 4; edge++) {
        const forward = new Uint8Array(side * channels),
            reverse = new Uint8Array(side * channels);
        for (let i = 0; i < side; i++) {
            const x = edge === 1 ? side - 1 : edge === 3 ? 0 : i;
            const y = edge === 0 ? 0 : edge === 2 ? side - 1 : i;
            for (let c = 0; c < channels; c++) {
                const value = pixels[(y * side + x) * channels + c]!;
                forward[i * channels + c] = value;
                reverse[(side - 1 - i) * channels + c] = value;
            }
        }
        for (const bytes of [forward, reverse]) hashes.push(createHash("sha256").update(bytes).digest("base64url"));
    }
    return hashes;
}

/** Unique ordered tile key within one channel; it is independent of runtime cache keys. */
export function globalFileKey(kind: IGlobalFile["kind"], address: ITileAddress): string {
    return `${kind}/${address.face ?? 0}/${address.lod}/${address.x}/${address.y}`;
}

/** Verify every shared border, including turned/reversed face junctions, once per channel and level. */
export function verifyGlobalBorders(files: readonly IGlobalFile[]): number {
    const map = new Map(files.map((file) => [globalFileKey(file.kind, file.address), file]));
    if (map.size !== files.length) throw new Error("Duplicate generated tile");
    const edges = [TileNeighbor.N, TileNeighbor.E, TileNeighbor.S, TileNeighbor.W] as const;
    let checked = 0;
    for (const file of files)
        for (let edgeIndex = 0; edgeIndex < edges.length; edgeIndex++) {
            const edge = edges[edgeIndex]!,
                address = file.address,
                n = 2 ** address.lod;
            const neighbor = cubeTileNeighbor(address, edge)!;
            const neighborKey = globalFileKey(file.kind, neighbor.address),
                key = globalFileKey(file.kind, address);
            const other = map.get(neighborKey);
            if (!other) throw new Error(`Missing neighbor ${neighborKey}`);
            if (key >= neighborKey) continue;
            const boundary =
                edgeIndex === 0
                    ? address.y === 0
                    : edgeIndex === 1
                      ? address.x === n - 1
                      : edgeIndex === 2
                        ? address.y === n - 1
                        : address.x === 0;
            const junction = boundary ? CUBE_FACE_EDGES[address.face ?? 0]![edge] : undefined;
            const otherEdge = junction ? edges.indexOf(junction.edge) : (edgeIndex + 2) % 4;
            if (file.borders[edgeIndex * 2] !== other.borders[otherEdge * 2 + (junction?.reversed ? 1 : 0)])
                throw new Error(`Border mismatch: ${key} and ${neighborKey}`);
            checked++;
        }
    return checked;
}
