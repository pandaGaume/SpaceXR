import { ICanvasRenderingContext } from "@babylonjs/core";
import { Measure } from "@babylonjs/gui/2D/measure";

import { IGeo2 } from "core/geography/geography.interfaces";
import { Geo2 } from "core/geography/geography.position";
import { Cartesian3, Size3 } from "core/geometry";
import { ISize3 } from "core/geometry/geometry.interfaces";
import { ITile, ITileMapApi, ITileMetrics } from "core/tiles/tiles.interfaces";
import { TileContentManager } from "core/tiles/tiles.content.manager";
import { TileMapView, UpdateEventArgs, UpdateReason } from "core/tiles/tiles.mapview";
import { Scalar } from "core/math/math";
import { EPSG3857 } from "core/tiles/tiles.geography";

import { View } from "./view";
import { IViewSkin } from "../skin";

export class MapControl extends View<TileMapView<HTMLImageElement>, IViewSkin> implements ITileMapApi {
    _activ: Map<string, ITile<HTMLImageElement>>; // the list of activ tiles

    public constructor(name: string, manager: TileContentManager<HTMLImageElement>, center?: IGeo2, lod?: number) {
        super(name);
        this.model = new TileMapView(manager, this.resolution.width, this.resolution.height, center || Geo2.Zero(), lod || manager.metrics.minLOD);
        this.model.updateObservable.add(this.onUpdate.bind(this));
        this._activ = new Map<string, ITile<HTMLImageElement>>();
    }

    public hasTile(key: string): boolean {
        return this._activ.has(key);
    }

    public getTile(key: string): ITile<HTMLImageElement> | undefined {
        return this._activ.get(key);
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

    public get resolution(): ISize3 {
        return new Size3(this.widthInPixels, this.heightInPixels, 0);
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

    protected onUpdateTiles(args: UpdateEventArgs<HTMLImageElement>): void {
        this._markAsDirty();
    }

    protected onUpdateView(args: UpdateEventArgs<HTMLImageElement>): void {
        this._markAsDirty();
    }

    protected _additionalProcessing(parentMeasure: Measure, context: ICanvasRenderingContext): void {
        this.model?.invalidateSize(parentMeasure.width, parentMeasure.height);
    }

    // this is the place we draw the tiles
    protected _localDraw(ctx: ICanvasRenderingContext): void {
        if (ctx) {
            ctx.save();
            const scale = this.model?.context.scale ?? 1;
            const center = this.model?.context.center ?? Cartesian3.Zero();
            const res = this.resolution;
            ctx.translate(res.width / 2, res.height / 2);
            ctx.scale(scale, scale);
            if (this.azimuth) {
                // convert azimuth to canvas rotation, which is clockwize, and cartesian
                const angle = this.azimuth * Scalar.DEG2RAD;
                ctx.rotate(angle);
            }
            const tileSize = this.metrics.tileSize;
            const tiles = this.model?.context.tiles.values() ?? [];
            for (const t of tiles) {
                if (t.rect) {
                    const x = t.rect.x - center.x;
                    const y = t.rect.y - center.y;
                    const item = t.content ?? null; // trick to address erroness tile.
                    if (item) {
                        if (item instanceof HTMLImageElement) {
                            ctx.drawImage(item, x, y);
                            continue;
                        }
                        // this is a view...
                    } else {
                        // this is where we fill the empty tile
                        ctx.fillStyle = this._getBackgroundColor(ctx);
                        ctx.fillRect(x, y, tileSize, tileSize);
                    }
                }
            }
            ctx.restore();
        }
    }
}
