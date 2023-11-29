import { ICanvasRenderingContext } from "@babylonjs/core";
import { Control, Measure } from "@babylonjs/gui";

import { IGeo2 } from "core/geography/geography.interfaces";
import { Geo2 } from "core/geography/geography.position";
import { Cartesian3, ISize2, Size2 } from "core/geometry";
import { ITile, ITileMapApi, ITileMetrics } from "core/tiles/tiles.interfaces";
import { TileContentProvider } from "core/tiles/tiles.content.provider";
import { TileMapView, UpdateEventArgs, UpdateReason } from "core/tiles/tiles.mapview";
import { EPSG3857 } from "core/tiles/tiles.geography";
import { Scalar } from "core/math/math";

export class MapControl extends Control implements ITileMapApi {
    public static readonly DefaultColor = "white";

    private _resolution?: ISize2;
    private _model: TileMapView<HTMLImageElement>;
    private _background?: string;

    public constructor(name: string, manager: TileContentProvider<HTMLImageElement>, resolution?: ISize2, center?: IGeo2, lod?: number) {
        super(name);
        this._resolution = resolution;
        const tmp = this._resolution ?? Size2.Zero();
        this._model = new TileMapView(manager, tmp.width, tmp.height, center || Geo2.Zero(), lod || manager.metrics.minLOD);
        this._model.updateObservable.add(this.onUpdate.bind(this));
        this._model.validate();
    }

    public get view(): TileMapView<HTMLImageElement> | undefined {
        return this._model;
    }

    public get background(): string | undefined {
        return this._background;
    }

    public set background(v: string | undefined) {
        if (this._background != v) {
            this._background = v;
            this._markAsDirty();
        }
    }

    public hasTile(key: string): boolean {
        return this._model?.context.tiles.has(key) ?? false;
    }

    public getTile(key: string): ITile<HTMLImageElement> | undefined {
        return this._model?.context.tiles.get(key);
    }

    public invalidateSize(w: number, h: number): ITileMapApi {
        this._model?.invalidateSize(w, h);
        this._model?.validate();
        return this;
    }

    public setView(center: IGeo2, zoom?: number, rotation?: number): ITileMapApi {
        this._model?.setView(center, zoom, rotation);
        this._model?.validate();
        return this;
    }

    public setZoom(zoom: number): ITileMapApi {
        this._model?.setZoom(zoom);
        this._model?.validate();
        return this;
    }
    public setAzimuth(r: number): ITileMapApi {
        this._model?.setAzimuth(r);
        this._model?.validate();
        return this;
    }
    public zoomIn(delta: number): ITileMapApi {
        this._model?.zoomIn(delta ?? 1);
        this._model?.validate();
        return this;
    }
    public zoomOut(delta: number): ITileMapApi {
        this._model?.zoomOut(delta ?? 1);
        this._model?.validate();
        return this;
    }
    public translate(tx: number, ty: number): ITileMapApi {
        this._model?.translate(tx, ty);
        this._model?.validate();
        return this;
    }
    public rotate(r: number): ITileMapApi {
        this._model?.rotate(r);
        this._model?.validate();
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
        return this._model?.metrics ?? EPSG3857.Shared;
    }

    public get azimuth(): number | undefined {
        return this._model?.azimuth;
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
            const scale = this._model?.context.scale ?? 1;
            const center = this._model?.context.center ?? Cartesian3.Zero();
            const res = this.resolution;
            const ratioW = res ? this.widthInPixels / this.resolution.width : 1.0;
            const ratioH = res ? this.heightInPixels / this.resolution.height : 1.0;
            context.translate(this.widthInPixels / 2, this.heightInPixels / 2);
            context.scale(scale * ratioW, scale * ratioH);
            if (this.azimuth) {
                // convert azimuth to canvas rotation, which is clockwize, and cartesian
                const angle = this.azimuth * Scalar.DEG2RAD;
                context.rotate(angle);
            }
            const tileSize = this.metrics.tileSize;
            const tiles = Array.from(this._model?.context.tiles.values() ?? []);
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
                        context.fillStyle = this._background ?? MapControl.DefaultColor;
                        context.fillRect(x, y, tileSize, tileSize);
                    }
                }
            }
            context.restore();
        }
    }
}
