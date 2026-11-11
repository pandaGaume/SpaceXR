import type { IMetadataSnapshot } from "../metadata/types";
import { NO_METADATA, type MetadataHandle } from "./states";

export interface IMetadataStore {
    readonly size: number;
    register(snapshot: IMetadataSnapshot): MetadataHandle;
    get(handle: MetadataHandle): IMetadataSnapshot;
    tryGet(handle: MetadataHandle): IMetadataSnapshot | undefined;
    release(handle: MetadataHandle): void;
    clear(): void;
}

/** Compact handle store shared by tiles, contents and renderer adapters. */
export class RuntimeMetadataStore implements IMetadataStore {
    private readonly snapshots: Array<IMetadataSnapshot | undefined> = [];

    public get size(): number {
        return this.snapshots.length;
    }

    public register(snapshot: IMetadataSnapshot): MetadataHandle {
        const handle = this.snapshots.length;
        this.snapshots.push(snapshot);
        return handle;
    }

    public get(handle: MetadataHandle): IMetadataSnapshot {
        const snapshot = this.tryGet(handle);
        if (!snapshot) throw new RangeError(`Metadata handle ${handle} is not available.`);
        return snapshot;
    }

    public tryGet(handle: MetadataHandle): IMetadataSnapshot | undefined {
        return handle === NO_METADATA ? undefined : this.snapshots[handle];
    }

    public release(handle: MetadataHandle): void {
        if (handle !== NO_METADATA && handle >= 0 && handle < this.snapshots.length) this.snapshots[handle] = undefined;
    }

    public clear(): void {
        this.snapshots.length = 0;
    }
}
