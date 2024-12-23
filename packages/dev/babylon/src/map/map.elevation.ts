import { IDemInfos } from "core/dem";
import { IDisplay, ITileMapLayer, ITileMapLayerView, ITileNavigationState, TileMapBase, TileNavigationState } from "core/tiles";
import { ElevationMapContentType, IElevationHost, IElevationMap, IsElevationHost, IsElevationLayer } from "./map.elevation.interfaces";
import { ElevationHost } from "./map.elevation.host";
import { Nullable, TransformNode } from "@babylonjs/core";
import { EventState, PropertyChangedEventArgs } from "core/events";

export class ElevationMap extends TileMapBase<ElevationMapContentType> implements IElevationMap {
    _root: TransformNode;

    public constructor(root: TransformNode, display?: Nullable<IDisplay>, nav?: Nullable<ITileNavigationState>) {
        super(display, nav);
        this._root = root;
        // lazzy initialization.
        this._onNavigationBinded(this.navigationState);
        this._onDisplayBinded(this.display);
    }

    /**
     * This is where we create different views, depending the type of layer.
     * Elevation type layer will create specific view, which hold the necessary mechanism to create grid instances
     * @param layer
     * @returns the layer view created
     */
    protected _buildLayerView(layer: ITileMapLayer<ElevationMapContentType>): ITileMapLayerView<any> {
        if (IsElevationLayer(layer)) {
            return this._buildElevationHost(layer);
        }
        return super._buildLayerView(layer);
    }

    protected _buildElevationHost(layer: ITileMapLayer<IDemInfos>): IElevationHost {
        return new ElevationHost(layer, this._display, this._view);
    }

    // when navigation propertie's changed
    protected _onNavigationPropertyChanged(event: PropertyChangedEventArgs<ITileNavigationState, unknown>, state: EventState): void {
        super._onNavigationPropertyChanged(event, state);
        if (event.propertyName === TileNavigationState.AZIMUTH_PROPERTY_NAME) {
            this._rotateMap(event.source);
        }
    }

    protected _rotateMap(nav: Nullable<ITileNavigationState>) {
        if (this._root) {
            this._root.rotation.z = this.navigationState?.azimuth.radian ?? 0;
        }
    }

    // when the navigation object has changed - very unlikely.
    protected _onNavigationBinded(nav: Nullable<ITileNavigationState>): void {
        super._onNavigationBinded(nav);
        this._rotateMap(nav);
    }

    // bind the tile root to this root
    protected _onLayerViewAdded(eventData: Array<ITileMapLayerView<ElevationMapContentType>>, eventState: EventState): void {
        super._onLayerViewAdded(eventData, eventState);
        for (const v of eventData) {
            if (IsElevationHost(v)) {
                v.tilesRoot.parent = this._root;
            }
        }
    }

    // unbind the tile root from this root
    protected _onLayerViewRemoved(eventData: Array<ITileMapLayerView<ElevationMapContentType>>, eventState: EventState): void {
        super._onLayerViewRemoved(eventData, eventState);
        for (const v of eventData) {
            if (IsElevationHost(v)) {
                v.tilesRoot.parent = null;
            }
        }
    }
}
