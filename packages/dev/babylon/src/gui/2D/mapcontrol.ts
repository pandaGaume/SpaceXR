import { ICanvasRenderingContext } from "@babylonjs/core";
import { Control, Measure } from "@babylonjs/gui";

import { IGeo2 } from "core/geography/geography.interfaces";
import { Geo2 } from "core/geography/geography.position";
import { Cartesian3, ISize2, Size2 } from "core/geometry";
import { ITile, ITileMapApi, ITileMetrics } from "core/tiles/tiles.interfaces";
import { TileContentManager } from "core/tiles/tiles.content.manager";
import { TileMapView, UpdateEventArgs, UpdateReason } from "core/tiles/tiles.mapview";
import { EPSG3857 } from "core/tiles/tiles.geography";
import { Scalar } from "core/math/math";

//import { View } from "./view";
//import { IViewSkin } from "../skin";

export class MapControl extends Control implements ITileMapApi {
    private _resolution?: ISize2;
    private model: TileMapView<HTMLImageElement>;

    public constructor(name: string, manager: TileContentManager<HTMLImageElement>, center?: IGeo2, lod?: number, resolution?: ISize2) {
        super(name);
        this._resolution = resolution;
        const tmp = this._resolution ?? Size2.Zero();
        this.model = new TileMapView(manager, tmp.width, tmp.height, center || Geo2.Zero(), lod || manager.metrics.minLOD);
        this.model.updateObservable.add(this.onUpdate.bind(this));
        this.model.validate();
    }

    public hasTile(key: string): boolean {
        return this.model?.context.tiles.has(key) ?? false;
    }

    public getTile(key: string): ITile<HTMLImageElement> | undefined {
        return this.model?.context.tiles.get(key);
    }

    public invalidateSize(w: number, h: number): ITileMapApi {
        this.model?.invalidateSize(w, h);
        this.model?.validate();
        return this;
    }
    public setView(center: IGeo2, zoom?: number, rotation?: number): ITileMapApi {
        this.model?.setView(center, zoom, rotation);
        this.model?.validate();
        return this;
    }
    public setZoom(zoom: number): ITileMapApi {
        this.model?.setZoom(zoom);
        this.model?.validate();
        return this;
    }
    public setAzimuth(r: number): ITileMapApi {
        this.model?.setAzimuth(r);
        this.model?.validate();
        return this;
    }
    public zoomIn(delta: number): ITileMapApi {
        this.model?.zoomIn(delta ?? 1);
        this.model?.validate();
        return this;
    }
    public zoomOut(delta: number): ITileMapApi {
        this.model?.zoomOut(delta ?? 1);
        this.model?.validate();
        return this;
    }
    public translate(tx: number, ty: number): ITileMapApi {
        this.model?.translate(tx, ty);
        this.model?.validate();
        return this;
    }
    public rotate(r: number): ITileMapApi {
        this.model?.rotate(r);
        this.model?.validate();
        return this;
    }
    public getContext(options?: CanvasRenderingContext2DSettings | undefined): ICanvasRenderingContext {
        return this._host.getContext();
    }

    public get resolution(): ISize2 {
        return this._resolution ?? new Size2(this.widthInPixels, this.heightInPixels);
    }

    public set resolution(v: ISize2) {
        if (v != this._resolution) {
            this._resolution = v;
            this.invalidateSize(this._resolution.width, this._resolution.height);
        }
    }

    public get metrics(): ITileMetrics {
        return this.model?.metrics ?? EPSG3857.Shared;
    }

    public get azimuth(): number | undefined {
        return this.model?.azimuth;
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

    public _markAsDirty(force = false): void {
        if (!(<any>this)._isVisible && !force) {
            return;
        }

        this._isDirty = true;

        // Redraw only this rectangle
        if (this._host) {
            this._host.markAsDirty();
        }
    }

    protected onUpdateTiles(args: UpdateEventArgs<HTMLImageElement>): void {
        this._markAsDirty();
    }

    protected onUpdateView(args: UpdateEventArgs<HTMLImageElement>): void {
        this._markAsDirty();
    }

    protected _additionalProcessing(parentMeasure: Measure, context: ICanvasRenderingContext): void {
        super._additionalProcessing(parentMeasure, context);
        if (!this._resolution) {
            this.invalidateSize(this.widthInPixels, this.heightInPixels);
        }
    }

    // this is the place we draw the tiles
    //protected _localDraw(context: ICanvasRenderingContext): void {
    public _draw(context: ICanvasRenderingContext, invalidatedRectangle?: Measure): void {
        if (context) {
            context.save();
            const scale = this.model?.context.scale ?? 1;
            const center = this.model?.context.center ?? Cartesian3.Zero();
            const res = this.resolution;
            const sw = res ? this.widthInPixels / this.resolution.width : 1.0;
            const sh = res ? this.heightInPixels / this.resolution.height : 1.0;
            context.translate((this.widthInPixels * sw) / 2, (this.heightInPixels * sh) / 2);
            context.scale(scale * sw, scale * sh);
            if (this.azimuth) {
                // convert azimuth to canvas rotation, which is clockwize, and cartesian
                const angle = this.azimuth * Scalar.DEG2RAD;
                context.rotate(angle);
            }
            const tileSize = this.metrics.tileSize;
            const tiles = Array.from(this.model?.context.tiles.values() ?? []);
            for (const t of tiles) {
                if (t.rect) {
                    const x = t.rect.x - center.x;
                    const y = t.rect.y - center.y;
                    const item = t.content ?? null; // trick to address erroness tile.
                    if (item) {
                        if (item instanceof HTMLImageElement) {
                            context.drawImage(item, x, y);
                            continue;
                        }
                        // this is a view...
                    } else {
                        // this is where we fill the empty tile
                        context.fillStyle = "blue";
                        context.fillRect(x, y, tileSize, tileSize);
                    }
                }
            }
            context.restore();
        }
    }
}
