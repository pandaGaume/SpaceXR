import { AbstractMesh, Mesh, Nullable, Scene, TransformNode, VertexData, Material } from "@babylonjs/core";
import { TerrainGridOptions, TerrainGridOptionsBuilder, TerrainNormalizedGridBuilder } from "core/meshes";
import {
    IHasActivTiles,
    IHasNavigationState,
    ILinkOptions,
    IPipelineMessageType,
    ITargetBlock,
    ITile,
    ITileMapLayer,
    ITileMapLayerContainer,
    ITileMetrics,
    ITileMetricsProvider,
    ITileNavigationState,
    ITilePipelineLink,
    ITransformBlock,
    IsTargetBlock,
    Tile,
    TilePipelineLink,
} from "core/tiles";
import { ICartesian2, ICartesian3 } from "core/geometry";
import { PropertyChangedEventArgs, EventState, Observable, Observer } from "core/events";
import { Bearing, IGeo2 } from "core/geography";
import { ElevationMesh, IElevationMesh, IElevationTile } from "./map.elevation.mesh";
import { ElevationLayer, IElevationLayerOptions, IElevationLayerMaterialOptions } from "./map.elevation.layer";
import { IDemInfos } from "core/dem";
import { Map3dScaleController, HasMapScale } from "./map.scale.controller";
import { HolographicDisplay } from "../display";
import { IsDisposable } from "core/types";
import { WebMapMaterial } from "../materials";

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

    _navigation: ITileNavigationState;

    // observers
    _navigationObserver: Nullable<Observer<PropertyChangedEventArgs<ITileNavigationState, unknown>>> = null;
    _layerObserver: Nullable<Observer<PropertyChangedEventArgs<unknown, unknown>>> = null;

    // the data source
    _textureLayers: ITileMapLayerContainer<unknown, ITileMapLayer<unknown>>;
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
    _activTiles: Array<ITile<IElevationMesh>>;

    // where the tiles are displayed
    _tilesRoot: TransformNode;

    // cached cartesian center
    _cartesianCenter: Nullable<ICartesian2>;

    public constructor(name: string, navigation: ITileNavigationState, layers: ITileMapLayerContainer<unknown>, source: ElevationLayer, enabled: boolean = true) {
        super(name);
        this._navigation = navigation;
        this._textureLayers = layers;
        this._elevationSource = source;
        this._layerObserver = this._elevationSource.propertyChangedObservable.add(this._onElevationLayerPropertyChanged.bind(this));

        // elevation layer implements options
        const options: IElevationLayerOptions = this._elevationSource;

        this._insets = options?.insets ?? ElevationLayer.DefaultInsets;
        if (this._insets) {
            this.position.set(this._insets.x, this._insets.y, this._insets.z);
        }

        this._tilesRoot = new TransformNode(this._buildNameWithSuffix(Map3dElevationHost.TileRootSuffix));
        this._tilesRoot.parent = this;

        this._exageration = options?.exageration ?? ElevationLayer.DefaultExageration;
        this._tilesRoot.scaling.z = this._exageration;

        this._grid = this._buildTopology();
        // build the material
        const material = this._buildMaterial(options, this.getScene());
        if (IsTargetBlock<IElevationTile>(material)) {
            // if the material is a target block for elevation tiles, we link it to the source, which is this.
            // remember that the source is a layer of ITile<IDemInfos> (ElevationLayer as of now), which is transformed by this host to ITile<IElevationMesh> (ElevationTile as of now).
            this.linkTo(material);
        }

        // once the material is linked to the source, we can link the source to this host and give back parameters such material.
        this._elevationSource.linkTo(this, {}, material);

        this._template = this._buildMesh(material);
        this._navigationObserver = this._navigation.propertyChangedObservable.add(this._onNavigationPropertyChanged.bind(this));
        const geo = this._navigation.center;
        const lod = this._navigation.lod;
        this._cartesianCenter = this.metrics.getLatLonToPointXY(geo.lat, geo.lon, lod);

        this._activTiles = new Array<ITile<IElevationMesh>>();
        this.setEnabled(enabled);
    }

    //#region IHasNavigationState
    public get navigation(): ITileNavigationState {
        return this._navigation;
    }
    //#endregion

    //#region ITileMetricsProvider
    public get metrics(): ITileMetrics {
        return this._elevationSource.metrics;
    }
    //#endregion

    //#region IHasActivTiles<IElevationMesh>
    public get activTiles(): Array<Nullable<ITile<IElevationMesh>>> {
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

    public linkTo(target: ITargetBlock<ITile<IElevationMesh>>, options?: ILinkOptions<IElevationMesh>): void {
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
        if (m && HasHolographicBox(m)) {
            m.holographicBox = null;
        }

        if (display) {
            this._scaleController = new Map3dScaleController(display, this.navigation, this.metrics);
            this._scaleObserver = this._scaleController.scaleChangedObservable.add(this._onScaleChanged.bind(this));
            this._onScaleChanged(Map3dScaleController.GetScale(display, this.navigation, this.metrics));
            this.scaling.x = display.dimension.width / display.resolution.width;
            this.scaling.y = display.dimension.height / display.resolution.height;
            var m = this.mesh.material;
            if (m && HasHolographicBox(m)) {
                m.holographicBox = display;
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

    public validate(): void {
        for (const et of this._activTiles) {
            et.content?.validate();
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
        // at this point, the dimension should be in meters.
        // the tile size is actually unitless and normalized to one.
        // it represents usually 256 or 512, units in the display space.
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
            if (!tiles || !tiles.length) {
                return;
            }
            for (const tile of tiles) {
                this._setTilePosition(tile, center);
            }
        }
    }

    protected _setTilePosition(tile: ITile<IElevationMesh>, center: ICartesian2): void {
        if (tile.bounds && tile.content?.surface) {
            const c = tile.bounds.center;
            const s = tile.content.surface;
            const x = c.x - center.x;
            const y = c.y - center.y;
            const p = s.position;
            // the tile system is origin north-west corner, y pointing to the south, x to the east.
            // our choice is to have the origin at the center of the tile, y pointing to the north, x to the west (this make z up into babylonjs coordinate system)
            // so the minus sign comes from that.
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
                .withScale(-1, 1) // we consider a grid oriented with babylonjs coordinate system, left handed
                .withInvertIndices(true)
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

        this._activTiles.push(elevationTile);

        if (elevationTile.content) {
            elevationTile.content.surface = this._buildInstance(this._buildNameWithSuffix(tile.quadkey), elevationTile);
            if (this._cartesianCenter) {
                this._setTilePosition(elevationTile, this._cartesianCenter);
            }
            elevationTile.content.surface.parent = this._tilesRoot;

            const options: IElevationLayerOptions = this._elevationSource;

            // texture
            const t = new CanvasTileSource<ITileMapLayer<CanvasTileSourceSourceContentType>>(
                `${elevationTile.address.quadkey}.texture`,
                this._textureLayers,
                elevationTile.address,
                this.metrics,
                {
                    resolution: options.textureResolution,
                }
            );
            elevationTile.content.textureSource = t;
            if (IsTargetBlock<ITile<unknown>>(this.mesh.material)) {
                t?.linkTo(this.mesh.material);
            }
        }
        if (this._addedObservable && this._addedObservable.hasObservers()) {
            this._addedObservable.notifyObservers([elevationTile], -1, eventState.currentTarget, this);
        }
    }

    protected _createElevationTile(tile: ITile<IDemInfos>, mesh: AbstractMesh): IElevationTile {
        const a = tile.address;
        return new Tile<IElevationMesh>(a.x, a.y, a.levelOfDetail, new ElevationMesh(tile, mesh), this.metrics);
    }

    protected _onTileRemoved(tile: ITile<IDemInfos>, eventState: EventState): void {
        const a = tile.address;
        const i = this._activTiles.findIndex((t) => t.address === a);
        if (i >= 0) {
            const elevationTile = this._activTiles[i];
            this._activTiles.splice(i, 1);
            if (elevationTile.content?.surface) {
                elevationTile.content.surface.dispose();
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
        const i = this._activTiles.findIndex((t) => t.address === a);
        if (i >= 0) {
            const elevationTile = this._activTiles[i];
            if (elevationTile?.content) {
                elevationTile.content = tile.content;
                if (this._updatedObservable && this._updatedObservable.hasObservers()) {
                    this._updatedObservable.notifyObservers([elevationTile], -1, eventState.currentTarget, this);
                }
            }
        }
    }

    protected _buildNameWithSuffix(suffix: string): string {
        return `${this.name ?? Map3dElevationHost.DefaultName}.${suffix}`;
    }

    protected _buildMaterial(options?: IElevationLayerMaterialOptions, scene?: Scene): Material {
        if (options?.material) {
            return options.material;
        }
        return this._createDefaultMaterial(options, scene);
    }

    protected _createDefaultMaterial(options?: IElevationLayerMaterialOptions, scene?: Scene): Material {
        const m = new WebMapMaterial(this._buildNameWithSuffix("material"), scene);
        if (options?.color) {
            m.terrainColor = options.color;
        }
        if (options?.shininess) {
            m.shininess = options.shininess;
        }
        if (options?.textureResolution) {
            m.textureResolution = options.textureResolution;
        }
        return m;
    }
}
