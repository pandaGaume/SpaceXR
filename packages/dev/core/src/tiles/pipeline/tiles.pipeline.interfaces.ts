import { EventState, Observable } from "../../events";
import { IDisposable, Nullable } from "../../types";
import { ITileAddress, ITileMetrics } from "../tiles.interfaces";
import { ITileNavigationState } from "../navigation/tiles.navigation.interfaces";
import { IDisplay } from "../map";

export type IPipelineMessageType<T> = Array<T>;

export type TargetCallbackFn<T> = (eventData: T, eventState: EventState) => void;

export interface ITargetBlock<T> {
    added: TargetCallbackFn<IPipelineMessageType<T>>;
    removed: TargetCallbackFn<IPipelineMessageType<T>>;
    updated: TargetCallbackFn<IPipelineMessageType<T>>;
}

export function IsTargetBlock<T>(b: unknown): b is ITargetBlock<T> {
    if (b === null || typeof b !== "object") return false;
    return (<ITargetBlock<T>>b).added !== undefined && (<ITargetBlock<T>>b).removed !== undefined && (<ITargetBlock<T>>b).updated !== undefined;
}

export interface ILinkOptions<T> {
    accept?: (data: T) => boolean;
}

export interface ISourceEvent<T> {
    /// <summary> messaged when a tile is updated </summary>
    updatedObservable: Observable<IPipelineMessageType<T>>;
    /// <summary> messaged when a tile is added </summary>
    addedObservable: Observable<IPipelineMessageType<T>>;
    /// <summary> messaged when a tile is removed </summary>
    removedObservable: Observable<IPipelineMessageType<T>>;
}

export interface ISourceBlock<T> extends ISourceEvent<T> {
    linkTo(target: ITargetBlock<T>, options?: ILinkOptions<T>, ...args: Array<any>): void;
    unlinkFrom(target: ITargetBlock<T>, ...args: Array<any>): ITilePipelineLink<T> | undefined;
    links?: Array<ITilePipelineLink<T>>;
}

export interface ITransformBlock<TInput, TOutput> extends ITargetBlock<TInput>, ISourceBlock<TOutput> {}

export interface ITilePipelineLink<T> extends IDisposable {
    source: ISourceBlock<T>;
    target: ITargetBlock<T>;
    options?: ILinkOptions<T>;
}

export interface ITilePipelineComponent extends IDisposable {
    name?: string;
}

export interface ITileMipMapping {
    // split the tile into 4 tiles
    split?(tile: ITileAddress): void;
    // replace tile with it's parent
    stitch?(...tile: Array<ITileAddress>): void;
}

export function IsTileMipMapping(b: unknown): b is ITileMipMapping {
    if (b === null || typeof b !== "object") return false;
    return (<ITileMipMapping>b).split !== undefined && (<ITileMipMapping>b).stitch !== undefined;
}

export interface ITileSelectionContext {
    setContext(state: Nullable<ITileNavigationState>, display: Nullable<IDisplay>, metrics: ITileMetrics, dispatchEvent?: boolean): void;
}

/// <summary>
/// The View component is tasked with selecting appropriate tile addresses, guided by the Tile Metrics and navigation properties. Its role is expanded to include the following:
/// - Tile Selection Based on Navigation Properties: Considers the geographic center, azimuth, and level of detail in tile selection, ensuring relevance and accuracy.
/// - Dimension and Scalability: Defines the dimension in unitless TileXY units, enabling flexibility and adaptability to different screen sizes and resolutions.
/// - Event Management Through Observable Pattern: Crucially, the View is responsible for managing events using the observable pattern. It sends notifications about 'Added'
///   and 'Removed' TileAddresses, allowing other components of the system to react and update accordingly. This feature is vital for ensuring that the system remains dynamic
///   and responsive to changes, such as user navigation or zoom adjustments.
/// </summary>
export interface ITileView extends ITilePipelineComponent, ISourceBlock<ITileAddress>, ITileSelectionContext, ITileMipMapping {}
