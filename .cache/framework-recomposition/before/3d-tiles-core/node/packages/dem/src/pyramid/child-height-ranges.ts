import { childTileAddresses, tileAddressKey, type ITileAddress } from "@spacexr/tiles";

import type { QuadrantHeightRanges } from "../codecs";

/**
 * Height ranges prepared for child tiles before they exist.
 *
 * When the DEM of a tile is loaded, the ranges of its four quadrants are recorded for the four children. A child
 * created afterwards starts with that range instead of a placeholder, then reports the exact range of its own DEM.
 */
export class ChildHeightRanges {
    private readonly ranges = new Map<string, readonly [number, number]>();

    /** Records the quadrant ranges of `parent` for its four children. */
    public recordChildren(parent: ITileAddress, quadrants: QuadrantHeightRanges): void {
        childTileAddresses(parent).forEach((child, index) => {
            const range = quadrants[index]!;
            if (Number.isNaN(range.minimum) || Number.isNaN(range.maximum)) return;
            this.ranges.set(tileAddressKey(child), [range.minimum, range.maximum]);
        });
    }

    /** Unscaled range prepared for a tile, if its parent DEM is known. */
    public rangeFor(address: ITileAddress): readonly [number, number] | undefined {
        return this.ranges.get(tileAddressKey(address));
    }

    public get size(): number {
        return this.ranges.size;
    }
}
