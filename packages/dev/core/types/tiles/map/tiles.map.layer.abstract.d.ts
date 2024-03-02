import { ITileCollection, ITileMetrics } from "../tiles.interfaces";
import { ITileMap, ITileMapLayer, ITileMapLayerOptions, ITileDisplay } from "./tiles.map.interfaces";
import { TileConsumerBase } from "../pipeline";
import { Nullable } from "../../types";
import { ITileNavigationState } from "../navigation";
export declare abstract class AbstractTileMapLayer<T> extends TileConsumerBase<T> implements ITileMapLayer<T> {
    _zindex: number;
    _zoomOffset?: number;
    _attribution?: string;
    _enabled: boolean;
    _state: ITileNavigationState;
    constructor(name: string, options?: ITileMapLayerOptions, enabled?: boolean);
    setContext(state: Nullable<ITileNavigationState>, display: Nullable<ITileDisplay>, metrics?: ITileMetrics, dispatchEvent?: boolean): void;
    get zindex(): number;
    get navigation(): ITileNavigationState;
    set zindex(zindex: number);
    get zoomOffset(): number;
    set zoomOffset(zoomOffset: number);
    get attribution(): string | undefined;
    set attribution(attribution: string | undefined);
    get enabled(): boolean;
    set enabled(enabled: boolean);
    addTo(map: ITileMap<T, ITileMapLayer<T>, unknown>): ITileMapLayer<T>;
    dispose(): void;
    abstract getActiveTiles(): Nullable<ITileCollection<T>>;
    abstract get metrics(): ITileMetrics;
}
