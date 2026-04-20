import { EventState, Observer } from "../events";
import { SourceBlock } from "../tiles/pipeline/tiles.pipeline.sourceblock";
import { IPipelineMessageType, ITargetBlock } from "../dataflow";
import { IDisposable, Nullable } from "../types";
import { IStreamSource, IStreamSourceActivation } from "./streaming.datasource.interfaces";
import { IStreamSourceProducer } from "./streaming.producer.interfaces";

type ActivationBatch = IPipelineMessageType<IStreamSourceActivation>;
type SourceBatch<T> = IPipelineMessageType<IStreamSource<T>>;

export interface IStreamingViewOptions {
    viewId: string;
    producers?: ReadonlyArray<IStreamSourceProducer>;
}

/**
 * Per-camera routing block.
 *
 * Target side (ITargetBlock<IStreamSourceActivation>): receives activations from the
 * StreamingEngine. The view resolves datasource links (replace / add / modify),
 * groups activations by `contentType`, and forwards them to the registered producers.
 *
 * Source side (ISourceBlock<IStreamSource>): aggregates the outputs of all producers
 * so the downstream scene can link once to the view and see the union of datasources
 * (with their evolving status) across producers.
 *
 * The view holds the "visible/active" set for its camera implicitly, derived from
 * what the engine emits and what producers acknowledge.
 */
export class StreamingView<T = unknown> extends SourceBlock<IStreamSource<T>> implements IDisposable {
    private readonly _viewId: string;
    private readonly _byContentType: Map<string, IStreamSourceProducer<T>> = new Map();
    private readonly _producerObservers: Array<Observer<SourceBatch<T>>> = [];

    public constructor(options: IStreamingViewOptions) {
        super();
        this._viewId = options.viewId;
        if (options.producers) {
            for (const p of options.producers) this.registerProducer(p as IStreamSourceProducer<T>);
        }
    }

    public get viewId(): string {
        return this._viewId;
    }

    /**
     * Register a producer. Its outputs (activatedObservable/deactivatedObservable/
     * updatedObservable) are forwarded through the view's own SourceBlock.
     * A producer can only be registered once per contentType.
     */
    public registerProducer(producer: IStreamSourceProducer<T>): void {
        if (this._byContentType.has(producer.contentType)) return;
        this._byContentType.set(producer.contentType, producer);

        const onAdded = producer.addedObservable.add((batch) => this.notifyAdded(batch));
        const onRemoved = producer.removedObservable.add((batch) => this.notifyRemoved(batch));
        const onUpdated = producer.updatedObservable.add((batch) => this.notifyUpdated(batch));
        if (onAdded) this._producerObservers.push(onAdded);
        if (onRemoved) this._producerObservers.push(onRemoved);
        if (onUpdated) this._producerObservers.push(onUpdated);
    }

    public getProducer(contentType: string): Nullable<IStreamSourceProducer<T>> {
        return this._byContentType.get(contentType) ?? null;
    }

    public readonly added = (batch: ActivationBatch, es: EventState): void => this._route(batch, es, "added");
    public readonly removed = (batch: ActivationBatch, es: EventState): void => this._route(batch, es, "removed");
    public readonly updated = (batch: ActivationBatch, es: EventState): void => this._route(batch, es, "updated");

    public override dispose(): void {
        for (const o of this._producerObservers) o.disconnect();
        this._producerObservers.length = 0;
        this._byContentType.clear();
        super.dispose();
    }

    private _route(batch: ActivationBatch, es: EventState, channel: "added" | "removed" | "updated"): void {
        const resolved = this._resolveLinks(batch);

        const byType = new Map<string, IStreamSourceActivation[]>();
        for (const a of resolved) {
            let arr = byType.get(a.source.contentType);
            if (!arr) {
                arr = [];
                byType.set(a.source.contentType, arr);
            }
            arr.push(a);
        }

        for (const [contentType, acts] of byType) {
            const producer = this._byContentType.get(contentType);
            if (!producer) continue;
            const cb = producer[channel];
            if (cb) cb.call(producer, acts, es);
        }
    }

    /**
     * Resolves datasource links before dispatch. v1 is a pass-through.
     *
     * TODO: implement link semantics:
     *  - replace(target) : when this source activates, emit deactivate for target first
     *  - add(target)     : emit both (no conflict)
     *  - modify(target)  : emit an update on target carrying this source as overlay
     *
     * Resolution needs the view's current active set plus the datasource registry;
     * deferring until we have a concrete use case that stresses it.
     */
    protected _resolveLinks(batch: ReadonlyArray<IStreamSourceActivation>): ReadonlyArray<IStreamSourceActivation> {
        return batch;
    }
}

/**
 * Type guard for ITargetBlock<IStreamSourceActivation> so an engine can link to a view.
 * (Mostly useful for external callers that want to verify a view shape at runtime.)
 */
export function IsStreamingViewTarget(b: unknown): b is ITargetBlock<IStreamSourceActivation> {
    if (b === null || typeof b !== "object") return false;
    const t = b as ITargetBlock<IStreamSourceActivation>;
    return t.added !== undefined || t.removed !== undefined || t.updated !== undefined;
}

