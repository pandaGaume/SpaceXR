import type { ICartesian3 } from "@spacexr/geodesy";

import { assertValidTileAddress, formatTileAddress, type ITileAddress } from "../addressing/tile-address";
import type { ITileShapeFrame, ITileSurface } from "../addressing/tile-surface";
import { cubeTileDirection } from "./cube-mapping";
import type { ReferenceSurface } from "./reference-surface";

/**
 * Tiles of the cube index on a reference surface. Heights are radial: every point lies on the ray of its direction.
 *
 * Each tile has its own shape. The same address on another face is the same shape on a sphere only, and is never in
 * view together with the tile, so sharing would save nothing.
 */
export class CubeTileSurface implements ITileSurface {
    /** @param reference - Reference surface of the heights. */
    public constructor(public readonly reference: ReferenceSurface) {}

    public point(address: ITileAddress, s: number, t: number, height = 0, target: ICartesian3 = { x: 0, y: 0, z: 0 }): ICartesian3 {
        return this.reference.point(cubeTileDirection(address, s, t, target), height, target);
    }

    public up(address: ITileAddress, s: number, t: number, target?: ICartesian3): ICartesian3 {
        return cubeTileDirection(address, s, t, target);
    }

    public shape(address: ITileAddress): ITileShapeFrame {
        assertValidTileAddress(address);
        return { key: formatTileAddress({ ...address, face: address.face ?? 0 }), rotation: 0 };
    }
}
