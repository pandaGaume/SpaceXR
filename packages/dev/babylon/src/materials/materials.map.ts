import {
    AbstractMesh,
    Constants,
    Effect,
    EffectFallbacks,
    IEffectCreationOptions,
    InstancedMesh,
    Material,
    MaterialDefines,
    MaterialHelper,
    Matrix,
    Mesh,
    Nullable,
    PushMaterial,
    Scene,
    SubMesh,
    Vector2,
    Vector3,
    VertexBuffer,
} from "@babylonjs/core";
import { ClipIndex, ClipPlaneDefinition, IHolographicBounds, IsHolographicBox, IsHolographicCylinder, IsHolographicSphere } from "../display";
import { Observer } from "core/events";
import { IElevationHost, IElevationTile, IMap3dMaterial } from "../map";
import { ITexture3Layer, Texture3 } from "./textures";
import { IsTileMetricsProvider, NeighborsAddress, TileAddress } from "core/tiles";
import { ICartesian3 } from "core/geometry";
import { Range } from "core/math";
import { ElevationHelpers, IDemInfos } from "core/dem";

class AreaInfos {
    layer: ITexture3Layer;
    isReady: boolean = false;

    public constructor(layer: ITexture3Layer) {
        this.layer = layer;
    }
}

export enum Map3dLayerKind {
    Elevation = 0,
    Normal = 1,
    Texture = 2,
}

// internal class used to hold the tile pool texture areas
class TileLayout {
    public constructor(public tile: IElevationTile, public areas: Array<Nullable<AreaInfos>> = [null, null, null]) {}

    getArea(kind: Map3dLayerKind): Nullable<AreaInfos> {
        return this.areas[kind];
    }

    setArea(kind: Map3dLayerKind, value: Nullable<AreaInfos>): void {
        this.areas[kind] = value;
    }
}

export class Map3dMaterial extends PushMaterial implements IMap3dMaterial {
    public static DefaultShaderName: string = "map";

    public static SamplerDepthsAttName: string = "depths";

    public static ViewProjectionMatrixUniformName: string = "viewProjection";

    // clip planes uniforms in case of holographic box
    public static NorthClipPlaneUniformName: string = "uNorthClip";
    public static SouthClipPlaneUniformName: string = "uSouthClip";
    public static EastClipPlaneUniformName: string = "uEastClip";
    public static WestClipPlaneUniformName: string = "uWestClip";

    // radius and height for holographic sphere and cylinder
    public static RadiusUniformName: string = "uRadiusClip";
    public static HeightUniformName: string = "uHeightClip";

    // altitude range and map scale for the material
    public static AltRangeUniformName: string = "uAltRange";
    public static MapScaleUniformName: string = "uMapScale";

    // Samplers for the material
    public static ElevationSamplerUniformName: string = "uAltitudes";

    // the name of the shader used by the material
    protected _shaderName: Nullable<string> = null;

    // the optional holographix box where the material is used
    private _holoBounds: Nullable<IHolographicBounds> = null;
    // the observers for the holographic box clip planes
    private _clipPlanesAddedObservers: Nullable<Observer<Array<ClipPlaneDefinition>>> = null;
    private _clipPlanesRemovedObservers: Nullable<Observer<Array<ClipPlaneDefinition>>> = null;

    private _elevationSampler: Nullable<Texture3> = null;

    // the elevation related properties.
    private _elevationRange: Nullable<Range> = null;
    private _mapScale: ICartesian3 = Vector3.One();

    // the layout and meta properties of each tiles
    protected _tileLayouts: Map<string, TileLayout> = new Map<string, TileLayout>();

    public constructor(name: string, scene?: Scene, shaderName?: string) {
        super(name, scene);
        this._shaderName = shaderName ?? Map3dMaterial.DefaultShaderName;
    }

    public getClassName(): string {
        return "Map3dMaterial";
    }

    public get holographicBounds(): Nullable<IHolographicBounds> {
        return this._holoBounds;
    }

    public set holographicBounds(value: Nullable<IHolographicBounds>) {
        if (this._holoBounds !== value) {
            this._unbindHolographicBounds();
            this._holoBounds = value;
            this._bindHolographicBounds();
            this.markAsDirty(Material.AttributesDirtyFlag);
        }
    }

    public get mapScale(): ICartesian3 {
        return this._mapScale;
    }

    public set mapScale(value: ICartesian3) {
        if (this._mapScale !== value) {
            this._mapScale = value;
            this.markAsDirty(Material.AttributesDirtyFlag);
        }
    }

    public isReadyForSubMesh(mesh: AbstractMesh, subMesh: SubMesh, useInstances?: boolean): boolean {
        const drawWrapper = subMesh._drawWrapper;

        if (this.isFrozen) {
            if (drawWrapper.effect && drawWrapper._wasPreviouslyReady && drawWrapper._wasPreviouslyUsingInstances === useInstances) {
                return true;
            }
        }

        const defines: MaterialDefines = new MaterialDefines();
        const scene = this.getScene();

        if (this._isReadyForSubMesh(subMesh)) {
            return true;
        }

        const attribs = [
            // babylon related
            VertexBuffer.PositionKind,
            VertexBuffer.UVKind,

            // instance related
            Map3dMaterial.SamplerDepthsAttName,
        ];

        const uniforms = [
            // babylon related
            Map3dMaterial.ViewProjectionMatrixUniformName,
            // elevations
            Map3dMaterial.AltRangeUniformName,
            Map3dMaterial.MapScaleUniformName,
        ];

        const samplers = [Map3dMaterial.ElevationSamplerUniformName];
        const uniformBuffers = new Array<string>();

        if (this._holoBounds) {
            this._pushUniformsForBounds(defines, uniforms);
        }

        // we heavily rely on instances
        defines.INSTANCES = true;
        MaterialHelper.PushAttributesForInstances(attribs);
        defines.rebuild();

        const fallbacks = new EffectFallbacks();
        const engine = scene.getEngine();

        subMesh.setEffect(
            engine.createEffect(
                this._shaderName,
                <IEffectCreationOptions>{
                    attributes: attribs,
                    uniformsNames: uniforms,
                    uniformBuffersNames: uniformBuffers,
                    samplers: samplers,
                    defines: defines.toString(),
                    fallbacks: fallbacks,
                    onCompiled: this._onEffectCompiled.bind(this),
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
        drawWrapper._wasPreviouslyReady = true;
        drawWrapper._wasPreviouslyUsingInstances = !!useInstances;

        return true;
    }

    public bindForSubMesh(world: Matrix, mesh: Mesh, subMesh: SubMesh): void {
        const defines = subMesh.materialDefines;
        if (!defines) {
            return;
        }

        const effect = subMesh.effect;
        if (!effect) {
            return;
        }
        this._activeEffect = effect;
        const scene = this.getScene();

        // Matrices
        this._bindMatrix(effect, world, scene);

        if (this._mustRebind(scene, effect, subMesh)) {
            // Clip planes
            this._bindClipPlanes(effect);
            // samplers
            this._bindSamplers(effect);
            // Elevations.
            this._bindElevations(effect);
        }
    }

    public addTile(tile: IElevationTile, source: IElevationHost): void {
        // ensure elevation sampler is ready
        // this is done only once for the material
        this._ensureElevationSamplersReady(tile, source);

        // prepare the elevation sampler.
        let elevationArea: ITexture3Layer | undefined = undefined;

        elevationArea = this._elevationSampler?.reserve();
        if (!elevationArea) {
            // this is the place where we need to reallocate some depth into the samplers
            this._growSamplersDepth();
            elevationArea = this._elevationSampler?.reserve();
        }

        if (elevationArea !== undefined) {
            // bind the depth to the instance buffer
            const surface = tile.surface;
            if (surface) {
                surface.instancedBuffers.depths = new Vector3(elevationArea?.depth, 0, 0);
            }

            // Build the layout for the tile
            const layout = new TileLayout(tile);
            this._tileLayouts.set(tile.address.quadkey, layout);
            const areaInfos = new AreaInfos(elevationArea);
            layout.setArea(Map3dLayerKind.Elevation, areaInfos);
            if (tile.content) {
                // update the sampler, which mean set the texture data.
                // this is the place where the data are copied from the tile content to the sampler
                // and the border are fileld with values related to the neibourghs tiles.
                this._updateElevationSampler(tile, elevationArea);
                areaInfos.isReady = true;
                this.markAsDirty(Material.TextureDirtyFlag);
            }
        }
    }

    public removeTile(tile: IElevationTile, source: IElevationHost): void {
        const key = tile.address.quadkey;
        const layout = this._tileLayouts.get(key);
        if (layout) {
            layout.getArea(Map3dLayerKind.Elevation)?.layer.release();
            this._tileLayouts.delete(key);
            this._elevationRange = null; // invalidate the elevation range
            this.markAsDirty(Material.TextureDirtyFlag);
        }
    }

    public updateTile(tile: IElevationTile, source: IElevationHost): void {
        // this happens when the tile content is set or updated
        const layout = this._tileLayouts.get(tile.address.quadkey);
        if (layout) {
            // bind the depth to the instance buffer if was not previously setted
            const surface = tile.surface;
            if (surface) {
                const d = layout.getArea(Map3dLayerKind.Elevation)?.layer.depth;
                surface.instancedBuffers.depths = new Vector3(d, 0, 0);
            }

            if (tile.content) {
                // we update the elevation range
                const area = layout.getArea(Map3dLayerKind.Elevation);
                if (area) {
                    // if not done during the add, it's update the sampler, which mean set the texture data.
                    // this is the place where the data are copied from the tile content to the sampler
                    // and the border are fileld with values related to the neibourghs tiles.
                    this._updateElevationSampler(tile, area.layer);
                    area.isReady = true;
                    layout.tile.surface?.setEnabled(true);
                    this.markAsDirty(Material.TextureDirtyFlag);
                }
            }
        }
    }

    public dispose(forceDisposeEffect?: boolean): void {
        super.dispose(forceDisposeEffect);
        this._elevationSampler?.dispose();
    }

    protected _updateElevationSampler(tile: IElevationTile, elevationArea: ITexture3Layer) {
        if (tile.content && tile.content.elevations) {
            let w = elevationArea.host?.width ?? 0;
            let h = elevationArea.host?.height ?? 0;

            if (w && h) {
                const elevations = tile.content.elevations;
                w--;
                h--;
                // we process the dem content and update the elevation range
                this._updateElevationRange(tile.content);
                // update the main area
                elevationArea.update(elevations, 0, 0, w, h);

                const quadkey = tile.address.quadkey;
                const keys = TileAddress.ToNeigborsKey(quadkey);

                // checking the north neigbour
                let k = keys[NeighborsAddress.N];
                let layout;
                if (k) {
                    layout = this._tileLayouts.get(k);
                    if (layout?.tile.content?.elevations) {
                        // we update the last row of the north neigbour with the first row of the current tile
                        const firstRow = ElevationHelpers.GetFirstRow(elevations, w);
                        layout.getArea(Map3dLayerKind.Elevation)?.layer.update(firstRow, 0, h, w, 1);
                    }
                }

                // checking the east neigbour
                k = keys[NeighborsAddress.E];
                if (k) {
                    layout = this._tileLayouts.get(k);
                    if (layout?.tile.content?.elevations) {
                        // we update the last column of the current tile with the value of the first column of the east neigbour
                        const firstColumn = ElevationHelpers.GetFirstColumn(layout.tile.content.elevations, w, h);
                        elevationArea.update(firstColumn, w, 0, 1, h);
                    } else {
                        // we duplicate the last column of the current tile
                        const lastColumn = ElevationHelpers.GetLastColumn(elevations, w, h);
                        elevationArea.update(lastColumn, w, 0, 1, h);
                    }
                }

                // checking the south-east neigbour
                k = keys[NeighborsAddress.SE];
                if (k) {
                    layout = this._tileLayouts.get(k);
                    if (layout?.tile.content?.elevations) {
                        // we update the last value of the last row of the current tile with the first value of the first row of the south-east neigbour
                        const first = ElevationHelpers.GetElevationAt(layout.tile.content.elevations, w, h, 0, 0);
                        elevationArea.update(first, w, h, 1, 1);
                    }
                }

                // checking the south neigbour
                k = keys[NeighborsAddress.S];
                if (k) {
                    layout = this._tileLayouts.get(k);
                    if (layout?.tile.content?.elevations) {
                        // we update the last row of the current tile with the first row of the south neigbour
                        const firstRow = ElevationHelpers.GetFirstRow(layout.tile.content.elevations, w);
                        elevationArea.update(firstRow, 0, h, w, 1);
                    } else {
                        // we duplicate the last row of the current tile
                        const lastRow = ElevationHelpers.GetLastRow(elevations, w, h);
                        elevationArea.update(lastRow, 0, h, w, 1);
                    }
                }

                // checking the west neigbour
                k = keys[NeighborsAddress.W];
                if (k) {
                    layout = this._tileLayouts.get(k);
                    if (layout?.tile.content?.elevations) {
                        // we update the last column of the current tile with the first column of the west neigbour
                        const firstColumn = ElevationHelpers.GetFirstColumn(elevations, w, h);
                        layout.getArea(Map3dLayerKind.Elevation)?.layer.update(firstColumn, w, 0, 1, h);
                    }
                }

                // checking the north-west neigbour
                k = keys[NeighborsAddress.NW];
                if (k) {
                    layout = this._tileLayouts.get(k);
                    if (layout?.tile.content?.elevations) {
                        // we update the last value of the first row of the current tile with the first value of the last row of the north-west neigbour
                        const first = ElevationHelpers.GetElevationAt(elevations, w, h, 0, 0);
                        layout.getArea(Map3dLayerKind.Elevation)?.layer.update(first, w, h, 1, 1);
                    }
                }
            }
        }
    }

    protected _getElevationRange(): Range {
        if (this._elevationRange === null) {
            this._elevationRange = this._buildElevationRange();
        }
        return this._elevationRange;
    }

    protected _buildElevationRange(): Range {
        let range: Nullable<Range> = null;
        for (let b of this._tileLayouts.values()) {
            const infos = b.tile.content;
            if (infos) {
                if (range === null) {
                    range = new Range(infos.min.z, infos.max.z);
                    continue;
                }
                range.unionInPlace(infos.min.z, infos.max.z);
            }
        }
        return range ?? new Range(0, 0);
    }

    protected _updateElevationRange(infos: IDemInfos): void {
        if (infos) {
            this._getElevationRange().unionInPlace(infos.min.z, infos.max.z);
            this.markAsDirty(Material.AttributesDirtyFlag);
        }
    }

    protected _pushUniformsForBounds(defines: MaterialDefines, uniforms: Array<string>) {
        if (IsHolographicBox(this._holoBounds)) {
            defines.HOLOGRAPHIC_BOUNDS_BOX = true;
            const properties = ["point", "normal"];
            uniforms.push(
                // clip planes
                ...this._prepareUniforms(Map3dMaterial.NorthClipPlaneUniformName, ...properties),
                ...this._prepareUniforms(Map3dMaterial.SouthClipPlaneUniformName, ...properties),
                ...this._prepareUniforms(Map3dMaterial.EastClipPlaneUniformName, ...properties),
                ...this._prepareUniforms(Map3dMaterial.WestClipPlaneUniformName, ...properties)
            );
        } else if (IsHolographicSphere(this._holoBounds)) {
            throw new Error("Sphere bounds Not supported");
            defines.HOLOGRAPHIC_BOUNDS_SPHERE = true;
            uniforms.push(
                // sphere properties
                Map3dMaterial.RadiusUniformName
            );
        } else if (IsHolographicCylinder(this._holoBounds)) {
            throw new Error("Cylinder bounds Not supported");
            defines.HOLOGRAPHIC_BOUNDS_CYLINDER = true;
            uniforms.push(
                // cylinder properties
                Map3dMaterial.RadiusUniformName,
                Map3dMaterial.HeightUniformName
            );
        }
    }

    protected _onClipPlanesAdded(planes: Array<ClipPlaneDefinition>): void {
        this.markAsDirty(Material.AttributesDirtyFlag);
    }

    protected _onClipPlanesRemoved(planes: Array<ClipPlaneDefinition>): void {
        this.markAsDirty(Material.AttributesDirtyFlag);
    }

    protected _bindMatrix(effect: Effect, world: Matrix, scene: Scene): void {
        effect.setMatrix(Map3dMaterial.ViewProjectionMatrixUniformName, scene.getTransformMatrix());
    }

    protected _bindElevations(effect: Effect): void {
        const r = this._getElevationRange();
        effect.setVector2(Map3dMaterial.AltRangeUniformName, new Vector2(r.min, r.max));
        effect.setFloat(Map3dMaterial.MapScaleUniformName, this._mapScale.x);
    }

    protected _bindHolographicBounds(): void {
        if (this._holoBounds) {
            if (IsHolographicBox(this._holoBounds)) {
                this._clipPlanesAddedObservers = this._holoBounds.clipPlanesAddedObservable.add(this._onClipPlanesAdded.bind(this));
                this._clipPlanesRemovedObservers = this._holoBounds.clipPlanesRemovedObservable.add(this._onClipPlanesRemoved.bind(this));
            }
        }
    }

    protected _bindClipPlanes(effect: Effect): void {
        if (this._holoBounds) {
            if (IsHolographicBox(this._holoBounds)) {
                const clips = this._holoBounds.clipPlanesWorld;
                if (clips) {
                    this._bindClipPlane(effect, clips, Map3dMaterial.NorthClipPlaneUniformName, ClipIndex.North);
                    this._bindClipPlane(effect, clips, Map3dMaterial.SouthClipPlaneUniformName, ClipIndex.South);
                    this._bindClipPlane(effect, clips, Map3dMaterial.EastClipPlaneUniformName, ClipIndex.East);
                    this._bindClipPlane(effect, clips, Map3dMaterial.WestClipPlaneUniformName, ClipIndex.West);
                }
            } else if (IsHolographicSphere(this._holoBounds)) {
                effect.setFloat(Map3dMaterial.RadiusUniformName, this._holoBounds.radius);
            } else if (IsHolographicCylinder(this._holoBounds)) {
                effect.setFloat(Map3dMaterial.RadiusUniformName, this._holoBounds.radius);
                effect.setVector3(Map3dMaterial.HeightUniformName, this._holoBounds.height ?? new Vector3(0, Number.MAX_SAFE_INTEGER, 0));
            }
        }
    }

    protected _bindClipPlane(effect: Effect, planes: Array<ClipPlaneDefinition>, name: string, index: ClipIndex): void {
        let clipPlane = planes[index];
        if (clipPlane) {
            effect.setVector3(`${name}.point`, clipPlane.point);
            effect.setVector3(`${name}.normal`, clipPlane.normal);
        }
    }

    protected _bindSamplers(effect: Effect): void {
        effect.setTexture(Map3dMaterial.ElevationSamplerUniformName, this._elevationSampler);
    }

    protected _unbindHolographicBounds(): void {
        if (this._holoBounds) {
            this._clipPlanesAddedObservers?.disconnect();
            this._clipPlanesRemovedObservers?.disconnect();
            this._clipPlanesAddedObservers = null;
            this._clipPlanesRemovedObservers = null;
            this.markAsDirty(Material.AttributesDirtyFlag);
        }
    }

    protected _prepareUniforms(name: string, ...properties: string[]): string[] {
        return properties.map((p) => `${name}.${p}`);
    }

    protected _onEffectCompiled(effect: Effect): void {
        // console.log("DEFINES:", effect.defines);
        // console.log("VERTEX:", effect.vertexSourceCode);
        // console.log("FRAGMENT:", effect.fragmentSourceCode);
        if (this.onCompiled) {
            this.onCompiled(effect);
        }
    }

    protected _buildElevationSampler(width: number, height?: number, depth?: number): void {
        height = height ?? width;
        const maxDepth = depth ?? this._getElevationSamplerDepth();
        const generateMipMap = false;
        const scene = this.getScene();
        this._elevationSampler = <Texture3>this._buildSampler(Map3dLayerKind.Elevation, width, height, maxDepth, generateMipMap, scene);
    }

    protected _buildSampler(kind: Map3dLayerKind, width: number, height: number, depth: number, generateMipMap: boolean, scene: Scene): Nullable<Texture3> {
        switch (kind) {
            case Map3dLayerKind.Elevation: {
                const options = {
                    width: width,
                    height: height,
                    depth: depth,
                    format: Constants.TEXTUREFORMAT_R,
                    textureType: Constants.TEXTURETYPE_FLOAT,
                    samplingMode: Constants.TEXTURE_BILINEAR_SAMPLINGMODE,
                    internalFormat: scene.getEngine()._gl.R16F, // force internal format to save half space
                    generateMipMap: generateMipMap,
                };
                return new Texture3(scene, options);
            }
            case Map3dLayerKind.Normal: {
                const options = {
                    width: width,
                    height: height,
                    depth: depth,
                    format: Constants.TEXTUREFORMAT_RGB,
                    textureType: Constants.TEXTURETYPE_UNSIGNED_BYTE,
                    samplingMode: Constants.TEXTURE_BILINEAR_SAMPLINGMODE,
                    internalFormat: scene.getEngine()._gl.RGB8, // force internal format to save half space
                    generateMipMap: generateMipMap,
                };
                return new Texture3(scene, options);
            }
            case Map3dLayerKind.Texture: {
                const options = {
                    width: width,
                    height: height,
                    depth: depth,
                    format: Constants.TEXTUREFORMAT_RGB,
                    textureType: Constants.TEXTURETYPE_UNSIGNED_BYTE,
                    samplingMode: Constants.TEXTURE_BILINEAR_SAMPLINGMODE,
                    internalFormat: scene.getEngine()._gl.RGB8, // force internal format to save half space
                    generateMipMap: generateMipMap,
                };
                // this is where we leverage the Map3dTexture class to handle the layer texture
                return new Texture3(scene, options);
            }
            default: {
                return null;
            }
        }
    }

    protected _tryGetSize(tile: IElevationTile, src: any): number {
        let size = IsTileMetricsProvider(src) ? src.metrics.tileSize : 0;
        if (!size) {
            size = Math.sqrt(tile.content?.elevations?.length ?? 0);
        }
        return size;
    }

    protected _ensureElevationSamplersReady(tile: IElevationTile, src: IElevationHost): void {
        if (!this._elevationSampler) {
            let size = this._tryGetSize(tile, src);
            if (size) {
                // here we gona build the elevation sampler with a size of N+1 because we add a row at the bottom and a column on the right
                // to keep the definition of the grid which is N+1 x N+1
                this._buildElevationSampler(size + 1);
            }
            this._ensureInstanceBufferReady(src.grid);
        }
    }

    protected _ensureInstanceBufferReady(target: AbstractMesh): void {
        if (target) {
            const mesh = target instanceof InstancedMesh ? target.sourceMesh : (target as Mesh);
            if (mesh.instancedBuffers?.depth === undefined) {
                this._registerInstanceBuffers(mesh);
            }
        }
    }

    protected _registerInstanceBuffers(target: Mesh): void {
        target.registerInstancedBuffer(Map3dMaterial.SamplerDepthsAttName, 3);
    }

    protected _getElevationSamplerDepth(): number {
        return 24; // for dev purpose we set a fixed number of tiles
    }

    protected _growSamplersDepth(): void {
        // this is the place we gonna grow the depth of the samplers
        // TODO
    }
}
