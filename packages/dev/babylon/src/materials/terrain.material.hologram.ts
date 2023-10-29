import {
    PushMaterial,
    Scene,
    Effect,
    Mesh,
    Matrix,
    AbstractMesh,
    Constants,
    Vector4,
    Vector3,
    SubMesh,
    MaterialDefines,
    VertexBuffer,
    IEffectCreationOptions,
    EffectFallbacks,
    MaterialHelper,
    Color4,
} from "@babylonjs/core";
import { SurfaceMapDisplay, SurfaceTileMap, TerrainTile } from "../terrain";
import { IDemInfos } from "core/dem";
import { EventState, Observer } from "core/events";
import { Nullable } from "core/types";
import { ITilePoolTextureArea, TilePoolTexture, TilePoolTextureOptions } from "./textures/tilePoolTexture";
import { ITileAddress, ITileClient, IsTileContentView, TileMetrics } from "core/tiles";
import { Range } from "core/math";
import { UpdateEventArgs, UpdateReason } from "core/tiles/tiles.mapview";

// internal class used to hold the tile pool texture areas
class TileBag {
    public elevationArea: Nullable<ITilePoolTextureArea> = null;
    public normalArea: Nullable<ITilePoolTextureArea> = null;
    public layerArea: Nullable<ITilePoolTextureArea> = null;

    public constructor(public address: ITileAddress) {}
}

export enum ClipIndex {
    North,
    South,
    East,
    West,
}

class SurfaceDefinition {
    public constructor(public point: Vector3, public normal: Vector3) {}
}

class TerrainHologramMaterialDefines extends MaterialDefines {
    public WIREFRAME = false;
    public INSTANCES = true;

    constructor() {
        super();
        this.rebuild();
    }
}

export class TerrainHologramMaterialOptions {
    public static DefaultBackgroundColor: Color4 = new Color4(0.5, 0.5, 0.5, 1.0);
    public static DefaultExageration: number = 1.0;

    public layerClient?: ITileClient<HTMLImageElement>;
    public exageration?: number;
    public backgroundColor?: Color4;
}

export class TerrainHologramMaterialAtt {
    public static DemInfosKind: string = "demInfos";
    public static DemIdsKind: string = "demIds";
    public static LayerIdsKind: string = "layerIds";
}

export class TerrainHologramMaterialSampler {
    public static ElevationKind: string = "altitudes";
    public static NormalKind: string = "normals";
    public static LayerKind: string = "layer";
}

/// <summary> TerrainHologramMaterial is to use in conjunction with the SurfaceTileMap Template property.
/// Consequetly it has to listen to the underlying MapView to get the current tile and its properties.
/// </summary>
export class TerrainHologramMaterial<V extends IDemInfos, H extends SurfaceMapDisplay> extends PushMaterial {
    public static ClassName: string = "TerrainHologramMaterial";
    public static ShaderName: string = "tilemap";

    private _map: SurfaceTileMap<V, H>;
    private _layerClient?: ITileClient<HTMLImageElement>;

    // tile bags is holding the area infrormation provided by TilePoolTexture for each activ tile.
    // This pattern is used to avoid creating a new derived class for each type of tile, or new Decorator class.
    private _tileBags: Map<string, TileBag>;

    // the observers
    private _added: Nullable<Observer<TerrainTile<V>>>;
    private _updated: Nullable<Observer<TerrainTile<V>>>;
    private _removed: Nullable<Observer<TerrainTile<V>>>;
    private _viewUpdated: Nullable<Observer<UpdateEventArgs<V>>>;

    // the tile pool textures
    private _elevationSampler: Nullable<TilePoolTexture>;
    private _normalSampler: Nullable<TilePoolTexture>;
    private _layerSampler: Nullable<TilePoolTexture>;

    // uniforms
    private _elevationRange: Range;
    private _elevationExageration: number;
    private _mapScale: number;
    private _clipSurfaces: SurfaceDefinition[];
    public _backgroundColor: Color4;

    constructor(name: string, map: SurfaceTileMap<V, H>, options: TerrainHologramMaterialOptions, scene: Scene) {
        super(name, scene);
        // the map to listen
        this._map = map;
        // the listeners
        this._viewUpdated = this._map.view.updateObservable.add(this._onViewUpdated.bind(this), -1, true); // last parameter is to insert at the beginning of the list
        this._removed = this._map.removedObservable.add(this._onTileRemoved.bind(this), -1, true); // last parameter is to insert at the beginning of the list
        this._added = this._map.addedObservable.add(this._onTileAdded.bind(this));
        this._updated = this._map.updatedObservable.add(this._onTileUpdated.bind(this));
        // the bags dictionary, which hold the area information for each tile
        this._tileBags = new Map<string, TileBag>();
        // the samplers
        this._elevationSampler = null;
        this._normalSampler = null;
        this._layerSampler = null;
        // the layer client to use. Should be null if no layer is used.
        this._layerClient = options?.layerClient;
        // the attributes
        this._elevationRange = new Range(Number.MAX_VALUE);
        this._elevationExageration = options?.exageration || TerrainHologramMaterialOptions.DefaultExageration;
        this._backgroundColor = options?.backgroundColor || TerrainHologramMaterialOptions.DefaultBackgroundColor;
        this._mapScale = 1.0;
        this._clipSurfaces = [];

        this._registerInstanceBuffer();
        this._buildTextures(scene);
        this._buildClipSurfaces();
    }

    public get LayerClient(): ITileClient<HTMLImageElement> | undefined {
        return this._layerClient;
    }

    public set LayerClient(v: ITileClient<HTMLImageElement> | undefined) {
        if (this._layerClient !== v) {
            this._layerClient = v;
            if (v) {
                this._updateLayer();
                //this.markAsDirty(Material.MiscDirtyFlag);
            }
        }
    }

    public override getClassName(): string {
        return TerrainHologramMaterial.ClassName;
    }

    public get map(): SurfaceTileMap<V, H> {
        return this._map;
    }

    public get elevationRange(): Range {
        return this._elevationRange;
    }

    public get elevationExageration(): number {
        return this._elevationExageration;
    }

    public set elevationExageration(v: number) {
        if (this._elevationExageration !== v) {
            this._elevationExageration = v;
            //this.markAsDirty(Material.MiscDirtyFlag);
        }
    }

    public get mapScale(): number {
        return this._mapScale;
    }

    private set mapScale(v: number) {
        if (this._mapScale != v) {
            this._mapScale = v;
            //this.markAsDirty(Material.MiscDirtyFlag);
        }
    }

    public get clipSurfaces(): SurfaceDefinition[] {
        return this._clipSurfaces;
    }

    // Override the isReady method
    public isReadyForSubMesh(mesh: AbstractMesh, subMesh: SubMesh, useInstances?: boolean): boolean {
        if (this.isFrozen) {
            if (subMesh.effect && subMesh.effect._wasPreviouslyReady && subMesh.effect._wasPreviouslyUsingInstances === useInstances) {
                return true;
            }
        }
        if (!subMesh.materialDefines) {
            subMesh.materialDefines = new TerrainHologramMaterialDefines();
        }

        const defines = <TerrainHologramMaterialDefines>subMesh.materialDefines;
        const scene = this.getScene();

        if (this._isReadyForSubMesh(subMesh)) {
            return true;
        }

        const shaderName = TerrainHologramMaterial.ShaderName;
        const join = defines.toString();
        const attribs = [
            VertexBuffer.PositionKind,
            VertexBuffer.UVKind,
            TerrainHologramMaterialAtt.DemInfosKind,
            TerrainHologramMaterialAtt.DemIdsKind,
            TerrainHologramMaterialAtt.LayerIdsKind,
        ];
        const uniforms = [
            "world",
            "viewProjection",
            "mapscale",
            "exageration",
            "northClip.point",
            "northClip.normal",
            "southClip.point",
            "southClip.normal",
            "westClip.point",
            "westClip.normal",
            "eastClip.point",
            "eastClip.normal",
            "minAlt",
            "backColor",
        ];
        const samplers = [TerrainHologramMaterialSampler.ElevationKind, TerrainHologramMaterialSampler.NormalKind, TerrainHologramMaterialSampler.LayerKind];
        const uniformBuffers = new Array<string>();
        const fallbacks = new EffectFallbacks();
        const engine = scene.getEngine();

        // we heavily rely on instances
        if (useInstances) {
            defines.INSTANCES = true;
            MaterialHelper.PushAttributesForInstances(attribs);
        }

        subMesh.setEffect(
            engine.createEffect(
                shaderName,
                <IEffectCreationOptions>{
                    attributes: attribs,
                    uniformsNames: uniforms,
                    uniformBuffersNames: uniformBuffers,
                    samplers: samplers,
                    defines: join,
                    fallbacks: fallbacks,
                    onCompiled: this.onCompiled,
                    onError: this.onError,
                },
                engine
            ),
            defines,
            this._materialContext
        );

        if (!subMesh.effect || !subMesh.effect.isReady()) {
            return false;
        }

        defines._renderId = scene.getRenderId();
        subMesh.effect._wasPreviouslyReady = true;
        subMesh.effect._wasPreviouslyUsingInstances = !!useInstances;

        return true;
    }

    public bindForSubMesh(world: Matrix, mesh: Mesh, subMesh: SubMesh): void {
        const scene = this.getScene();
        const defines = <TerrainHologramMaterialDefines>subMesh.materialDefines;
        if (!defines) {
            return;
        }

        const effect = subMesh.effect;
        if (!effect) {
            return;
        }

        this._activeEffect = effect;
        // Matrices
        this._bindMatrix(effect, world, scene);

        if (scene.isCachedMaterialInvalid(this, effect)) {
            // Clip planes
            this._bindClipPlane(effect);
            // samplers
            this._bindSamplers(effect);
            // Miscellaneous.
            this._bindMisc(effect);
        }
    }

    // Override the dispose method
    public override dispose(forceDisposeEffect: boolean = false): void {
        this._added?.dispose();
        this._updated?.dispose();
        this._removed?.dispose();
        this._viewUpdated?.dispose();

        for (var bag of this._tileBags.values()) {
            bag.elevationArea?.release();
            bag.normalArea?.release();
            bag.layerArea?.release();
        }
        this._tileBags.clear();

        // Release resources here
        super.dispose(forceDisposeEffect);
    }

    // Override the clone method
    public override clone(name: string): TerrainHologramMaterial<V, H> {
        // Create and return a copy of the material with specific properties
        var options = new TerrainHologramMaterialOptions();
        options.layerClient = this._layerClient;
        return new TerrainHologramMaterial<V, H>(name, this._map, options, this.getScene());
    }

    private _bindMatrix(effect: Effect, world: Matrix, scene: Scene): void {
        effect.setMatrix("world", world);
        effect.setMatrix("viewProjection", scene.getTransformMatrix());
    }

    private _bindClipPlane(effect: Effect): void {
        effect.setVector3("northClip.point", this._clipSurfaces[ClipIndex.North].point);
        effect.setVector3("northClip.normal", this._clipSurfaces[ClipIndex.North].normal);
        effect.setVector3("southClip.point", this._clipSurfaces[ClipIndex.South].point);
        effect.setVector3("southClip.normal", this._clipSurfaces[ClipIndex.South].normal);
        effect.setVector3("eastClip.point", this._clipSurfaces[ClipIndex.East].point);
        effect.setVector3("eastClip.normal", this._clipSurfaces[ClipIndex.East].normal);
        effect.setVector3("westClip.point", this._clipSurfaces[ClipIndex.West].point);
        effect.setVector3("westClip.normal", this._clipSurfaces[ClipIndex.West].normal);
    }
    private _bindSamplers(effect: Effect): void {
        effect.setTexture(TerrainHologramMaterialSampler.ElevationKind, this._elevationSampler);
        effect.setTexture(TerrainHologramMaterialSampler.NormalKind, this._normalSampler);
        effect.setTexture(TerrainHologramMaterialSampler.LayerKind, this._layerSampler);
    }

    private _bindMisc(effect: Effect): void {
        effect.setFloat("mapscale", this._mapScale);
        effect.setFloat("exageration", this._elevationExageration);
        effect.setDirectColor4("backColor", this._backgroundColor);
    }

    private _registerInstanceBuffer(): void {
        const template = this._map.template;
        template.registerInstancedBuffer(TerrainHologramMaterialAtt.DemInfosKind, 4); // dem infos
        template.registerInstancedBuffer(TerrainHologramMaterialAtt.DemIdsKind, 4);
        template.registerInstancedBuffer(TerrainHologramMaterialAtt.LayerIdsKind, 4);
    }

    // messaged when tile has been added to the activ list of the map
    private _onTileAdded(eventData: TerrainTile<V>, eventState: EventState): void {
        const mesh = eventData.surface;
        if (mesh) {
            // setup the layer
            this._loadLayer(eventData);
            // The update event is raised when the data become available, so we may update the content of
            // the tile pool textures and other attributes
            this._updateTileContent(eventData);
        }
    }

    // messaged when tile content has been updated
    private _onTileUpdated(eventData: TerrainTile<V>, eventState: EventState): void {
        const mesh = eventData.surface;
        if (mesh) {
            // setup the layer
            this._loadLayer(eventData);
            // The update event is raised when the data become available, so we may update the content of
            // the tile pool textures and other attributes
            this._updateTileContent(eventData);
        }
    }

    // messaged when tile has been removed from the activ list of the map
    private _onTileRemoved(eventData: TerrainTile<V>, eventState: EventState): void {
        let bags = this._tileBags.get(eventData.address.quadkey);
        if (bags) {
            bags.elevationArea?.release();
            bags.normalArea?.release();
            bags.layerArea?.release();
            this._tileBags.delete(eventData.address.quadkey);
        }
    }

    private _onViewUpdated(args: UpdateEventArgs<V>): void {
        if (args?.reason == UpdateReason.viewChanged) {
            var view = args.source;
            this.mapScale = view.metrics.mapScale(view.center.lat, view.levelOfDetail, this._map.display.pixelPerUnit.x);
        }
    }

    // build the tile pool textures. This method is called at the creation of the material,
    // compute the depth of the pool giving the map diagonal as maximum length of the view
    private _buildTextures(scene: Scene): void {
        var metrics = this._map.metrics;

        // first remember we need to calculate the depth of the pool, which is the maximum number of texture tile we may have
        const s = metrics.tileSize;
        var display = this._map.display;
        const resw = display.resolution.width;
        const resh = display.resolution.height;
        // remember that this diagonal value is calculated as mid-zoom level, which mean
        // that the maximum size will be at lower zoom  and a scale of 1.5
        const diag = Math.sqrt(resw * resw + resh * resh) * 1.5;
        const ntiles = Math.floor(diag / s) + 1;
        const depth = ntiles * ntiles;

        const tilePoolElevationOptions = new TilePoolTextureOptions({
            metrics: metrics,
            count: depth,
            format: Constants.TEXTUREFORMAT_R,
            textureType: Constants.TEXTURETYPE_FLOAT,
            samplingMode: Constants.TEXTURE_NEAREST_NEAREST,
            internalFormat: scene.getEngine()._gl.R16F, // force internal format to save half space
        });
        this._elevationSampler = new TilePoolTexture(TerrainHologramMaterialSampler.ElevationKind, tilePoolElevationOptions, scene);

        const tilePoolNormalOptions = new TilePoolTextureOptions({
            metrics: metrics,
            count: depth,
            format: Constants.TEXTUREFORMAT_RGB,
            textureType: Constants.TEXTURETYPE_UNSIGNED_BYTE,
            samplingMode: Constants.TEXTURE_BILINEAR_SAMPLINGMODE,
            internalFormat: scene.getEngine()._gl.RGB8, // force internal format
        });
        this._normalSampler = new TilePoolTexture(TerrainHologramMaterialSampler.NormalKind, tilePoolNormalOptions, scene);

        const tilePoolLayerOptions = new TilePoolTextureOptions({
            metrics: metrics,
            count: depth,
            format: Constants.TEXTUREFORMAT_RGB,
            textureType: Constants.TEXTURETYPE_UNSIGNED_BYTE,
            samplingMode: Constants.TEXTURE_BILINEAR_SAMPLINGMODE,
            internalFormat: scene.getEngine()._gl.RGB8, // force internal format
        });
        this._layerSampler = new TilePoolTexture(TerrainHologramMaterialSampler.LayerKind, tilePoolLayerOptions, scene);
    }

    // build the clip surfaces, which are the 4 planes (North, South, East, West ) used to clip the map content
    // this planes are computed using the display dimension and its position in the world.
    private _buildClipSurfaces(): void {
        const display = this._map.display;
        const axes = display.getXYZWorldVectors();
        const dim = this._map.display.dimension;
        const w2 = dim.width / 2;
        const h2 = dim.height / 2;

        const vx = axes[0].multiply(new Vector3(w2, w2, w2));
        const vy = axes[1].multiply(new Vector3(h2, h2, h2));

        const p = display.getAbsolutePosition();

        let a = p.subtract(vy);
        let b = axes[1];
        this._clipSurfaces.push({ point: a, normal: b });

        a = p.add(vy);
        b = axes[1].negate();
        this._clipSurfaces.push({ point: a, normal: b });

        a = p.add(vx);
        b = axes[0].negate();
        this._clipSurfaces.push({ point: a, normal: b });

        a = p.subtract(vx);
        b = axes[0];
        this._clipSurfaces.push({ point: a, normal: b });
        console.log(this._clipSurfaces);
    }

    // update the tile content. This methods is called when the tile is added or updated.
    // the main purpose is to update the tile pool texture areas.
    private _updateTileContent(tile: TerrainTile<V>): void {
        // retreive or build the corresponding bag
        const key = tile.address.quadkey;
        let bag = this._tileBags.get(key);
        if (!bag) {
            bag = new TileBag(tile.address);
            this._tileBags.set(key, bag);
        }

        const m = tile.surface;
        if (m && tile.content && tile.content[0]) {
            let tileContent = tile.content[0];
            if (IsTileContentView<V>(tileContent)) {
                tileContent = tileContent.delegate;
            }

            // update the elevation range.
            let min = this._elevationRange.min;
            let max = this._elevationRange.max || Number.MIN_VALUE;

            // remember that the TileContentView is used to keep the information of the tile while zooming in when
            // target data are not yet ready. Min and Max are corrsponding to specific section of the tile.
            m.instancedBuffers.demInfos = new Vector4(tileContent.min.z, tileContent.max.z, tileContent.delta, tileContent.mean);
            min = tileContent.min.z;
            max = tileContent.max.z;

            if (min < this._elevationRange.min) {
                this._elevationRange.min = min;
            }
            if (this._elevationRange.max === undefined || max > this._elevationRange.max) {
                this._elevationRange.max = max;
            }

            // then prepare the sub textures and neighbours
            const elevationArea = this._elevationSampler?.reserveArea();
            const normalArea = this._normalSampler?.reserveArea();
            if (elevationArea && normalArea) {
                elevationArea.update(tileContent.elevations);
                normalArea.update(tileContent.normals);
                bag.elevationArea = elevationArea;
                bag.normalArea = normalArea;

                // register neighbor ids
                const neigbors = TileMetrics.ToNeigborsXY(tile.address);
                let ids = [5, 7, 8];
                m.instancedBuffers.demIds = new Vector4(elevationArea.id, -1, -1, -1);
                for (let i = 0; i != ids.length; i++) {
                    const a = neigbors[ids[i]];
                    if (!a) {
                        continue;
                    }
                    const keyOfInterest = TileMetrics.TileXYToQuadKey(a);
                    bag = this._tileBags.get(keyOfInterest);
                    if (bag?.elevationArea) {
                        const id = bag.elevationArea.id;
                        switch (i) {
                            case 0: {
                                m.instancedBuffers.demIds.y = id;
                                break;
                            }
                            case 1: {
                                m.instancedBuffers.demIds.z = id;
                                break;
                            }
                            case 2: {
                                m.instancedBuffers.demIds.w = id;
                                break;
                            }
                        }
                    }
                }

                // 2 - register the tile to the interested neighbors which are 3, 1, 0
                ids = [3, 1, 0];
                for (let i = 0; i != ids.length; i++) {
                    const a = neigbors[ids[i]];
                    if (!a) {
                        continue;
                    }
                    const keyOfInterest = TileMetrics.TileXYToQuadKey(a);
                    bag = this._tileBags.get(keyOfInterest);
                    const tileOfInterest = this._map.getTile(keyOfInterest);
                    if (bag?.elevationArea && tileOfInterest?.surface) {
                        const id = elevationArea.id;
                        switch (i) {
                            case 0: {
                                tileOfInterest.surface.instancedBuffers.demIds.y = id;
                                break;
                            }
                            case 1: {
                                tileOfInterest.surface.instancedBuffers.demIds.z = id;
                                break;
                            }
                            case 2: {
                                tileOfInterest.surface.instancedBuffers.demIds.w = id;
                                break;
                            }
                        }
                    }
                }
            } else {
                console.log(`Warning ! unable to allocate area  ${this._elevationSampler?.usedAreaCount}/${this._elevationSampler?.areaCount}`);
            }
        }
    }

    // load the layer content. It is questionable to let this method here, but it is the simplest way to do it.
    private _loadLayer(tile: TerrainTile<V>): void {
        const m = tile.surface;
        if (m && !m.instancedBuffers.layerIds) {
            m.instancedBuffers.layerIds = new Vector4(-1, -1, -1, -1);
            this._loadLayerAreaAsync(tile.address)
                .then((id) => {
                    m.instancedBuffers.layerIds.x = id;
                })
                .catch((reason) => {
                    // the lookup operation has failed - TODO describe a strategy
                    console.log(reason);
                });
        }
    }

    private _updateLayer(): void {
        Promise.all(Array.from(this._tileBags.values()).map((bag) => this._loadLayerAreaAsync(bag.address)))
            .then((ids) => {})
            .catch((reason) => {})
            .finally(() => {});
    }

    // TODO : move back the bag process to _loadLayer and _updateLayer
    private async _loadLayerAreaAsync(address: ITileAddress): Promise<number> {
        var client = this._layerClient;
        if (client) {
            var result = await client.fetchAsync(address);

            // the client has not changed in the mean time.
            if (client === this._layerClient && result.content) {
                // retreive the bag
                let bag = this._tileBags.get(address.quadkey);
                if (bag) {
                    const layerArea = bag.layerArea ?? this._layerSampler?.reserveArea();
                    if (layerArea && result.content) {
                        layerArea.update(result.content);
                        bag.layerArea = layerArea;
                        return layerArea.id;
                    }
                }
                // the bag is not defined, due certainly to a change of view during the loading process.
            }
        }
        return -1;
    }
}
