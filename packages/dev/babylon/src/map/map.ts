import { ITileMapLayer, ITileMapLayerView, ITileNavigationState, TileMapBase, TileNavigationState, TileView } from "core/tiles";
import { IElevationOptions, IMap3D, IsElevationHost, Map3DContentType } from "./map.interfaces";
import { TransformNode } from "@babylonjs/core";
import { Nullable } from "core/types";
import { EventState, PropertyChangedEventArgs } from "core/events";
import { ElevationHost, ElevationLayerView } from "./map.layer.view.elevation";
import { ElevationLayer } from "../dem";
import { Cartesian3, ICartesian3, ISize2 } from "core/geometry";

export class Map3D extends TileMapBase<Map3DContentType> implements IMap3D, IElevationOptions {
    public static DefaultGridSize: number = 32;
    public static DefaultExageration: number = 1.0;

    public static ROOT_SUFFIX = "root";

    _root: TransformNode;
    _gridSize: number | ISize2;
    _offset?: ICartesian3;
    _exageration?: number;

    public constructor(root: TransformNode) {
        super();
        this._root = root;
        this._gridSize = Map3D.DefaultGridSize;
        this._offset = Cartesian3.Zero();
        this._exageration = Map3D.DefaultExageration;
    }

    public get name(): string {
        return this._root.name;
    }

    public get root(): TransformNode {
        return this._root;
    }

    public get gridSize(): number | ISize2 {
        return this._gridSize;
    }

    public set gridSize(value: number | ISize2) {
        this._gridSize = value;
    }

    public get offset(): ICartesian3 | undefined {
        return this._offset;
    }

    public set offset(value: ICartesian3 | undefined) {
        this._offset = value;
    }

    public get exageration(): number | undefined {
        return this._exageration;
    }

    public set exageration(value: number | undefined) {
        this._exageration = value;
    }

    /**
     * This is where we create different views, depending the type of layer.
     * Elevation type layer will create specific view, which hold the necessary mechanism to create grid instances
     * @param layer
     * @returns the layer view created
     */
    protected _buildLayerView(layer: ITileMapLayer<Map3DContentType>): Nullable<ITileMapLayerView<any>> {
        if (layer instanceof ElevationLayer) {
            return new ElevationLayerView(layer, this._display, new TileView());
        }
        return new ElevationHost(this._root, this, <any>layer, this.display, this.view);
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
                for (const l of this.layerViews) {
                    if (l instanceof ElevationHost) {
                        continue;
                    }
                    l.linkTo(<any>v.elevationsTarget);
                }
                continue;
            }
            for (const l of this.layerViews) {
                if (l instanceof ElevationHost) {
                    v.linkTo(<any>l.elevationsTarget);
                    continue;
                }
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
