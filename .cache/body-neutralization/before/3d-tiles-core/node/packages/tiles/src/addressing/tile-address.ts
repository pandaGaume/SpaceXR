/**
 * Address of a tile in a quadtree pyramid, in the XYZ convention.
 *
 * `x` grows eastward and `y` grows southward from the north-west corner, as in
 * Slippy Map, Google and Bing tiles. Use {@link toTmsY} for TMS sources, whose
 * `y` grows northward.
 *
 * A pyramid with several roots, such as the cube index of a celestial body, has one quadtree per root, selected by
 * `face`. Single-root pyramids, such as Web Mercator, omit it, which means face 0.
 */
export interface ITileAddress {
    /** Root of the address, from 0 to {@link MAX_TILE_FACE}; omitted for face 0 of single-root pyramids. */
    face?: number;
    /** Level of detail, also called zoom. Level 0 has a single tile. */
    lod: number;
    x: number;
    y: number;
}

/** Highest root of a tile address: the six faces of the cube index are 0 to 5. */
export const MAX_TILE_FACE = 5;

/** Copies the face of `source` onto a new address, leaving it out when `source` has none. */
function withFace(source: ITileAddress, lod: number, x: number, y: number): ITileAddress {
    return source.face === undefined ? { lod, x, y } : { face: source.face, lod, x, y };
}

/** Text of an address for messages and keys: `lod/x/y`, or `face/lod/x/y` when it has a face. */
export function formatTileAddress(address: ITileAddress): string {
    const path = `${address.lod}/${address.x}/${address.y}`;
    return address.face === undefined ? path : `${address.face}/${path}`;
}

/**
 * Key of a tile within a pyramid: `lod/x/y`, prefixed by the face when it is not 0, so that an address without a face
 * and an address on face 0 are the same tile. Keys are ephemeral: they are not stable identifiers.
 */
export function tileAddressKey(address: ITileAddress): string {
    const path = `${address.lod}/${address.x}/${address.y}`;
    return address.face ? `${address.face}/${path}` : path;
}

/** Number of tiles along one axis at a level of detail. */
export function tileCount(lod: number): number {
    return 2 ** lod;
}

/** Returns `true` when the address lies inside its pyramid level. */
export function isValidTileAddress(address: ITileAddress): boolean {
    const { face, lod, x, y } = address;
    if (face !== undefined && (!Number.isSafeInteger(face) || face < 0 || face > MAX_TILE_FACE)) return false;
    if (!Number.isSafeInteger(lod) || lod < 0 || lod > 52) return false;
    const count = tileCount(lod);
    return Number.isSafeInteger(x) && Number.isSafeInteger(y) && x >= 0 && y >= 0 && x < count && y < count;
}

/**
 * Throws when the address lies outside its pyramid level.
 *
 * @throws RangeError When the address is invalid.
 */
export function assertValidTileAddress(address: ITileAddress): void {
    if (!isValidTileAddress(address)) throw new RangeError(`Tile ${formatTileAddress(address)} lies outside its pyramid level.`);
}

/**
 * Converts between XYZ and TMS row numbers. The conversion is its own inverse.
 *
 * @param y - Row number in one convention.
 * @param lod - Level of detail.
 * @returns Row number in the other convention.
 */
export function toTmsY(y: number, lod: number): number {
    return tileCount(lod) - 1 - y;
}

/**
 * Encodes an address as a Bing Maps quadkey.
 *
 * Each digit encodes one level, from the coarsest: `x` bit plus twice the `y` bit.
 * Level 0 has the empty quadkey.
 */
export function tileAddressToQuadkey(address: ITileAddress): string {
    assertValidTileAddress(address);
    let quadkey = "";
    for (let level = address.lod; level > 0; level--) {
        const mask = 2 ** (level - 1);
        const digit = (Math.floor(address.x / mask) % 2) + 2 * (Math.floor(address.y / mask) % 2);
        quadkey += String(digit);
    }
    return quadkey;
}

/**
 * Decodes a Bing Maps quadkey.
 *
 * @throws RangeError When the quadkey contains a character other than 0 to 3.
 */
export function quadkeyToTileAddress(quadkey: string): ITileAddress {
    let x = 0;
    let y = 0;
    for (const character of quadkey) {
        const digit = character.charCodeAt(0) - 48;
        if (digit < 0 || digit > 3) throw new RangeError(`Invalid quadkey digit "${character}" in "${quadkey}".`);
        x = x * 2 + (digit % 2);
        y = y * 2 + Math.floor(digit / 2);
    }
    return { lod: quadkey.length, x, y };
}

/** Returns the parent address, or `undefined` at level 0. The face is kept. */
export function parentTileAddress(address: ITileAddress): ITileAddress | undefined {
    if (address.lod === 0) return undefined;
    return withFace(address, address.lod - 1, Math.floor(address.x / 2), Math.floor(address.y / 2));
}

/** Returns the ancestor `levels` levels above, clamped to level 0. The face is kept. */
export function ancestorTileAddress(address: ITileAddress, levels: number): ITileAddress {
    const steps = Math.min(Math.max(0, Math.trunc(levels)), address.lod);
    const scale = 2 ** steps;
    return withFace(address, address.lod - steps, Math.floor(address.x / scale), Math.floor(address.y / scale));
}

/** Returns the four children in north-west, north-east, south-west, south-east order. The face is kept. */
export function childTileAddresses(address: ITileAddress): [ITileAddress, ITileAddress, ITileAddress, ITileAddress] {
    const lod = address.lod + 1;
    const x = address.x * 2;
    const y = address.y * 2;
    return [withFace(address, lod, x, y), withFace(address, lod, x + 1, y), withFace(address, lod, x, y + 1), withFace(address, lod, x + 1, y + 1)];
}
