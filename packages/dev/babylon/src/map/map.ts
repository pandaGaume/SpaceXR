import { IDisplay, ITileMapLayer, ITileMapLayerView, ITileNavigationState, TileMapBase, TileNavigationState } from "core/tiles";
import { IElevationGridFactory, IElevationHost, IElevationHostOptions, IMap3D, IMap3dMaterial, IsTileMapLayerViewWithElevation, Map3DContentType } from "./map.interfaces";
import { Material, Mesh, Scene, TransformNode, VertexData } from "@babylonjs/core";
import { Nullable } from "core/types";
import { EventState, PropertyChangedEventArgs } from "core/events";
import { Map3dMaterial } from "../materials";
import { TextUtils } from "core/utils";
import { ElevationGridFactory } from "./map.grid.factory";
import { TerrainGridOptions, TerrainGridOptionsBuilder } from "core/meshes";
import { IsHolographicBounds } from "../display";
import { TileMapLayerViewWithElevation } from "./map.layer.view";

export class Map3D extends TileMapBase<Map3DContentType> implements IMap3D, IElevationHost {
    public static TEMPLATE_SUFFIX = "grid";
    public static ROOT_SUFFIX = "root";
    public static MATERIAL_SUFFIX = "material";
    public static INSTANCE_ROOT_NAME = "root";

    _root: TransformNode;

    // the grid model
    _grid: Mesh;
    _material: IMap3dMaterial;

    public constructor(root: TransformNode, options?: IElevationHostOptions) {
        super();
        this._root = root;

        // build the template ( including the material)
        const scene = this._root.getScene();
        this._grid = this._buildTemplate(options?.gridOptions, scene);
        this._material = this._buildMaterial(this._buildMaterialName() ?? this.name, scene);
        if (this._material && this._material instanceof Material) {
            this._grid.material = this._material;
        }
        this._grid.setEnabled(false);
    }

    public get name(): string {
        return this._root.name;
    }

    public get grid(): Mesh {
        return this._grid;
    }

    public get material(): IMap3dMaterial {
        return this._material;
    }

    /**
     * This is where we create different views, depending the type of layer.
     * Elevation type layer will create specific view, which hold the necessary mechanism to create grid instances
     * @param layer
     * @returns the layer view created
     */
    protected _buildLayerView(layer: ITileMapLayer<Map3DContentType>): Nullable<ITileMapLayerView<any>> {
        return new TileMapLayerViewWithElevation(this, <any>layer, this.display, this.view, this._root.getScene());
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
            if (IsTileMapLayerViewWithElevation(v)) {
                v.tilesRoot.parent = this._root;
            }
        }
    }

    // unbind the tile root from this root
    protected _onLayerViewRemoved(eventData: Array<ITileMapLayerView<Map3DContentType>>, eventState: EventState): void {
        super._onLayerViewRemoved(eventData, eventState);
        for (const v of eventData) {
            if (IsTileMapLayerViewWithElevation(v)) {
                v.tilesRoot.parent = null;
            }
        }
    }

    protected _buildTemplate(options?: TerrainGridOptions, scene?: Scene): Mesh {
        const o = this._buildTerrainGridOptions(options);
        const mesh = this._buildMesh(this._buildTemplateName() ?? this._root.name, scene);
        const gridFactory = this._buildGridFactory() ?? this._buildGridFactoryInternal();
        const grid = gridFactory.buildTopology(o);
        if (grid instanceof VertexData) {
            grid.applyToMesh(mesh);
        } else {
            const data = new VertexData();
            data.indices = grid.indices;
            data.normals = grid.normals;
            data.positions = grid.positions;
            data.uvs = grid.uvs;
            data.applyToMesh(mesh);
        }
        return mesh;
    }

    protected _buildTerrainGridOptions(options?: TerrainGridOptions): TerrainGridOptions {
        const o =
            options ??
            new TerrainGridOptionsBuilder()
                .withColumns(TerrainGridOptions.DefaultGridSize + 1)
                .withRows(TerrainGridOptions.DefaultGridSize + 1)
                .build();
        // ensure uvs are created
        o.uvs = true;
        // disabling normals
        o.normals = false;
        return o;
    }

    protected _buildMesh(name: string, scene?: Scene): Mesh {
        const mesh = new Mesh(name, scene);
        return mesh;
    }

    protected _buildGridFactory(): IElevationGridFactory {
        return this._buildGridFactoryInternal();
    }

    protected _buildQualifiedName(n: string): string {
        if (this.name && this.name !== "") {
            return `${this._root.name}:${n}`;
        }
        return n;
    }

    protected _buildTemplateName(): string {
        return this._buildQualifiedName(TextUtils.BuildNameWithSuffix(this.name, Map3D.TEMPLATE_SUFFIX));
    }

    protected _buildMaterialName(): string {
        return TextUtils.BuildNameWithSuffix(this._buildTemplateName(), Map3D.MATERIAL_SUFFIX);
    }

    protected _buildMaterial(name: string, scene?: Scene): IMap3dMaterial {
        return new Map3dMaterial(name, scene);
    }

    protected _onDisplayBinded(display: IDisplay): void {
        super._onDisplayBinded(display);
        this._bindDisplayInternal(display);
    }

    protected _bindDisplayInternal(display: IDisplay): void {
        if (display && this._material) {
            if (IsHolographicBounds(this.display)) {
                this._material.holographicBounds = this.display;
            }
            if (this.display?.resolution) {
                this._material.displayResolution = this.display.resolution;
            }
        }
    }

    private _buildGridFactoryInternal(): IElevationGridFactory {
        return new ElevationGridFactory();
    }
}
