import { IDemInfos } from "core/dem";
import { IDisplay, IPhysicalDisplay, IsPhysicalDisplay, ITileMetrics, ITileNavigationState, ITileView, TileMapLayerView, TileNavigationState } from "core/tiles";
import { IElevationHost, IElevationLayer, IElevationLayerOptions, IElevationTile, IsElevationLayer } from "./map.elevation.interfaces";
import { ElevationGridFactory } from "./map.elevation.host.factory";
import { AbstractMesh, Mesh, Scene, TransformNode, VertexData } from "@babylonjs/core";
import { ElevationTile } from "./map.elevation.mesh";
import { ICartesian2 } from "core/geometry";
import { Nullable } from "core/types";
import { TextUtils } from "core/utils";
import { ElevationLayer } from "./map.elevation.layer";
import { EventState, PropertyChangedEventArgs } from "core/events";
import { Map3dMaterial } from "../materials";
import { IsHolographicBounds } from "../display";

export class ElevationHost extends TileMapLayerView<IDemInfos> implements IElevationHost {
    public static TEMPLATE_SUFFIX = "grid";
    public static ROOT_SUFFIX = "root";
    public static MATERIAL_SUFFIX = "material";
    public static INSTANCE_ROOT_NAME = "root";

    // the grid model
    _grid: Mesh;
    _material: Map3dMaterial;

    _tilesRoot: TransformNode;
    // cached cartesian center
    _cartesianCenterCache: Nullable<ICartesian2> = null;

    public constructor(layer: IElevationLayer, display: Nullable<IDisplay>, source: ITileView, scene?: Scene) {
        super(layer, display, source);
        // ensure factory is with correct type.
        this.factory.withType(ElevationTile);

        // build the 3D root
        this._tilesRoot = this._buildRoot(scene);

        // build the template ( including the material)
        this._grid = this._buildTemplate(scene);
        this._material = this._buildMaterial(this._buildMaterialName() ?? this.name, scene);
        if (this._material) {
            this._grid.material = this._material;
        }
        this._grid.setEnabled(false);

        // apply navigation and options.
        this._applyNavigation(this.navigationState);
    }

    public get tilesRoot(): TransformNode {
        return this._tilesRoot;
    }

    public get grid(): Mesh {
        return this._grid;
    }

    protected get isReady(): boolean {
        return this._tilesRoot !== null && this._tilesRoot !== undefined;
    }
    protected _buildRoot(scene?: Scene): TransformNode {
        return new TransformNode(this._buildRootName(), scene);
    }

    protected _applyNavigation(nav: Nullable<ITileNavigationState>) {
        if (nav) {
            this._onCenterChanged();
            this._onZoomChanged();
        }
    }

    private _setScale(nav: ITileNavigationState, display: IPhysicalDisplay, layerOptions: IElevationLayerOptions, metrics: ITileMetrics) {
        const groundResolution = metrics.groundResolution(nav.center.lat, nav.lod);
        const x = display.dimension.width / (display.resolution.width * groundResolution);
        const y = display.dimension.height / (display.resolution.height * groundResolution);
        let z = Math.max(x, y);
        if (display.dimension.thickness && display.resolution.thickness) {
            z = display.dimension.thickness / (display.resolution.thickness * groundResolution);
        }

        // x & y are unitless, so we define the size in meter using scale and groundResolution
        this._tilesRoot.scaling.x = x * groundResolution * nav.scale;
        this._tilesRoot.scaling.y = y * groundResolution * nav.scale;

        // z data are already in meter so they just need to be scaled, and exagerated.
        this._tilesRoot.scaling.z = z * this.exageration * nav.scale;
    }

    private _setPosition(x: number, y: number, z: number) {
        this._tilesRoot.position.set(x, y, z);
    }

    protected _onLayerPropertyChanged(eventData: PropertyChangedEventArgs<unknown, unknown>, eventState: EventState): void {
        // we survey the weight property of the layer to update the current view and messaging the map container that it need
        // to sort the layers again.
        if (IsElevationLayer(eventData.source)) {
            switch (eventData.propertyName) {
                case ElevationLayer.ExagerationPropertyName: {
                    this._onZoomChanged();
                    break;
                }
                case ElevationLayer.OffsetsPropertyName: {
                    const insets = eventData.source.offsets;
                    if (insets) {
                        this._setPosition(insets.x, insets.y, insets.z);
                    }
                    break;
                }
            }
        }
        super._onLayerPropertyChanged(eventData, eventState);
    }

    protected _onNavigationChanged(oldValue: Nullable<ITileNavigationState>, newValue: Nullable<ITileNavigationState>): void {
        if (newValue && newValue !== oldValue) {
            this._applyNavigation(newValue);
        }
    }

    protected _onNavigationPropertyChanged(event: PropertyChangedEventArgs<ITileNavigationState, unknown>, state: EventState): void {
        switch (event.propertyName) {
            case TileNavigationState.CENTER_PROPERTY_NAME: {
                this._cartesianCenterCache = null; // invalidate the cache
                this._onCenterChanged();
                this._onZoomChanged(); // scale is function of the latitude
                break;
            }
            case TileNavigationState.ZOOM_PROPERTY_NAME: {
                this._onZoomChanged();
                break;
            }
        }
        super._onNavigationPropertyChanged(event, state);
    }

    public get exageration(): number {
        const l = this.layer;
        if (IsElevationLayer(l)) {
            return l.exageration ?? ElevationLayer.DefaultExageration;
        }
        return ElevationLayer.DefaultExageration;
    }

    protected _onZoomChanged(): void {
        if (this.isReady && IsPhysicalDisplay(this.display)) {
            this._setScale(this.navigationState!, this.display, this.layer, this.metrics);
        }
    }

    protected _onCenterChanged(): void {
        if (this.isReady) {
            const tiles = this._activTiles;
            if (!tiles || !tiles.count) {
                return;
            }

            const center = this._getCenter(true);
            if (center) {
                for (const tile of tiles) {
                    this._setTilePosition(tile as IElevationTile, center);
                }
            }
        }
    }

    protected _getCenter(force: boolean = false): ICartesian2 | undefined {
        const nav = this.navigationState;
        if (nav) {
            if (force || !this._cartesianCenterCache) {
                const geo = nav.center;
                this._cartesianCenterCache = this.metrics.getLatLonToPointXY(geo.lat, geo.lon, nav.lod);
            }
            return this._cartesianCenterCache;
        }
        return undefined;
    }

    protected _buildTemplate(scene?: Scene): Mesh {
        const mesh = this._buildMesh(this._buildTemplateName() ?? this.name, scene);
        const gridFactory = this._buildGridFactory() ?? this._buildGridFactoryInternal();
        const grid = gridFactory.buildTopology(this.metrics.tileSize);
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

    protected _buildMaterial(name: string, scene?: Scene): Map3dMaterial {
        const material = new Map3dMaterial(name, scene);
        if (this.display) {
            if (IsHolographicBounds(this.display)) {
                material.holographicBounds = this.display;
            }
            material.displayResolution = this.display?.resolution;
        }
        material.wireframe = true;
        return material;
    }

    protected _buildGridFactory(): ElevationGridFactory {
        return this._buildGridFactoryInternal();
    }

    protected _buildQualifiedName(n: string): string {
        if (this.namespace && this.namespace !== "") {
            return `${this.namespace}:${n}`;
        }
        return n;
    }

    protected _buildTemplateName(): string {
        return this._buildQualifiedName(TextUtils.BuildNameWithSuffix(this.name, ElevationHost.TEMPLATE_SUFFIX));
    }

    protected _buildMaterialName(): string {
        return TextUtils.BuildNameWithSuffix(this._buildTemplateName(), ElevationHost.MATERIAL_SUFFIX);
    }

    protected _buildRootName(): string {
        return this._buildQualifiedName(TextUtils.BuildNameWithSuffix(this.name, ElevationHost.ROOT_SUFFIX));
    }

    private _buildGridFactoryInternal(): ElevationGridFactory {
        return new ElevationGridFactory();
    }

    /**
     * this is the place where we gona build the instance of the templates.
     * @param tiles an array of tiles or a tile
     */

    protected _onTilesAdded(tiles: Array<ElevationTile>): void {
        if (this._tilesRoot) {
            this._tilesRoot.getScene().onBeforeRenderObservable.addOnce(() => {
                for (const t of tiles) {
                    this._onTileAdded(t);
                }
            });
        } else {
            super._onTilesAdded(tiles);
        }
    }

    protected _onTileAdded(tile: ElevationTile): void {
        const m = this._buildInstance(tile);
        if (m) {
            m.parent = this._tilesRoot;

            m.scaling.x = m.scaling.y = this.metrics.tileSize;
            m.scaling.z = 1.0; // exageration is hold by the tiles root scaling.

            tile.surface = m;
            if (!tile.content) {
                m.setEnabled(false);
            }
            const center = this._getCenter(true);
            if (center) {
                this._setTilePosition(tile, center);
            }
        }
        this._material?.addTile(tile, this);
    }

    protected _onTilesRemoved(tiles: Array<ElevationTile>): void {
        if (this._tilesRoot) {
            this._tilesRoot.getScene().onBeforeRenderObservable.addOnce(() => {
                for (const t of tiles) {
                    this._onTileRemoved(t);
                }
            });
        } else {
            super._onTilesRemoved(tiles);
        }
    }

    protected _onTileRemoved(tile: ElevationTile): void {
        if (tile.surface) {
            tile.surface.dispose();
            tile.surface = null;
        }
        this._material?.removeTile(tile, this);
    }

    protected _onTilesUpdated(tiles: Array<ElevationTile>): void {
        if (this._tilesRoot) {
            this._tilesRoot.getScene().onBeforeRenderObservable.addOnce(() => {
                for (const t of tiles) {
                    this._onTileUpdated(t);
                }
            });
        } else {
            super._onTilesUpdated(tiles);
        }
    }

    protected _onTileUpdated(tile: ElevationTile): void {
        if (tile.surface) {
            tile.surface.setEnabled(tile.content !== null && tile.content !== undefined);
        }
        this._material?.updateTile(tile, this);
    }

    protected _buildInstance(tile: ElevationTile): AbstractMesh {
        const instance = this._grid.createInstance(this._buildInstanceName(tile));
        return instance;
    }

    protected _buildInstanceName(tile: ElevationTile): string {
        const k = tile.quadkey;
        return k != "" ? k : ElevationHost.INSTANCE_ROOT_NAME;
    }

    protected _setTilePosition(tile: IElevationTile, center: ICartesian2): void {
        if (tile?.bounds && tile?.surface) {
            const c = tile.bounds.center;
            const p = tile.surface.position;
            // the tile system is origin north-west corner, y pointing to the south, x to the east.
            p.x = center.x - c.x;
            p.y = center.y - c.y;
            p.z = 0;
        }
    }
}
