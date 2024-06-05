import { AbstractMesh, Mesh, Nullable, Scene, TransformNode, VertexData, Material } from "@babylonjs/core";
import { TerrainGridOptions, TerrainGridOptionsBuilder, TerrainNormalizedGridBuilder } from "core/meshes";
import {
    IHasActivTiles,
    IHasNavigationState,
    ILinkOptions,
    IPipelineMessageType,
    ITargetBlock,
    ITile,
    ITileCollection,
    ITileMapLayer,
    ITileMapLayerContainer,
    ITileMetrics,
    ITileMetricsProvider,
    ITileNavigationState,
    ITilePipelineLink,
    ITransformBlock,
    IsTargetBlock,
    TileCollection,
    TilePipelineLink,
} from "core/tiles";
import { ICartesian2, ICartesian3 } from "core/geometry";
import { PropertyChangedEventArgs, EventState, Observable, Observer } from "core/events";
import { Bearing, IGeo2 } from "core/geography";
import { ElevationTile, IElevationMesh, IElevationTile } from "./map.elevation.tile";
import { ElevationLayer, IElevationLayerOptions, IElevationMaterialOptions } from "./map.elevation.layer";
import { IDemInfos } from "core/dem";
import { Map3dTextureContentType } from "./map.elevation";
import { CanvasTileSource } from "core/map";
import { Map3dScaleController, HasMapScale } from "./map.scale.controller";
import { HolographicDisplay, HasHolographicBounds } from "../display";
import { IsDisposable } from "core/types";
import { WebMapMaterial } from "../materials";

///<summary>
/// A layer for elevation data. The layer serve as host for elevation tiles and therefore the grid model used to display the elevation.
/// </summary>
export class Map3dElevationHost
    extends TransformNode
    implements ITransformBlock<ITile<IDemInfos>, ITile<IElevationMesh>>, IHasActivTiles<IElevationMesh>, ITileMetricsProvider, IHasNavigationState
{
    public static DefaultName: string = "elevations";
    public static TileRootSuffix: string = "tiles";

    private static InitZ(column: number, row: number, w: number, h: number): number {
        let i = column == w - 1 ? 1 : 0;
        let j = row == h - 1 ? 2 : 0;
        return i + j;
    }

    private static InitUV(column: number, row: number, w: number, h: number): number[] {
        let u = column == w - 1 ? 0 : column / (w - 2);
        let v = row == h - 1 ? 0 : row / (h - 2);
        return [u, v];
    }

    // internal observable dedicated to ISourceBlock
    _updatedObservable?: Observable<IPipelineMessageType<ITile<IElevationMesh>>>;
    _addedObservable?: Observable<IPipelineMessageType<ITile<IElevationMesh>>>;
    _removedObservable?: Observable<IPipelineMessageType<ITile<IElevationMesh>>>;
    // internal pipeline links dedicated to ISourceBlock
    _links: Array<ITilePipelineLink<ITile<IElevationMesh>>> = [];

    // observers
    _navigationObserver: Nullable<Observer<PropertyChangedEventArgs<ITileNavigationState, unknown>>> = null;
    _layerObserver: Nullable<Observer<PropertyChangedEventArgs<unknown, unknown>>> = null;

    // the data source
    _textureLayers: ITileMapLayerContainer<Map3dTextureContentType, ITileMapLayer<Map3dTextureContentType>>;
    _elevationSource: ElevationLayer;

    // the grid model
    _grid: VertexData;
    _template: Mesh;

    // scale controller
    _scaleController: Nullable<Map3dScaleController> = null;
    _scaleObserver: Nullable<Observer<ICartesian3>> = null;

    // the options
    _exageration: number;
    _insets: ICartesian3;
    _gridOptions?: TerrainGridOptions | TerrainGridOptionsBuilder;

    // where the tiles are stored
    _activTiles: ITileCollection<IElevationMesh>;

    // where the tiles are displayed
    _tilesRoot: TransformNode;

    // cached cartesian center
    _cartesianCenter: Nullable<ICartesian2>;

    public constructor(
        name: string,
        layers: ITileMapLayerContainer<Map3dTextureContentType, ITileMapLayer<Map3dTextureContentType>>,
        source: ElevationLayer,
        options?: IElevationLayerOptions,
        enabled: boolean = true
    ) {
        super(name);
        this._textureLayers = layers;
        this._elevationSource = source;
        this._elevationSource.linkTo(this);
        this._layerObserver = this._elevationSource.propertyChangedObservable.add(this._onElevationLayerPropertyChanged.bind(this));

        this._exageration = options?.exageration ?? ElevationLayer.DefaultExageration;
        this.scaling.z = this._exageration;

        this._insets = options?.insets ?? ElevationLayer.DefaultInsets;
        if (this._insets) {
            this.position.set(this._insets.x, this._insets.y, this._insets.z);
        }
        this._tilesRoot = new TransformNode(this._buildNameWithSuffix(Map3dElevationHost.TileRootSuffix));
        this._tilesRoot.parent = this;
        this._grid = this._buildTopology();
        // build the material
        const material = this._buildMaterial(options, this.getScene());
        if (IsTargetBlock<ElevationTile>(material)) {
            // if the material is a target block for elevation tiles, we link it to the source, which is this.
            // remember that the source is a layer of ITile<IDemInfos> (ElevationLayer as of now), which is transformed by this host to ITile<IElevationMesh> (ElevationTile as of now).
            this.linkTo(material);
        }

        this._template = this._buildMesh(material);
        this._navigationObserver = this.navigation.propertyChangedObservable.add(this._onNavigationPropertyChanged.bind(this));
        const geo = this.navigation.center;
        const lod = this.navigation.lod;
        this._cartesianCenter = this.metrics.getLatLonToPointXY(geo.lat, geo.lon, lod);

        this._activTiles = new TileCollection<IElevationMesh>();
        this.setEnabled(enabled);
    }

    //#region IHasNavigationState
    public get navigation(): ITileNavigationState {
        return this._elevationSource.navigation;
    }
    //#endregion

    //#region ITileMetricsProvider
    public get metrics(): ITileMetrics {
        return this._elevationSource.metrics;
    }
    //#endregion

    //#region IHasActivTiles<IElevationMesh>
    public get activTiles(): ITileCollection<IElevationMesh> {
        return this._activTiles;
    }
    //#endregion

    //#region ITargetBlock<IDemInfos>
    public added(eventData: IPipelineMessageType<ITile<IDemInfos>>, eventState: EventState): void {
        for (const tile of eventData) {
            this._onTileAdded(tile, eventState);
        }
    }
    public removed(eventData: IPipelineMessageType<ITile<IDemInfos>>, eventState: EventState): void {
        for (const tile of eventData) {
            this._onTileRemoved(tile, eventState);
        }
    }
    public updated(eventData: IPipelineMessageType<ITile<IDemInfos>>, eventState: EventState): void {
        for (const tile of eventData) {
            this._onTileUpdated(tile, eventState);
        }
    }
    //#endregion

    //#region ISourceBlock<ITile<IDemInfos>>
    public get updatedObservable(): Observable<IPipelineMessageType<ITile<IElevationMesh>>> {
        return this._updatedObservable ?? (this._updatedObservable = new Observable<IPipelineMessageType<ITile<IElevationMesh>>>());
    }

    public get addedObservable(): Observable<IPipelineMessageType<ITile<IElevationMesh>>> {
        return this._addedObservable ?? (this._addedObservable = new Observable<IPipelineMessageType<ITile<IElevationMesh>>>());
    }

    public get removedObservable(): Observable<IPipelineMessageType<ITile<IElevationMesh>>> {
        return this._removedObservable ?? (this._removedObservable = new Observable<IPipelineMessageType<ITile<IElevationMesh>>>());
    }

    public linkTo(target: ITargetBlock<ITile<IElevationMesh>>, options?: ILinkOptions): void {
        // a view may be linked to several targets, so we need to keep track of them.
        if (this._links.findIndex((l) => l.target === target) === -1) {
            // avoid linking twice to the same target
            const link = new TilePipelineLink(this, target, options);
            this._links.push(link);
        }
    }

    public unlinkFrom(target: ITargetBlock<ITile<IElevationMesh>>): ITilePipelineLink<ITile<IElevationMesh>> | undefined {
        const i = this._links.findIndex((l) => l.target === target);
        if (i !== -1) {
            const l = this._links.splice(i)[0];
            l.dispose();
            return l;
        }
        return undefined;
    }
    //#endregion

    /**
     * The mesh used as template for the elevation tiles. This mesh is intended to be decorated with specific material.
     * @returns the mesh used as template for the elevation tiles.
     */
    public get mesh(): Mesh {
        return this._template;
    }

    public bindDisplay(display?: HolographicDisplay): void {
        if (this._scaleController) {
            this._scaleController.dispose();
            this._scaleController = null;
        }
        if (this._scaleObserver) {
            this._scaleObserver.disconnect();
            this._scaleObserver = null;
        }
        var m = this.mesh.material;
        if (m && HasHolographicBounds(m)) {
            m.holographicBounds = null;
        }

        if (display) {
            this._scaleController = new Map3dScaleController(display, this.navigation, this.metrics);
            this._scaleObserver = this._scaleController.scaleChangedObservable.add(this._onScaleChanged.bind(this));
            this._onScaleChanged(Map3dScaleController.GetScale(display, this.navigation, this.metrics));

            var m = this.mesh.material;
            if (m && HasHolographicBounds(m)) {
                m.holographicBounds = display;
            }
        }
    }

    public dispose(doNotRecurse?: boolean | undefined, disposeMaterialAndTextures?: boolean | undefined): void {
        super.dispose(doNotRecurse, disposeMaterialAndTextures);
        if (this._navigationObserver) {
            this._navigationObserver.disconnect();
            this._navigationObserver = null;
        }
        if (this._layerObserver) {
            this._layerObserver.disconnect();
            this._layerObserver = null;
        }
        if (this._scaleController) {
            this._scaleController.dispose();
            this._scaleController = null;
        }
    }

    protected _onScaleChanged(scale: ICartesian3): void {
        const material = this._template.material;
        if (material && HasMapScale(material)) {
            material.mapScale = scale;
        }
    }

    protected _buildMesh(material: Nullable<Material> = null, scene?: Scene): Mesh {
        const mesh = this._createMesh(this._buildNameWithSuffix("template"), scene);
        this._grid.applyToMesh(mesh, true);
        mesh.isVisible = false;
        mesh.material = material;
        return mesh;
    }

    protected _createMesh(name: string, scene?: Nullable<Scene>): Mesh {
        return new Mesh(name, scene);
    }

    protected _buildInstance(name: string, tile: ITile<IElevationMesh>): AbstractMesh {
        const instance = this._template.createInstance(name);
        instance.scaling.x = instance.scaling.y = this.metrics.tileSize;
        instance.scaling.z = 1.0; // exageration is hold by the tiles root scaling.
        return instance;
    }

    protected _onElevationLayerPropertyChanged(event: PropertyChangedEventArgs<unknown, unknown>, state: EventState): void {
        if (event.source instanceof ElevationLayer) {
            switch (event.propertyName) {
                case ElevationLayer.ExagerationPropertyName: {
                    if (event.source.exageration !== this._exageration) {
                        this._exageration = event.source.exageration ?? ElevationLayer.DefaultExageration;
                        this.scaling.z = this._exageration;
                    }
                    break;
                }
                case ElevationLayer.InsetsPropertyName: {
                    const insets = event.source.insets;
                    if (insets) {
                        this.position.set(insets.x, insets.y, insets.z);
                    }
                    break;
                }
                case ElevationLayer.ColorPropertyName: {
                    if (this._template.material instanceof WebMapMaterial) {
                        if (this._template.material.terrainColor !== event.source.color) {
                            this._template.material.terrainColor = event.source.color ?? null;
                        }
                    }
                    break;
                }
                case ElevationLayer.ShininessPropertyName: {
                    if (this._template.material instanceof WebMapMaterial) {
                        if (this._template.material.shininess !== event.source.shininess) {
                            this._template.material.shininess = event.source.shininess ?? 0;
                        }
                    }
                    break;
                }
            }
        }
    }

    protected _onNavigationPropertyChanged(event: PropertyChangedEventArgs<ITileNavigationState, unknown>, state: EventState): void {
        switch (event.propertyName) {
            case "center": {
                const geo = event.newValue as IGeo2;
                this._cartesianCenter = this.metrics.getLatLonToPointXY(geo.lat, geo.lon, event.source.lod);
                this._onCenterChanged(this._cartesianCenter);
                break;
            }
            case "zoom": {
                const geo = event.source.center;
                this._cartesianCenter = this.metrics.getLatLonToPointXY(geo.lat, geo.lon, event.source.lod);
                this._onCenterChanged(this._cartesianCenter);
                this._onZoomChanged(event.source.scale);
                break;
            }
            case "azimuth": {
                this._onAzimuthChanged(event.newValue as Bearing);
                break;
            }
        }
    }

    protected _onZoomChanged(scale: number): void {
        this._tilesRoot.scaling.x = this._tilesRoot.scaling.y = scale;
        this._tilesRoot.scaling.z = (this._exageration ?? 1.0) * scale;
    }

    protected _onAzimuthChanged(azimuth: Bearing): void {
        this._tilesRoot.rotation.z = azimuth.radian;
    }

    protected _onCenterChanged(center: Nullable<ICartesian2>): void {
        if (center) {
            const tiles = this._activTiles;
            if (!tiles || !tiles.count) {
                return;
            }
            for (const tile of tiles) {
                this._setTilePosition(tile, center);
            }
        }
    }

    protected _setTilePosition(tile: ITile<IElevationMesh>, center: ICartesian2): void {
        if (tile.rect && tile.content?.surface) {
            const c = tile.rect.center;
            const s = tile.content?.surface;
            const x = c.x - center.x;
            const y = c.y - center.y;
            const p = s.position;
            p.x = -x;
            p.y = -y;
            p.z = 0;
        }
    }

    protected _buildTopology(): VertexData {
        const o = this._buildTerrainOptions(this._gridOptions);
        const data = new TerrainNormalizedGridBuilder().withOptions(o).build<VertexData>(new VertexData());
        return data;
    }

    protected _buildTerrainOptions(options?: TerrainGridOptions | TerrainGridOptionsBuilder): TerrainGridOptions {
        if (!options) {
            const s = this.metrics?.tileSize;
            return new TerrainGridOptionsBuilder()
                .withColumns(s + 1) // add one column to fill the gap
                .withRows(s + 1) // add one row to fill the gap - optional as by default the builder build a square if one of the dimension is missing. Added for clarity.
                .withScale(-1, 1) // we consider a grid oriented with babylonjs coordinate system
                .withInvertIndices(true) //  we need to invert indices as we reverse x
                .withZInitializer(Map3dElevationHost.InitZ) // register the z initializer, which serve as referencing the texture depth
                .withUvs(true) // generate uvs.
                .withUVInitializer(Map3dElevationHost.InitUV) // register the uv initializer, which serve as referencing the texture coordinate used in conjunction with depth
                .withNormals(true) // generate normals
                .build();
        }
        if (options instanceof TerrainGridOptionsBuilder) {
            return options.build();
        }
        return options;
    }

    protected _onTileAdded(tile: ITile<IDemInfos>, eventState: EventState): void {
        // this is where we create the IElevationMesh Tile
        const elevationTile = this._createElevationTile(tile);
        if (!elevationTile) {
            throw new Error("Elevation tile creation failed.");
        }

        this._activTiles.add(elevationTile);

        if (elevationTile.content) {
            elevationTile.content.surface = this._buildInstance(this._buildNameWithSuffix(tile.quadkey), elevationTile);
            if (this._cartesianCenter) {
                this._setTilePosition(elevationTile, this._cartesianCenter);
            }
            elevationTile.content.surface.parent = this._tilesRoot;

            // texture
            elevationTile.content.textureSource = new CanvasTileSource<ITileMapLayer<Map3dTextureContentType>>(
                `${elevationTile.address.quadkey}.texture`,
                this._textureLayers,
                elevationTile.address,
                this.metrics
            );
            if (IsTargetBlock<ITile<ImageData>>(this.mesh.material)) {
                elevationTile.content.textureSource.linkTo(this.mesh.material);
            }
        }
        if (this._addedObservable && this._addedObservable.hasObservers()) {
            this._addedObservable.notifyObservers([elevationTile], -1, eventState.currentTarget, this);
        }
    }

    protected _createElevationTile(tile: ITile<IDemInfos>): IElevationTile {
        const a = tile.address;
        return new ElevationTile(a.x, a.y, a.levelOfDetail, tile.content, this.metrics);
    }

    protected _onTileRemoved(tile: ITile<IDemInfos>, eventState: EventState): void {
        const a = tile.address;
        const elevationTile = this._activTiles.get(a);
        if (elevationTile) {
            this._activTiles.remove(a);
            if (elevationTile.content?.surface) {
                elevationTile.content.surface.dispose();
                elevationTile.content.surface = null;
            }
            if (elevationTile.content?.textureSource) {
                if (IsTargetBlock<ITile<ImageData>>(this.mesh.material)) {
                    elevationTile.content.textureSource.unlinkFrom(this.mesh.material);
                }
                if (IsDisposable(elevationTile.content.textureSource)) {
                    elevationTile.content.textureSource.dispose();
                }
                elevationTile.content.textureSource = null;
            }
            if (this._removedObservable && this._removedObservable.hasObservers()) {
                this._removedObservable.notifyObservers([elevationTile], -1, eventState.currentTarget, this);
            }
        }
    }

    protected _onTileUpdated(tile: ITile<IDemInfos>, eventState: EventState): void {
        const a = tile.address;
        const elevationTile = this._activTiles.get(a);
        if (elevationTile?.content) {
            elevationTile.content.infos = tile.content;
            if (this._updatedObservable && this._updatedObservable.hasObservers()) {
                this._updatedObservable.notifyObservers([elevationTile], -1, eventState.currentTarget, this);
            }
        }
    }

    protected _buildNameWithSuffix(suffix: string): string {
        return `${this.name ?? Map3dElevationHost.DefaultName}.${suffix}`;
    }

    protected _buildMaterial(material?: IElevationMaterialOptions, scene?: Scene): Material {
        if (material?.material) {
            return material.material;
        }
        return this._createDefaultMaterial(material, scene);
    }

    protected _createDefaultMaterial(material?: IElevationMaterialOptions, scene?: Scene): Material {
        const m = new WebMapMaterial(this._buildNameWithSuffix("material"), scene);
        if (material?.color) {
            m.terrainColor = material.color;
        }
        if (material?.shininess) {
            m.shininess = material.shininess;
        }
        return m;
    }
}
