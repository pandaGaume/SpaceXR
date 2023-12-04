import { TileMapView } from "core/tiles/tiles.mapview";
import { View } from "./view";
import { IViewSkin } from "../skin";
import { PropertyChangedEventArgs } from "core/events/events.args";
import { IGeo2 } from "core/geography/geography.interfaces";
import { Observer } from "core/events/events.observable";
import { Nullable } from "core/types";
import { MapControl } from "./mapControl";
import { TileContentProvider } from "core/tiles/pipeline/tiles.provider.content";
import { ITileDatasource, ITileAddress } from "core/tiles/tiles.interfaces";
import { ISize2 } from "core/geometry/geometry.interfaces";
import { IMemoryCache } from "core/utils/cache";
import { Size2 } from "core/geometry/geometry.size";
import { Geo2 } from "core/geography/geography.position";
import { Control, Measure, Rectangle } from "@babylonjs/gui";
import { Scalar } from "core/math/math";
import { ICanvasRenderingContext } from "@babylonjs/core";
import { ITileMapApi } from "core/tiles/api/tiles.interfaces.api";

type MinimapModelType = TileMapView<any>;
type MinimapSkinType = IViewSkin;

export class MiniMapControlOptions {
    public resolution?: ISize2;
    public provider?: TileContentProvider<HTMLImageElement>;
    public source?: ITileDatasource<HTMLImageElement, ITileAddress>;
    public cache?: IMemoryCache<string, HTMLImageElement>;
    public skin?: IViewSkin;
}

export class MiniMapControl extends View<MinimapModelType, MinimapSkinType> {
    private static CreateDefaultSkin(): MinimapSkinType {
        return {
            styles: {
                map: {
                    background: "#00000000",
                    width: "100%",
                    height: "100%",
                    alpha: 0.8,
                },
                window: {
                    background: "#44000011",
                    color: "red",
                    thickness: 2,
                },
            },
        } as MinimapSkinType;
    }

    private _centerObserver?: Nullable<Observer<PropertyChangedEventArgs<ITileMapApi, IGeo2>>>;
    private _zoomObserver?: Nullable<Observer<PropertyChangedEventArgs<ITileMapApi, number>>>;
    private _azimuthObserver?: Nullable<Observer<PropertyChangedEventArgs<ITileMapApi, number>>>;

    private _map?: MapControl;
    private _window?: Rectangle;

    public constructor(name: string, options: MiniMapControlOptions, model?: TileMapView<any>) {
        if (!options?.provider && !options?.source) throw new Error("manager or datasource must be provided");
        super(name, options.skin ?? MiniMapControl.CreateDefaultSkin(), model, options);
    }

    protected _onModelChanged(oldValue: MinimapModelType | undefined, newValue: MinimapModelType | undefined): void {
        if (oldValue) {
            if (this._centerObserver) oldValue.centerObservable.remove(this._centerObserver);
            if (this._zoomObserver) oldValue.zoomObservable.remove(this._zoomObserver);
            if (this._azimuthObserver) oldValue.zoomObservable.remove(this._azimuthObserver);
        }

        this._centerObserver = null;
        this._zoomObserver = null;
        this._azimuthObserver = null;

        if (newValue) {
            this._centerObserver = newValue.centerObservable.add(this._onCenterChanged.bind(this));
            this._zoomObserver = newValue.zoomObservable.add(this._onZoomChanged.bind(this));
            this._azimuthObserver = newValue.azimuthObservable.add(this._onAzimuthChanged.bind(this));
        }
    }
    private _onCenterChanged(args: PropertyChangedEventArgs<ITileMapApi, IGeo2>) {
        if (this._map && args.newValue) {
            this._map.setView(args.newValue);
        }
    }

    private _onZoomChanged(args: PropertyChangedEventArgs<ITileMapApi, number>) {
        if (this._map && args.newValue != undefined) {
            this._map.setZoom(args.newValue);
        }
    }

    private _onAzimuthChanged(args: PropertyChangedEventArgs<ITileMapApi, number>) {
        if (this._window && args.newValue != undefined) {
            this._window.rotation = -args.newValue * Scalar.DEG2RAD;
        }
    }

    // this is the place where we create the content of the view. This is called by contructor.
    protected _createContent(model?: MinimapModelType, skin?: MinimapSkinType, options?: any): void {
        const o = options as MiniMapControlOptions;
        let provider = o.provider;
        if (!provider && o.source) {
            provider = new TileContentProvider(o.source, o.cache);
        }

        const resolution = o.resolution ?? new Size2(model?.width ?? 0, model?.height ?? 0);

        this._map = new MapControl(`map`, provider!, resolution);
        this.addControl(this._map);

        this._window = new Rectangle(`window`);
        // ensure it's centered
        this._window.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
        this._window.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;

        this.addControl(this._window);
    }

    protected _updateContent(oldValue: MinimapModelType | undefined, newValue: MinimapModelType | undefined): void {
        if (this._map && newValue) {
            this._map.setView(newValue?.center ?? Geo2.Zero(), newValue?.levelOfDetail ?? 0, newValue?.azimuth ?? 0);
            this._updateWindowSize(this.model);
            if (this._window) {
                this._window.rotation = newValue.azimuth * Scalar.DEG2RAD;
            }
        }
    }

    protected _additionalProcessing(parentMeasure: Measure, context: ICanvasRenderingContext): void {
        super._additionalProcessing(parentMeasure, context);
        this._updateWindowSize(this.model);
    }

    protected _updateWindowSize(model?: MinimapModelType) {
        if (model) {
            const v = this._map?.view;
            if (this._window && v) {
                const wratio = model.width / v.width;
                const hratio = model.height / v.height;
                this._window.widthInPixels = this.widthInPixels * wratio;
                this._window.heightInPixels = this.heightInPixels * hratio;
            }
        }
    }
}
