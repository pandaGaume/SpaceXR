import { IDisposable, Nullable } from "../../types";
import { ITile2DAddress, ITileMetrics } from "../tiles.interfaces";
import { ITileNavigationState } from "../navigation/tiles.navigation.interfaces";
import { IDisplay } from "../map";
export * from "../../dataflow";
import { ISourceBlock } from "../../dataflow";
export interface ITilePipelineComponent extends IDisposable {
    name?: string;
}
export interface ITileSelectionContextOptions {
    dispatchEvent?: boolean;
    zoomOffset?: number;
}
export interface ITileSelectionContext {
    setContext(state: Nullable<ITileNavigationState>, display: Nullable<IDisplay>, metrics?: ITileMetrics, options?: ITileSelectionContextOptions): void;
}
export declare function hasTileSelectionContext(b: unknown): b is ITileSelectionContext;
export interface ITileView extends ITilePipelineComponent, ISourceBlock<ITile2DAddress>, ITileSelectionContext {
    /** Clear cached tile addresses, forcing re-emission on the next setContext call */
    clearContext(): void;
}
export interface IHasView {
    view: ITileView;
}
export declare function isViewProxy(b: unknown): b is IHasView;
