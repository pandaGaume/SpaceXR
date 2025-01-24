import { ITileMapLayer, ITileMapLayerView, ITileNavigationState, TileMapBase, TileMapLayerView, TileNavigationState, TileView } from "core/tiles";
import { IMap3D, IsElevationHost, Map3DContentType } from "./map.interfaces";
import { TransformNode } from "@babylonjs/core";
import { Nullable } from "core/types";
import { EventState, PropertyChangedEventArgs } from "core/events";
import { ElevationHost } from "./map.layer.view.elevation";
import { ElevationLayer } from "../dem";

export class Map3D extends TileMapBase<Map3DContentType> implements IMap3D {
    public static DefaultLodElevationShift = 3;

    public static ROOT_SUFFIX = "root";

    _root: TransformNode;

    public constructor(root: TransformNode) {
        super();
        this._root = root;
    }

    public get name(): string {
        return this._root.name;
    }

    /**
     * This is where we create different views, depending the type of layer.
     * Elevation type layer will create specific view, which hold the necessary mechanism to create grid instances
     * @param layer
     * @returns the layer view created
     */
    protected _buildLayerView(layer: ITileMapLayer<Map3DContentType>): Nullable<ITileMapLayerView<any>> {
        if (layer instanceof ElevationLayer) {
            return new TileMapLayerView(layer, this._display, new TileView());
        }
        return new ElevationHost(this._root, <any>layer, this.display, this.view);
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
    protected _onLayerViewAdded(eventData: Array<ITileMapLayerView<Map3DContentType>>, eventState: EventState): void {
        super._onLayerViewAdded(eventData, eventState);
        for (const v of eventData) {
            if (IsElevationHost(v)) {
                v.tilesRoot.parent = this._root;
            }
        }
    }

    // unbind the tile root from this root
    protected _onLayerViewRemoved(eventData: Array<ITileMapLayerView<Map3DContentType>>, eventState: EventState): void {
        super._onLayerViewRemoved(eventData, eventState);
        for (const v of eventData) {
            if (IsElevationHost(v)) {
                v.tilesRoot.parent = null;
            }
        }
    }
}
