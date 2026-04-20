import { IDisposable, Nullable } from "../../types";
import { ITile2DAddress, ITileMetrics } from "../tiles.interfaces";
import { ITileNavigationState } from "../navigation/tiles.navigation.interfaces";
import { IDisplay } from "../map";

// Generic dataflow primitives now live in core/src/dataflow. Re-exported here so
// historical imports from "tiles/pipeline" keep working.
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

export function hasTileSelectionContext(b: unknown): b is ITileSelectionContext {
    if (b === null || typeof b !== "object") return false;
    return (<ITileSelectionContext>b).setContext !== undefined;
}

/// <summary>
/// The View component is tasked with selecting appropriate tile addresses, guided by the Tile Metrics and navigation properties. Its role is expanded to include the following:
/// - Tile Selection Based on Navigation Properties: Considers the geographic center, azimuth, and level of detail in tile selection, ensuring relevance and accuracy.
/// - Dimension and Scalability: Defines the dimension in unitless TileXY units, enabling flexibility and adaptability to different screen sizes and resolutions.
/// - Event Management Through Observable Pattern: Crucially, the View is responsible for managing events using the observable pattern. It sends notifications about 'Added'
///   and 'Removed' TileAddresses, allowing other components of the system to react and update accordingly. This feature is vital for ensuring that the system remains dynamic
///   and responsive to changes, such as user navigation or zoom adjustments.
/// </summary>
export interface ITileView extends ITilePipelineComponent, ISourceBlock<ITile2DAddress>, ITileSelectionContext {
    /** Clear cached tile addresses, forcing re-emission on the next setContext call */
    clearContext(): void;
}

export interface IHasView {
    view: ITileView;
}

export function isViewProxy(b: unknown): b is IHasView {
    if (b === null || typeof b !== "object") return false;
    return (<IHasView>b).view !== undefined;
}
