import { EventState } from "../events";
import { IPipelineMessageType, ITransformBlock } from "../dataflow";
import { SourceBlock } from "../tiles/pipeline/tiles.pipeline.sourceblock";
import { IStreamSource } from "./streaming.datasource.interfaces";

type StreamSourceBatch<T> = IPipelineMessageType<IStreamSource<T>>;
type ContentBatch<T> = IPipelineMessageType<T>;

/**
 * Generic unwrap adapter for streaming pipelines.
 *
 * Target side : `ITargetBlock<IStreamSource<T>>` (receives stream sources).
 * Source side : `ISourceBlock<T>` (emits their `content`, skipping null ones).
 *
 * Lets hosts wire any `IStreamSource<T>` emitter (typically a sub-engine like
 * TilePyramidStreamSource) to a downstream block that consumes the raw `T`
 * content (e.g. an existing ITileLoader that consumes `ITile2DAddress`).
 *
 * Items whose `content` is null / undefined are silently skipped on each of
 * the three channels; only payload-bearing items propagate.
 */
export class StreamSourceContentAdapter<T> extends SourceBlock<T> implements ITransformBlock<IStreamSource<T>, T> {
    public added = (batch: StreamSourceBatch<T>, _es: EventState): void => {
        const out = this._unwrap(batch);
        if (out.length > 0) this.notifyAdded(out);
    };

    public updated = (batch: StreamSourceBatch<T>, _es: EventState): void => {
        const out = this._unwrap(batch);
        if (out.length > 0) this.notifyUpdated(out);
    };

    public removed = (batch: StreamSourceBatch<T>, _es: EventState): void => {
        const out = this._unwrap(batch);
        if (out.length > 0) this.notifyRemoved(out);
    };

    private _unwrap(batch: StreamSourceBatch<T>): ContentBatch<T> {
        const out: T[] = [];
        for (const s of batch) {
            const c = s.content;
            if (c !== null && c !== undefined) out.push(c);
        }
        return out;
    }
}
