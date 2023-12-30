import { IGeo2 } from "../../geography/geography.interfaces";
import { EventState } from "../../events/events.observable";
import { TileConsumerBase } from "../pipeline/tiles.pipeline.consumer";
import { ITileProducer } from "../pipeline/tiles.pipeline.interfaces";
import { ITile, ITileAddress, ITileDatasource, ITileDisplay } from "../tiles.interfaces";

export interface ITileMapOptions {
    center?: IGeo2;
    lod?: number;
    azimuth?: number;

    dataSources?: Array<ITileDatasource<any, ITileAddress>>;
}

export class TileMapBase<T> extends TileConsumerBase<T> {
    _display: ITileDisplay;

    public constructor(id: string, display: ITileDisplay, options?: ITileMapOptions) {
        super(id);
        this._display = display;
        if (options?.dataSources) {
            this.addDataSources(...options.dataSources);
        }
    }

    public addDataSources(...ds: Array<ITileDatasource<any, ITileAddress>>): void {
        for (const d of ds) {
            this.addDataSource(d);
        }
    }

    public addDataSource(ds: ITileDatasource<any, ITileAddress>): void {
        const m = ds.metrics;
        let producer: ITileProducer<T> | undefined = undefined;
        for (const p of this.producers()) {
            if (p.metrics.isCompatibleWith(m)) {
                producer = p;
                break;
            }
        }
        if (!producer) {
            producer = this._createProducer(ds);
            this.addProducer(producer);
        }

        const provider = this._createProvider(ds);
        producer.addProvider(provider);
    }

    protected _createProducer(ds: ITileDatasource<any, ITileAddress>): ITileProducer<T> {
        throw new Error("Method not implemented.");
    }

    protected _createProvider(ds: ITileDatasource<any, ITileAddress>): ITileProvider<T> {
        throw new Error("Method not implemented.");
    }

    protected _onTileAdded(eventData: Array<ITile<T>>, eventState: EventState): void {}
    protected _onTileRemoved(eventData: Array<ITile<T>>, eventState: EventState): void {}
    protected _onTileUpdated(eventData: ITile<T>, eventState: EventState): void {}
}
