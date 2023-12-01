import { ITileMetrics } from "../tiles.interfaces";
import { ITileSystem, ITileSystemComponent, ITilePipelineComponent } from "./tiles.interfaces.pipeline";

export class TilePipelineComponent implements ITilePipelineComponent {
    _id: string;

    public constructor(id: string) {
        this._id = id;
    }

    public get id(): string {
        return this._id;
    }

    public dispose(): void {}
}

export class TileSystemComponent<T> extends TilePipelineComponent implements ITileSystemComponent<T> {
    _tileSystem: ITileSystem<T>;

    public constructor(id: string, system: ITileSystem<T>) {
        super(id);
        this._tileSystem = system;
    }

    public get system(): ITileSystem<T> {
        return this._tileSystem;
    }

    public set system(s: ITileSystem<T>) {
        this._tileSystem = s;
    }

    public get metrics(): ITileMetrics {
        return this._tileSystem.metrics;
    }

    public dispose(): void {}
}

export class TileSystem<T> implements ITileSystem<T> {
    _metrics: ITileMetrics;

    public constructor(metrics: ITileMetrics) {
        this._metrics = metrics;
    }
    public get metrics(): ITileMetrics {
        return this._metrics;
    }
}
