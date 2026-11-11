import type { IAvailability, IImplicitTiling, ISubtreeBufferView } from "@spacexr/3d-tiles-core";

import { implicitAvailabilityIndex, implicitMortonIndex } from "./coordinates";
import type { IImplicitCoordinates, ILoadedImplicitSubtree, ISubtreeAvailability } from "./types";

export class SubtreeAvailabilityError extends Error {
    public constructor(message: string) {
        super(message);
        this.name = "SubtreeAvailabilityError";
    }
}

function getBit(bytes: Uint8Array, index: number): boolean {
    const byte = bytes[Math.floor(index / 8)];
    if (byte === undefined) throw new SubtreeAvailabilityError(`Availability bit ${index} is outside the referenced buffer view.`);
    return ((byte >> (index % 8)) & 1) === 1;
}

export class LoadedSubtreeAvailability implements ISubtreeAvailability {
    public constructor(
        private readonly loaded: ILoadedImplicitSubtree,
        private readonly tiling: IImplicitTiling,
    ) {}

    public isTileAvailable(coordinates: IImplicitCoordinates): boolean {
        return this.read(this.loaded.subtree.tileAvailability, implicitAvailabilityIndex(coordinates, this.tiling));
    }

    public isContentAvailable(contentIndex: number, coordinates: IImplicitCoordinates): boolean {
        const availability = this.loaded.subtree.contentAvailability?.[contentIndex];
        return availability ? this.read(availability, implicitAvailabilityIndex(coordinates, this.tiling)) : false;
    }

    public isChildSubtreeAvailable(coordinates: IImplicitCoordinates): boolean {
        return this.read(this.loaded.subtree.childSubtreeAvailability, implicitMortonIndex(coordinates, this.tiling.subdivisionScheme));
    }

    private read(availability: IAvailability, index: number): boolean {
        if (availability.constant !== undefined) return availability.constant === 1;
        if (availability.bitstream === undefined)
            throw new SubtreeAvailabilityError("Availability must define either constant or bitstream.");
        const view = this.loaded.subtree.bufferViews?.[availability.bitstream];
        if (!view) throw new SubtreeAvailabilityError(`Availability references missing buffer view ${availability.bitstream}.`);
        return getBit(this.bufferView(view), index);
    }

    private bufferView(view: ISubtreeBufferView): Uint8Array {
        const buffer = this.loaded.buffers?.[view.buffer];
        if (!buffer) throw new SubtreeAvailabilityError(`Buffer view references unloaded buffer ${view.buffer}.`);
        const start = view.byteOffset ?? 0;
        const end = start + view.byteLength;
        if (start < 0 || end > buffer.byteLength) throw new SubtreeAvailabilityError("Buffer view exceeds its loaded buffer.");
        return buffer.subarray(start, end);
    }
}
