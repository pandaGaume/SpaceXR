import { Nullable, Scene, TransformNode, Node } from "@babylonjs/core";
import {
    IHasNavigationState,
    IHasTileMapLayerContainer,
    ITileMapLayer,
    ITileMapLayerContainer,
    ITileMetrics,
    ITileNavigationApi,
    ITileNavigationState,
    ImageLayer,
    ImageLayerContentType,
    LayerContainer,
    TileNavigationState,
} from "core/tiles";
import { Observer, EventState } from "core/events";

import { IGeo2 } from "core/geography";
import { ISize2, Size2 } from "core/geometry";
import { IPointerSource, PointerController } from "core/map";
import { HolographicDisplay } from "../display";
import { Map3dElevationHost } from "./map.elevation.host";
import { ElevationLayer } from "./map.elevation.layer";
import { IDemInfos } from "core/dem";
import { TextUtils } from "core/utils";

export type Map3dTextureContentType = ImageLayerContentType;
export type Map3dElevationContentType = IDemInfos;
export type Map3dContentType = Map3dTextureContentType | Map3dElevationContentType;

export interface IMap3DMetrics {
    resolution: Size2;
    dimension: Size2;
    scale: number;
    spatialResolution: Size2;

    getLevelOfDetail(center: IGeo2, metrics: ITileMetrics): number;
}

export interface IMap3dOptions {
    metrics: IMap3DMetrics;
}

/// <summary>
/// The 3D map class.
/// The map has to be attached to a display object to be able to work. The display object is the holographic display which has to be somewhere in the upper hierarchy BEFORE the map object is parented.
/// </summary>
export class Map3d extends TransformNode implements IHasTileMapLayerContainer<Map3dContentType, ITileMapLayer<Map3dContentType>>, ITileNavigationApi<Map3d>, IHasNavigationState {
    public static DefaultTextureSize: number = 1024;
    public static HostSuffix: string = "host";

    // the map logic. This is the main entry point for the map API.
    private _layers: ITileMapLayerContainer<Map3dContentType, ITileMapLayer<Map3dContentType>>;
    private _elevationLayersView: ITileMapLayerContainer<Map3dElevationContentType, ITileMapLayer<Map3dElevationContentType>>;
    private _textureLayersView: ITileMapLayerContainer<Map3dTextureContentType, ITileMapLayer<Map3dTextureContentType>>;
    private _addLayerObserver: Nullable<Observer<ITileMapLayer<Map3dContentType>>>;
    private _removeLayerObserver: Nullable<Observer<ITileMapLayer<Map3dContentType>>>;

    private _targetDisplay: Nullable<HolographicDisplay> = null;
    private _controller: Nullable<PointerController<IPointerSource>> = null;
    private _ownController = false;

    private _elevationHosts: Map<string, Map3dElevationHost>;

    private _navigation: ITileNavigationState;
    private _navigationUpdatedObserver: Nullable<Observer<ITileNavigationState>>;

    public constructor(name: string, options: IMap3dOptions, scene: Scene) {
        super(name, scene);

        // create the layer container
        this._layers = new LayerContainer<Map3dContentType, ITileMapLayer<Map3dContentType>>();
        this._elevationLayersView = new LayerContainer<Map3dElevationContentType, ITileMapLayer<Map3dElevationContentType>>();
        this._textureLayersView = new LayerContainer<Map3dTextureContentType, ITileMapLayer<Map3dTextureContentType>>();
        this._addLayerObserver = this._layers.layerAddedObservable.add(this._onLayerAdded.bind(this));
        this._removeLayerObserver = this._layers.layerRemovedObservable.add(this._onLayerRemoved.bind(this));
        this._elevationHosts = new Map<string, Map3dElevationHost>();
        this._navigation = this._createNavigationState();
        this._navigationUpdatedObserver = this._navigation.stateChangedObservable.add(this._onNavigationUpdatedInternal.bind(this));
    }

    /// #region IHasNavigationState
    public get navigation(): ITileNavigationState {
        return this._navigation;
    }
    /// #endregion IHasNavigationState

    /// #region ITileNavigationApi
    public setViewMap(center: IGeo2 | number[], zoom?: number | undefined, rotation?: number | undefined): Map3d {
        this._navigation.setViewMap(center, zoom, rotation).validate(); // validate the navigation state, which will trigger the state changed event;
        return this;
    }
    public zoomMap(delta: number): Map3d {
        this._navigation.zoomMap(delta).validate(); // validate the navigation state, which will trigger the state changed event;
        return this;
    }
    public zoomInMap(delta: number): Map3d {
        this._navigation.zoomInMap(delta).validate(); // validate the navigation state, which will trigger the state changed event;
        return this;
    }
    public zoomOutMap(delta: number): Map3d {
        this._navigation.zoomOutMap(delta).validate(); // validate the navigation state, which will trigger the state changed event;
        return this;
    }
    public translateUnitsMap(tx: number, ty: number, metrics?: ITileMetrics | undefined): Map3d {
        this._navigation.translateUnitsMap(tx, ty, metrics).validate(); // validate the navigation state, which will trigger the state changed event
        return this;
    }
    public translateMap(dlat: number | IGeo2 | number[], dlon?: number | undefined): Map3d {
        this._navigation.translateMap(dlat, dlon).validate(); // validate the navigation state, which will trigger the state changed event;
        return this;
    }
    public rotateMap(r: number): Map3d {
        this._navigation.rotateMap(r);
        return this;
    }
    /// #endregion ITileNavigationApi

    /// #region IHasTileMapLayerContainer
    public get layerContainer(): ITileMapLayerContainer<Map3dContentType, ITileMapLayer<Map3dContentType>> {
        return this._layers;
    }
    /// #endregion IHasTileMapLayerContainer

    public dispose() {
        super.dispose();
        this._controller?.dispose();
        this._addLayerObserver?.disconnect();
        this._removeLayerObserver?.disconnect();
        for (const host of this._elevationHosts.values()) {
            host.dispose();
        }
        this._elevationHosts.clear();
        this._elevationLayersView.clear();
        this._textureLayersView.clear();
        this._layers.clear();

        this._navigationUpdatedObserver?.disconnect();
    }

    public withDisplay(display: HolographicDisplay): Map3d {
        if (this._targetDisplay === display) return this;

        this._targetDisplay = display;
        for (const host of this._elevationHosts.values()) {
            host.bindDisplay(display);
        }
        this.parent = display.context3d;
        return this._withPointerControl(this._targetDisplay.pointerSource);
    }

    protected _searchForDisplay(node: Nullable<Node>): Nullable<HolographicDisplay> {
        if (!node) return null;
        if (node instanceof HolographicDisplay) return node;
        return this._searchForDisplay(node.parent);
    }

    protected _createNavigationState(): ITileNavigationState {
        return new TileNavigationState();
    }

    protected _withPointerControl(controller: PointerController<IPointerSource> | IPointerSource): Map3d {
        if (this._controller === controller) return this;

        if (this._controller && this._ownController) {
            this._controller.dispose();
        }
        if (controller instanceof PointerController) {
            this._controller = controller;
        } else {
            this._controller = new PointerController(controller, this);
            this._ownController = true;
        }
        return this;
    }

    ///#region layer handler
    protected _onLayerAdded(layer: ITileMapLayer<Map3dContentType>): void {
        if (layer instanceof ElevationLayer) {
            this._addedElevationLayer(layer);
            return;
        }
        if (layer instanceof ImageLayer) {
            this._addedImageLayer(layer as ITileMapLayer<Map3dTextureContentType>);
        }
    }

    protected _onLayerRemoved(layer: ITileMapLayer<Map3dContentType>): void {
        if (layer instanceof ElevationLayer) {
            this._removedElevationLayer(layer);
            return;
        }
        if (layer instanceof ImageLayer) {
            this._removedImageLayer(layer as ITileMapLayer<Map3dTextureContentType>);
        }
    }
    ///#endregion layer handler

    protected _addedElevationLayer(layer: ElevationLayer): void {
        this._elevationLayersView.addLayer(layer);
        layer.navigation.syncWith(this.navigation);

        // create the elevation host
        const host = this._createElevationHost(layer);
        if (this._targetDisplay) {
            host.bindDisplay(this._targetDisplay);
        }
        host.parent = this;
        this._elevationHosts.set(layer.name, host);

        this._updateLayerWithDisplayAndNavigation(layer);
    }

    protected _createElevationHost(layer: ElevationLayer): Map3dElevationHost {
        const name = TextUtils.BuildNameWithSuffix(layer.name, Map3d.HostSuffix);
        const source = layer;
        const options = layer;
        const enabled = layer.enabled;
        return new Map3dElevationHost(name, this._textureLayersView, source, options, enabled);
    }

    protected _removedElevationLayer(layer: ElevationLayer): void {
        this._elevationLayersView.removeLayer(layer);
        layer.navigation.syncWith(null); // pass null to reset

        // remove the elevation host
        const host = this._elevationHosts.get(layer.name);
        if (host) {
            this._elevationHosts.delete(layer.name);
            host.dispose();
        }
    }

    protected _addedImageLayer(layer: ITileMapLayer<Map3dTextureContentType>): void {
        this._textureLayersView.addLayer(layer);
        // this._updateLayerWithDisplayAndNavigation(layer);
    }

    protected _removedImageLayer(layer: ITileMapLayer<Map3dTextureContentType>): void {
        this._textureLayersView.removeLayer(layer);
    }

    private _onNavigationUpdatedInternal(event: ITileNavigationState, state: EventState): void {
        for (const layer of this._layers.getLayers()) {
            this._updateLayerWithDisplayAndNavigation(layer);
        }
    }

    private _updateLayerWithDisplayAndNavigation(layer: ElevationLayer | ITileMapLayer<Map3dTextureContentType> | ITileMapLayer<Map3dContentType>) {
        if (this._targetDisplay) {
            let size: ISize2 = this._targetDisplay;
            if (layer.zoomOffset) {
                const s = Math.pow(2, Math.abs(layer.zoomOffset)); // Always positive offset supported.
                size = new Size2(size.width * s, size.height * s);
            }
            layer.setContext(this._navigation, size);
        }
    }
}
