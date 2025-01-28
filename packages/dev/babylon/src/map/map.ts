import { IDisplay, ImageLayer, ITileMapLayer, ITileMapLayerView, ITileNavigationState, TileMapBase, TileNavigationState, TileView } from "core/tiles";
import { IElevationGridFactory, IElevationOptions, IMap3D, IMap3DMaterial, Map3DContentType } from "./map.interfaces";
import { Material, Mesh, Scene, TransformNode, VertexData } from "@babylonjs/core";
import { Nullable } from "core/types";
import { EventState, PropertyChangedEventArgs } from "core/events";
import { TextureLayerView } from "./map.layer.texture";
import { ElevationLayer } from "../dem";
import { Cartesian3, ICartesian3, ISize2 } from "core/geometry";
import { ElevationGridFactory } from "./map.grid.factory";
import { TextUtils } from "core/utils";
import { Map3dMaterial } from "../materials";
import { IsHolographicBounds } from "../display";
import { ElevationLayerView } from "./map.layer.dem";

export class Map3D extends TileMapBase<Map3DContentType> implements IMap3D, IElevationOptions {
    public static DefaultGridSize: number = 32;
    public static DefaultExageration: number = 1.0;

    public static TEMPLATE_SUFFIX = "grid";
    public static MATERIAL_SUFFIX = "material";

    _root: TransformNode;
    _gridSize: number | ISize2;
    _offset?: ICartesian3;
    _exageration?: number;

    _grid: Mesh;
    _material: IMap3DMaterial;

    public constructor(root: TransformNode) {
        super();
        this._root = root;
        this._gridSize = Map3D.DefaultGridSize;
        this._offset = Cartesian3.Zero();
        this._exageration = Map3D.DefaultExageration;

        const scene = this._root.getScene();
        this._grid = this._buildTemplate(scene);
        this._grid.setEnabled(false);
        this._material = this._buildMaterial(this._buildMaterialName() ?? this.name, scene);
        if (this._material instanceof Material) {
            this._grid.material = this._material;
        }
    }

    public get elevationOptions(): IElevationOptions {
        return this;
    }

    public get material(): IMap3DMaterial {
        return this._material;
    }
    public get grid(): Mesh {
        return this._grid;
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
            return new ElevationLayerView(this, layer, this._display, new TileView());
        }
        if (layer instanceof ImageLayer) {
            return new TextureLayerView(this, layer, this.display, this.view);
        }
        return null;
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

    protected _onDisplayBinded(display: Nullable<IDisplay>) {
        super._onDisplayBinded(display);
        this._bindDisplayInternal(display);
    }

    private _bindDisplayInternal(display: Nullable<IDisplay>): void {
        const material = this.material;
        if (display && material && material instanceof Map3dMaterial) {
            if (IsHolographicBounds(this.display)) {
                material.holographicBounds = this.display;
            }
            if (this.display?.resolution) {
                material.displayResolution = this.display.resolution;
            }
        }
    }

    // bind the tile root to this root
    protected _onLayerViewAdded(eventData: Array<ITileMapLayerView<Map3DContentType>>, eventState: EventState): void {
        super._onLayerViewAdded(eventData, eventState);
        for (const v of eventData) {
            if (v instanceof TextureLayerView) {
                v.tilesRoot.parent = this._root;
                v.linkTo(<any>this.material.imagesTarget);
                continue;
            }
            if (v instanceof ElevationLayerView) {
                v.linkTo(<any>this.material.elevationsTarget);
                continue;
            }
        }
    }

    // unbind the tile root from this root
    protected _onLayerViewRemoved(eventData: Array<ITileMapLayerView<Map3DContentType>>, eventState: EventState): void {
        super._onLayerViewRemoved(eventData, eventState);
        for (const v of eventData) {
            if (v instanceof TextureLayerView) {
                v.tilesRoot.parent = null;
                v.unlinkFrom(<any>this.material.imagesTarget);
                continue;
            }
            if (v instanceof ElevationLayerView) {
                v.unlinkFrom(<any>this.material.elevationsTarget);
            }
        }
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
    protected _buildMaterial(name: string, scene?: Scene): IMap3DMaterial {
        return new Map3dMaterial(name, scene);
    }

    protected _buildTemplate(scene?: Scene): Mesh {
        const mesh = this._buildMesh(this._buildTemplateName() ?? this.name, scene);
        const gridFactory = this._buildGridFactory() ?? this._buildGridFactoryInternal();
        const gridSize = this.gridSize ?? Map3D.DefaultGridSize;
        const grid = gridFactory.buildTopology(gridSize);
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

    protected _buildMesh(name: string, scene?: Scene): Mesh {
        const mesh = new Mesh(name, scene);
        return mesh;
    }

    protected _buildGridFactory(): IElevationGridFactory {
        return this._buildGridFactoryInternal();
    }

    private _buildGridFactoryInternal(): IElevationGridFactory {
        return new ElevationGridFactory();
    }
}
