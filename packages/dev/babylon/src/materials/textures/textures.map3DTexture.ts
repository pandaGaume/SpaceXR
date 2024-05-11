import { ITexture3CreationOptions, ITexture3Layer, Texture3 } from "babylon-ext/materials";
import { IPipelineMessageType, ITargetBlock } from "core/tiles/pipeline";
import { Map3dTileContentType } from "../materials.map3d";
import { EventState, Nullable, Scene } from "@babylonjs/core";
import { ITile, ITileMetrics, ITileNavigationState, ImageLayer } from "core/tiles";
import { IDemInfos } from "core/dem";
import { IDisposable } from "core/types";
import { ICanvasRenderingContext } from "core/engine";
import { CanvasDisplay, Context2DTileMap } from "core/map";
import { ICartesian2 } from "core/geometry";
import { ElevationLayer } from "../../map";
import { IGeo2 } from "core/geography";
import { Observable } from "core/events";

class ImageLayerView {
    source: ImageLayer;
    tiles: Array<ITile<HTMLImageElement>> = [];

    public constructor(layer: ImageLayer) {
        this.source = layer;
    }

    public add(tile: ITile<HTMLImageElement>): void {
        this.tiles.push(tile);
    }

    public remove(tile: ITile<HTMLImageElement>): void {
        let index = this.tiles.indexOf(tile);
        if (index >= 0) {
            this.tiles.splice(index, 1);
        }
    }

    public draw(ctx: ICanvasRenderingContext, center?: ICartesian2): void {
        this.source.draw(ctx, this.tiles, center);
    }
}

class Map3DTextureItem implements IDisposable {
    isDirty: boolean = false;
    elevationLayer: ElevationLayer;
    elevationTile: ITile<IDemInfos>;
    display: CanvasDisplay;
    textureTarget: ITexture3Layer;
    views: Array<ImageLayerView> = [];

    // caches
    _metrics: ITileMetrics;
    _nav: ITileNavigationState;
    _geo: IGeo2;

    // the drawing context
    context: Nullable<CanvasRenderingContext2D>;

    public constructor(layer: ElevationLayer, elevation: ITile<IDemInfos>, target: ITexture3Layer, display: CanvasDisplay) {
        this.elevationLayer = layer;
        this.elevationTile = elevation;
        this.textureTarget = target;

        this.display = display;
        this.context = display.getContext();

        this._metrics = this.elevationLayer.metrics;
        this._nav = this.elevationLayer.navigation;
        this._geo = this.elevationTile.bounds?.center ?? this._nav.center;
    }

    public addTile(layer: ImageLayer, tile: ITile<HTMLImageElement>): void {
        let layerView = this.views.find((item) => item.source === layer);
        if (!layerView) {
            layerView = new ImageLayerView(layer);
            this.views.push(layerView);
            // sort the layers by zindex
            this.views.sort((a, b) => b.source.zindex - a.source.zindex);
        }
        layerView.add(tile);
        this.isDirty = true;
    }

    public removeTile(layer: ImageLayer, tile: ITile<HTMLImageElement>): void {
        let layerView = this.views.find((item) => item.source === layer);
        if (layerView) {
            layerView.remove(tile);
            this.isDirty = true;
        }
    }

    public update(layer: ITile<HTMLImageElement>): void {
        this.isDirty = true;
    }

    public dispose(): void {
        this.textureTarget.release();
    }

    public validate(): void {
        if (this.isDirty) {
            this._doValidate();
            this.isDirty = false;
        }
    }

    // draw the map - remember that the map is a texture and the navigation features, such scale and azimuth are
    // not part of the texture but part of the 3D map.
    // however the overall logic is the same as the 2D map.
    protected _draw(ctx: ICanvasRenderingContext, x: number, y: number, w: number, h: number): void {
        ctx.save();

        // we move the reference to the center of the display
        ctx.translate(x + w / 2, y + h / 2);

        // create clipping
        ctx.beginPath();
        ctx.rect(-w / 2, -h / 2, w, h);
        ctx.clip();

        // clear the canvas
        ctx.clearRect(-w / 2, -h / 2, w, h);

        const center = this._metrics.getLatLonToPointXY(this._geo.lat, this._geo.lon, this._nav.lod);

        for (let layer of this.views) {
            if (layer.source.enabled === false || layer.tiles.length === 0) {
                continue;
            }
            ctx.save();

            ctx.globalAlpha = layer.source.alpha ?? 1;
            ctx.fillStyle = layer.source.background ?? Context2DTileMap.DefaultBackground.toHexString();

            layer.draw(ctx, center);

            ctx.restore();
        }
        ctx.restore();
    }

    protected _getTileCenter(): ICartesian2 {
        return { x: 0, y: 0 };
    }

    protected _doValidate(): void {
        const ctx: ICanvasRenderingContext = this.context as ICanvasRenderingContext;
        if (ctx) {
            const res = this.display;
            const x = 0;
            const y = 0;
            const w = res.displayWidth;
            const h = res.displayHeight;

            this._draw(ctx, x, y, w, h);
            this.textureTarget.update(ctx.getImageData(x, y, w, h));
        }
    }
}

export class ElevationTileAddedEventArgs {
    tile: ITile<IDemInfos>;
    depth: number;

    public constructor(tile: ITile<IDemInfos>, depth: number) {
        this.tile = tile;
        this.depth = depth;
    }
}

/// <summary>
/// Base class for Map3D related texture. This class is intended to attach texture layer to a Map3D object.
/// The idea is that despite to generate a whole texture for the entire map, we split the texture into smaller chunks which are
/// corresponding to each underlying 3D elevation tiles. each of these chunk are then part of subimage of the texture 3D.
/// The texture is listening the elevation layer to bind a sub texture item to the elevation tile.
/// The texture is listening the texture layer to update the sub texture item when the texture layer is updated.
/// </summary>
export class Map3DTexture extends Texture3 implements ITargetBlock<ITile<Map3dTileContentType>> {
    _items: Map<string, Map3DTextureItem>;
    _beforeRenderMethod: () => void;
    _elevationTileReady?: Observable<ElevationTileAddedEventArgs>;

    public constructor(scene: Scene, options: ITexture3CreationOptions) {
        super(scene, options);
        this._beforeRenderMethod = this._beforeRender.bind(this);
        this._items = new Map<string, Map3DTextureItem>();
        scene.registerBeforeRender(this._beforeRenderMethod);
    }

    public elevationTileReadyObservable(): Observable<ElevationTileAddedEventArgs> {
        if (!this._elevationTileReady) {
            this._elevationTileReady = new Observable<ElevationTileAddedEventArgs>();
        }
        return this._elevationTileReady;
    }

    public added(eventData: IPipelineMessageType<ITile<Map3dTileContentType>>, eventState: EventState): void {
        for (let tile of eventData) {
            // this is Layer
            if (tile.content instanceof HTMLImageElement) {
                this._imageAdded(eventState.target, <ITile<HTMLImageElement>>tile);
                continue;
            }
            // this is DEM
            const dem = <ITile<IDemInfos>>tile;
            this._demAdded(eventState.target, dem);
        }
    }

    public removed(eventData: IPipelineMessageType<ITile<Map3dTileContentType>>, eventState: EventState): void {
        for (let tile of eventData) {
            // this is Layer
            if (tile.content instanceof HTMLImageElement) {
                this._imageRemoved(eventState.target, <ITile<HTMLImageElement>>tile);
                continue;
            }
            // this is DEM
            this._demRemoved(<ITile<IDemInfos>>tile);
        }
    }

    public updated(eventData: IPipelineMessageType<ITile<Map3dTileContentType>>, eventState: EventState): void {
        for (let tile of eventData) {
            // this is Layer
            if (tile.content instanceof HTMLImageElement) {
                this._imageUpdated(eventState.target, <ITile<HTMLImageElement>>tile);
                continue;
            }
            // this is DEM
            this._demUpdated(<ITile<IDemInfos>>tile);
        }
    }

    public dispose(): void {
        for (let item of this._items.values()) {
            item.dispose();
        }
        this._items.clear();
        this.getScene()?.unregisterBeforeRender(this._beforeRenderMethod);
    }

    public getTextureDepth(quadkey: string): number {
        const item = this._items.get(quadkey);
        if (item) {
            return item.textureTarget.depth;
        }
        return -1;
    }

    protected _demAdded(layer: ElevationLayer, eventData: ITile<IDemInfos>): void {
        const target = this.reserve();
        if (!target) {
            throw "Unable to reserve a layer for the elevation tile.";
        }
        let item = new Map3DTextureItem(layer, eventData, target, this._createCanvas());
        this._items.set(eventData.address.quadkey, item);
        this._elevationTileReady?.notifyObservers(new ElevationTileAddedEventArgs(eventData, target.depth), -1, this, this);
    }

    protected _createCanvas(): CanvasDisplay {
        const c = this.getScene()?.getEngine().createCanvas(this.width, this.height);
        if (c instanceof HTMLCanvasElement) {
            return new CanvasDisplay(c);
        }
        throw "Unable to create a canvas for the texture.";
    }

    protected _demRemoved(eventData: ITile<IDemInfos>): void {
        const i = this._items.get(eventData.address.quadkey);
        if (i) {
            this._items.delete(eventData.address.quadkey);
            i.dispose();
        }
    }

    protected _demUpdated(eventData: ITile<IDemInfos>): void {
        /* nothing to do */
    }

    protected _imageAdded(src: ImageLayer, eventData: ITile<HTMLImageElement>): void {
        // select the items that are impacted by the layer using the bounding box
        let impactedItems = this._selectItems((item) => {
            // check if the layer is in the bounding box of the elevation
            if (item.elevationTile.bounds && eventData.bounds) {
                return item.elevationTile.bounds.intersect(eventData.bounds);
            }
            return false;
        });
        // update the items
        for (let item of impactedItems) {
            item.addTile(src, eventData);
        }
    }

    protected *_selectItems(delegate?: (i: Map3DTextureItem) => boolean): IterableIterator<Map3DTextureItem> {
        for (let item of this._items.values()) {
            if (delegate === undefined || delegate(item)) {
                yield item;
            }
        }
    }

    protected _imageRemoved(src: ImageLayer, eventData: ITile<HTMLImageElement>): void {
        // select the items it's already own the data
        let impactedItems = this._selectItems((item) => {
            return item.views.find((layer) => layer.source === src) != undefined;
        });
        // remove the items
        for (let item of impactedItems) {
            item.removeTile(src, eventData);
        }
    }

    protected _imageUpdated(src: ImageLayer, eventData: ITile<HTMLImageElement>): void {
        // select the items it's already own the data
        let impactedItems = this._selectItems((item) => {
            return item.views.find((layer) => layer.source === src) != undefined;
        });
        // update the items
        for (let item of impactedItems) {
            item.isDirty = true;
        }
    }

    // this method is called before the render loop to validate the texture
    protected _beforeRender() {
        for (let item of this._items.values()) {
            item.validate();
        }
    }
}
