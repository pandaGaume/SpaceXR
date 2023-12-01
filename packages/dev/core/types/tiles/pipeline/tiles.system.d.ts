import { ITileMetrics } from "../tiles.interfaces";
import { ITileSystem, ITileSystemComponent, ITilePipelineComponent } from "./tiles.interfaces.pipeline";
export declare class TilePipelineComponent implements ITilePipelineComponent {
    _id: string;
    constructor(id: string);
    get id(): string;
    dispose(): void;
}
export declare class TileSystemComponent<T> extends TilePipelineComponent implements ITileSystemComponent<T> {
    _tileSystem: ITileSystem<T>;
    constructor(id: string, system: ITileSystem<T>);
    get system(): ITileSystem<T>;
    set system(s: ITileSystem<T>);
    get metrics(): ITileMetrics;
    dispose(): void;
}
export declare class TileSystem<T> implements ITileSystem<T> {
    _metrics: ITileMetrics;
    constructor(metrics: ITileMetrics);
    get metrics(): ITileMetrics;
}
