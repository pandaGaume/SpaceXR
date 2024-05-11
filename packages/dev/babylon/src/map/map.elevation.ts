import { IDemInfos } from "core/dem";
import { ITile, ITileDisplay, ITileMap, ITileMapLayer, ITileMetrics, ITileNavigationState, ImageLayer, TileMapBase } from "core/tiles";
import { ElevationLayer, ElevationTile } from "./map.elevation.layer";
import { EventState, Observable } from "core/events";
import { Nullable, TransformNode } from "@babylonjs/core";
import { IGeo2 } from "core/geography";
import { Map3dMaterial } from "../materials";

// we use type of IDemInfos for elevation and rgb images for the texture.
export type Map3dTileContentType = IDemInfos | HTMLImageElement;

// Idea behind the map3d is to provide a 3D map with elevation and texture layers. Texture layers are images which will be combined
// into a single texture per elevation tile. For the purpose we will use WebMapTexture approach to create a texture layer for each elevation tile.
// This texture will be then ehanced to allow layer (surface drawing) beeing added dynamically and also adaptative resolution based on the distance from camera.
// This adapdative resolution will be based on the distance from camera and the resolution of the texture ans MUST be optional. User may update his own attenuation
// formula to adapt the resolution based on his own needs. Default is no attenuation.
// Same logic applies to the elevation layer where the resolution of the elevation tile will be adapted based on the distance from camera. This Implies that the elevation
// mesh beeing adapted with connection triangle from one resolution to another one. Default is no attenuation.
// The shape of the elevation mesh will be defined by the shader, which will transform the point based on Web Mercator or spherical projection (using ENU coordinate).
// for both, the coordinate are still limites to Web Mercator limits which are +/- 85.051129 degrees latitude and +/- 180 degrees longitude.
export class Map3d extends TransformNode implements ITileMap<Map3dTileContentType, ITileMapLayer<Map3dTileContentType>, Map3d> {
    // the map logic. This is the main entry point for the map API.
    private _map: TileMapBase<Map3dTileContentType, ITileMapLayer<Map3dTileContentType>>;
    // only meshes have materials, we will use this material to apply to the elevation layer which own a mesh.
    private _material: Nullable<Map3dMaterial>;

    public constructor(name: string, display?: ITileDisplay, material: Nullable<Map3dMaterial> = null) {
        super(name);
        this._material = material;
        this._map = new TileMapBase(name, display);
        this._map.linkTo(this);
    }

    // TILE map API
    public setViewMap(center: IGeo2 | Array<number>, zoom?: number, rotation?: number): Map3d {
        this._map.setViewMap(center, zoom, rotation);
        return this;
    }
    public zoomMap(delta: number): Map3d {
        this._map.zoomMap(delta);
        return this;
    }
    public zoomInMap(delta: number): Map3d {
        this._map.zoomInMap(delta);
        return this;
    }
    public zoomOutMap(delta: number): Map3d {
        this._map.zoomOutMap(delta);
        return this;
    }
    public translateUnitsMap(tx: number, ty: number, metrics?: ITileMetrics): Map3d {
        this._map.translateUnitsMap(tx, ty, metrics);
        return this;
    }
    public translateMap(lat: IGeo2 | Array<number> | number, lon?: number): Map3d {
        this._map.translateMap(lat, lon);
        return this;
    }
    public rotateMap(r: number): Map3d {
        this._map.rotateMap(r);
        return this;
    }
    public get navigation(): ITileNavigationState {
        return this._map.navigation;
    }
    public get layerAddedObservable(): Observable<ITileMapLayer<Map3dTileContentType>> {
        return this._map.layerAddedObservable;
    }
    public get layerRemovedObservable(): Observable<ITileMapLayer<Map3dTileContentType>> {
        return this._map.layerRemovedObservable;
    }
    public getLayers(predicate?: (l: ITileMapLayer<Map3dTileContentType>) => boolean, sorted?: boolean): IterableIterator<ITileMapLayer<Map3dTileContentType>> {
        return this._map.getLayers(predicate, sorted);
    }
    public addLayer(layer: ITileMapLayer<Map3dTileContentType>): void {
        this._map.addLayer(layer);
        if (layer instanceof ElevationLayer) {
            this._onElevationLayerAdded(layer);
            return;
        }
        if (layer instanceof ImageLayer) {
            this._onTextureLayerAdded(layer);
        }
    }
    public removeLayer(layer: ITileMapLayer<Map3dTileContentType>): void {
        this._map.removeLayer(layer);
        if (layer instanceof ElevationLayer) {
            this._onElevationLayerRemoved(layer);
            return;
        }
        if (layer instanceof ImageLayer) {
            this._onTextureLayerRemoved(layer);
        }
    }
    // END TILE map API

    public dispose() {
        super.dispose();
        this._map?.dispose();
    }

    public get display(): Nullable<ITileDisplay> {
        return this._map.display;
    }

    /// TargetBlock
    public added(eventData: Array<ElevationTile> | Array<ITile<HTMLImageElement>>, eventState: EventState): void {
        for (const tile of eventData) {
            if (!tile) {
                continue;
            }
            if (tile instanceof ElevationTile) {
                this._onElevationAdded(tile);
                continue;
            }

            this._onTextureAdded(tile);
        }
    }
    public removed(eventData: Array<ElevationTile> | Array<ITile<HTMLImageElement>>, eventState: EventState): void {
        for (const tile of eventData) {
            if (!tile) {
                continue;
            }
            if (tile instanceof ElevationTile) {
                this._onElevationRemoved(tile);
                continue;
            }
            this._onTextureRemoved(tile);
        }
    }
    public updated(eventData: Array<ElevationTile> | Array<ITile<HTMLImageElement>>, eventState: EventState): void {
        for (const tile of eventData) {
            if (!tile) {
                continue;
            }
            if (tile instanceof ElevationTile) {
                this._onElevationUpdated(tile);
                continue;
            }
            this._onTextureUpdated(tile);
        }
    }
    /// End TargetBlock

    /// handlers
    protected _onElevationLayerAdded(layer: ElevationLayer): void {
        // register the root of the layer under the map
        layer.root.parent = this;
        if (this._material) {
            layer.mesh.material = this._material;
        }
    }

    protected _onElevationLayerRemoved(layer: ElevationLayer): void {
        // unregister the root of the layer from the map
        layer.root.parent = null;
        layer.mesh.material = null;
    }

    protected _onTextureLayerAdded(layer: ImageLayer): void {
        /* nothing to do here - overrided by subclasses */
    }

    protected _onTextureLayerRemoved(layer: ImageLayer): void {
        /* nothing to do here - overrided by subclasses */
    }

    protected _onElevationAdded(tile: ElevationTile): void {
        /* nothing to do here - overrided by subclasses */
    }

    protected _onElevationRemoved(tile: ElevationTile): void {
        /* nothing to do here - overrided by subclasses */
    }

    protected _onElevationUpdated(tile: ElevationTile): void {
        /* nothing to do here - overrided by subclasses */
    }

    protected _onTextureAdded(tile: ITile<HTMLImageElement>): void {
        /* nothing to do here - overrided by subclasses */
    }

    protected _onTextureRemoved(tile: ITile<HTMLImageElement>): void {
        /* nothing to do here - overrided by subclasses */
    }

    protected _onTextureUpdated(tile: ITile<HTMLImageElement>): void {
        /* nothing to do here - overrided by subclasses */
    }
}
