import { ICanvasRenderingContext } from "@babylonjs/core";
import { Container } from "@babylonjs/gui";
import { IGeo2 } from "core/geography/geography.interfaces";
import { Geo2 } from "core/geography/geography.position";
import { Size3 } from "core/geometry";
import { ISize3 } from "core/geometry/geometry.interfaces";
import { ITile, ITileMapApi, ITileMetrics } from "core/tiles/tiles.interfaces";
import { TileContentManager } from "core/tiles/tiles.content.manager";
import { TileMapView, UpdateEventArgs, UpdateReason } from "core/tiles/tiles.mapview";

export class MapControl extends Container implements ITileMapApi {
    _view: TileMapView<HTMLImageElement>; // the view logic
    _activ: Map<string, ITile<HTMLImageElement>>; // the list of activ tiles

    public constructor(name: string, manager: TileContentManager<HTMLImageElement>, center?: IGeo2, lod?: number) {
        super(name);
        this._view = new TileMapView(manager, this.resolution.width, this.resolution.height, center || Geo2.Zero(), lod || manager.metrics.minLOD);
        this._view.updateObservable.add(this.onUpdate.bind(this));
        this._activ = new Map<string, ITile<HTMLImageElement>>();
    }

    public hasTile(key: string): boolean {
        return this._activ.has(key);
    }

    public getTile(key: string): ITile<HTMLImageElement> | undefined {
        return this._activ.get(key);
    }

    public invalidateSize(w: number, h: number): ITileMapApi {
        this._view.invalidateSize(w, h);
        this._view.validate();
        return this;
    }
    public setView(center: IGeo2, zoom?: number, rotation?: number): ITileMapApi {
        this._view.setView(center, zoom, rotation);
        this._view.validate();
        return this;
    }
    public setZoom(zoom: number): ITileMapApi {
        this._view.setZoom(zoom);
        this._view.validate();
        return this;
    }
    public setAzimuth(r: number): ITileMapApi {
        this._view.setAzimuth(r);
        this._view.validate();
        return this;
    }
    public zoomIn(delta: number): ITileMapApi {
        this._view.zoomIn(delta ?? 1);
        this._view.validate();
        return this;
    }
    public zoomOut(delta: number): ITileMapApi {
        this._view.zoomOut(delta ?? 1);
        this._view.validate();
        return this;
    }
    public translate(tx: number, ty: number): ITileMapApi {
        this._view.translate(tx, ty);
        this._view.validate();
        return this;
    }
    public rotate(r: number): ITileMapApi {
        this._view.rotate(r);
        this._view.validate();
        return this;
    }
    public getContext(options?: CanvasRenderingContext2DSettings | undefined): ICanvasRenderingContext {
        return this._host.getContext();
    }

    public get resolution(): ISize3 {
        return new Size3(this.widthInPixels, this.heightInPixels, 0);
    }

    public get view(): TileMapView<HTMLImageElement> {
        return this._view;
    }

    public get metrics(): ITileMetrics {
        return this.view.metrics;
    }

    public get azimuth(): number {
        return this._view.azimuth;
    }

    protected onUpdate(args: UpdateEventArgs<HTMLImageElement>): void {
        if (!args) {
            return;
        }

        switch (args.reason) {
            case UpdateReason.tileReady: {
                this.onUpdateTiles(args);
                break;
            }
            case UpdateReason.viewChanged:
            default: {
                this.onUpdateView(args);
                break;
            }
        }
    }

    protected onUpdateTiles(args: UpdateEventArgs<HTMLImageElement>): void {}

    protected onUpdateView(args: UpdateEventArgs<HTMLImageElement>): void {}
}
