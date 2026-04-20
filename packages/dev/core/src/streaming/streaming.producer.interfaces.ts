import { ITransformBlock } from "../dataflow";
import { IStreamSource, IStreamSourceActivation } from "./streaming.datasource.interfaces";

/**
 * A datasource producer turns activations (load/activate/deactivate/unload) into
 * concrete IStreamSource emissions with evolving status. It is a pipeline block:
 *  - target side consumes IStreamSourceActivation from the view
 *  - source side emits IStreamSource<T> (added / updated / removed)
 *
 * Producers fall in two broad shapes:
 *  - Static (1:1) : one activation emits one IStreamSource whose status evolves
 *                   downloading → ready / failed. Typical for meshes, point clouds.
 *  - Spawner (1:N) : one activation drives a sub-pipeline that spawns many
 *                    child IStreamSource instances over time (e.g. TileStreamSource
 *                    emits a stream of Tile2DDataSource as the camera moves).
 *
 * Registered in the StreamingView by `contentType`. Only the producer matching
 * a datasource's `contentType` handles it.
 */
export interface IStreamSourceProducer<T = unknown> extends ITransformBlock<IStreamSourceActivation, IStreamSource<T>> {
    readonly contentType: string;
    /** Predicate the view uses to decide if this producer should handle a given source. */
    handles(source: IStreamSource): boolean;
}
