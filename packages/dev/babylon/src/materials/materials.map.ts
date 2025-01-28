import {
    PushMaterial,
    Scene,
    Nullable,
    Material,
    Vector3,
    AbstractMesh,
    SubMesh,
    MaterialDefines,
    VertexBuffer,
    MaterialHelper,
    EffectFallbacks,
    Effect,
    Matrix,
    IEffectCreationOptions,
    Mesh,
    InstancedMesh,
    Constants,
    Vector4,
} from "@babylonjs/core";
import { ElevationType, IMap3DMaterial, ITileWithGridElevation, TextureType } from "../map/map.interfaces";
import { ICartesian3, ISize3, Size3 } from "core/geometry";
import { ClipIndex, ClipPlaneDefinition, IHolographicBounds, IsHolographicBox, IsHolographicCylinder, IsHolographicSphere } from "../display";
import { ITexture3Layer, Texture3 } from "./textures";
import { EventState, Observer } from "core/events";
import { IPipelineMessageType, ITargetBlock, ITile, TargetProxy } from "core/tiles";
import { IDisposable } from "core/types";
import { ElevationLayerView, TextureLayerView } from "../map";
import { Range } from "core/math";

// internal class used to hold the tile pool areas
class TileLayout<T> implements IDisposable {
    public constructor(public tile: T, public area: Nullable<ITexture3Layer> = null) {}

    public dispose() {
        this.area?.release();
    }
}

// specialization for texture
class TextureLayout extends TileLayout<ITileWithGridElevation<TextureType>> {
    public constructor(tile: ITileWithGridElevation<TextureType>, area: Nullable<ITexture3Layer> = null) {
        super(tile, area);
    }
}

// specialization for elevation with dem and normals
class ElevationLayout extends TileLayout<ITile<ElevationType>> {
    public constructor(tile: ITile<ElevationType>, area: Nullable<ITexture3Layer> = null, public normalArea: Nullable<ITexture3Layer> = null) {
        super(tile, area);
    }

    public dispose() {
        super.dispose();
        this.normalArea?.release();
    }
}

export class Map3dMaterial extends PushMaterial implements IMap3DMaterial {
    public static ClassName: string = "Map3dMaterial";
    public static ShaderName: string = "map";

    public static DefaultElevationTextureDepth: number = 16;

    public static ElevationDepthsAttName: string = "elevationDepths";
    public static ElevationDepthsSize = 4;
    public static NormalDepthsAttName: string = "normalDepths";
    public static NormalDepthsSize = 4;
    public static TextureDepthsAttName: string = "textureDepths";
    public static TextureDepthsSize = 4;

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
    public static TextureSamplerUniformName: string = "uTextures";
    public static ElevationSamplerUniformName: string = "uElevations";

    // the name of the shader used by the material
    protected _shaderName: Nullable<string> = null;

    // the optional holographix box where the material is used
    private _holoBounds: Nullable<IHolographicBounds> = null;
    // the observers for the holographic box clip planes
    private _clipPlanesAddedObservers: Nullable<Observer<Array<ClipPlaneDefinition>>> = null;
    private _clipPlanesRemovedObservers: Nullable<Observer<Array<ClipPlaneDefinition>>> = null;

    private _textureSampler: Nullable<Texture3> = null;
    private _elevationSampler: Nullable<Texture3> = null;

    // the elevation related properties.
    private _elevationRange: Nullable<Range> = null;

    // the internal scale defined by the LOD (decimal part)
    private _mapScale: ICartesian3 = Vector3.One();

    // the layout and meta properties of each tiles
    protected _textureTileLayouts: Map<string, TextureLayout> = new Map<string, TextureLayout>();
    protected _elevationTileLayouts: Map<string, ElevationLayout> = new Map<string, ElevationLayout>();

    // the resolution of the display
    private _displayResolution: ISize3 = Size3.Zero();

    private _imagesTarget: ITargetBlock<ITileWithGridElevation<TextureType>>;
    private _elevationsTarget: ITargetBlock<ITile<ElevationType>>;

    public constructor(name: string, scene?: Scene, shaderName?: string) {
        super(name, scene);
        this._shaderName = shaderName ?? Map3dMaterial.ShaderName;
        this._imagesTarget = new TargetProxy<ITileWithGridElevation<TextureType>>(this.imagesAdded.bind(this), this.imagesRemoved.bind(this), this.imagesUpdated.bind(this));
        this._elevationsTarget = new TargetProxy<ITile<ElevationType>>(this.elevationsAdded.bind(this), this.elevationsRemoved.bind(this), this.elevationsUpdated.bind(this));
    }

    public get imagesTarget(): ITargetBlock<ITileWithGridElevation<TextureType>> {
        return this._imagesTarget;
    }

    public get elevationsTarget(): ITargetBlock<ITile<ElevationType>> {
        return this._elevationsTarget;
    }

    public getClassName(): string {
        return Map3dMaterial.ClassName;
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

    public get displayResolution(): ISize3 {
        return this._displayResolution;
    }

    public set displayResolution(value: ISize3) {
        if (this._displayResolution !== value) {
            this._displayResolution = value;
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
            Map3dMaterial.TextureDepthsAttName,
        ];

        const uniforms = [
            // babylon related
            Map3dMaterial.ViewProjectionMatrixUniformName,
            // elevations
            Map3dMaterial.AltRangeUniformName,
            Map3dMaterial.MapScaleUniformName,
        ];

        const samplers = [Map3dMaterial.TextureSamplerUniformName, Map3dMaterial.ElevationSamplerUniformName];
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
        }
    }

    protected imagesAdded(data: IPipelineMessageType<ITileWithGridElevation<TextureType>>, state: EventState): void {
        const host = state.currentTarget;
        if (host instanceof TextureLayerView) {
            for (const tile of data) {
                const key = tile.address.quadkey;
                if (this._textureTileLayouts.has(key)) {
                    continue;
                }

                const surface = tile.surface;
                if (!surface) {
                    throw new Error("Tile surface is not defined");
                }

                this._ensureTextureSamplersReady(host);

                let layout = new TextureLayout(tile);
                this._textureTileLayouts.set(key, layout);

                let area = this._reserveArea(this._textureSampler);
                if (area === undefined) {
                    return;
                }

                // the depth of the texture x=uvs, y=ids
                const textureDepths = new Vector4(area.depth, -1, -1, -1);
                surface.instancedBuffers[Map3dMaterial.TextureDepthsAttName] = textureDepths;

                layout.area = area;
                if (tile.content) {
                    area.update(tile.content);
                    tile.surface?.setEnabled(true);
                }
                this.markAsDirty(Material.TextureDirtyFlag);
            }
        }
    }

    protected imagesRemoved(data: IPipelineMessageType<ITileWithGridElevation<TextureType>>, state: EventState): void {
        for (const tile of data) {
            const key = tile.address.quadkey;
            const layout = this._textureTileLayouts.get(key);
            if (layout) {
                if (tile.surface) {
                    tile.surface.instancedBuffers.textureDepths.x = -1;
                }
                layout.dispose();
                this._textureTileLayouts.delete(key);
                this.markAsDirty(Material.TextureDirtyFlag);
            }
        }
    }

    protected imagesUpdated(data: IPipelineMessageType<ITileWithGridElevation<TextureType>>, state: EventState): void {
        for (const tile of data) {
            const key = tile.address.quadkey;
            const layout = this._textureTileLayouts.get(key);
            if (layout) {
                if (tile.content) {
                    layout.area?.update(tile.content);
                    tile.surface?.setEnabled(true);
                    this.markAsDirty(Material.TextureDirtyFlag);
                }
            }
        }
    }

    protected elevationsAdded(data: IPipelineMessageType<ITile<ElevationType>>, state: EventState): void {
        const host = state.currentTarget;
        if (host instanceof ElevationLayerView) {
            for (const tile of data) {
                const key = tile.address.quadkey;
                if (this._elevationTileLayouts.has(key)) {
                    continue;
                }
                this._ensureElevationSamplersReady(host);

                let layout = new ElevationLayout(tile);
                this._elevationTileLayouts.set(key, layout);

                let area = this._reserveArea(this._elevationSampler);
                if (area === undefined) {
                    return;
                }
                layout.area = area;
                if (tile.content?.elevations) {
                    this._updateElevationRange(tile.content);
                    area.update(tile.content.elevations);
                }
                this.markAsDirty(Material.TextureDirtyFlag);
            }
        }
    }

    protected elevationsRemoved(data: IPipelineMessageType<ITile<ElevationType>>, state: EventState): void {
        for (const tile of data) {
            const key = tile.address.quadkey;
            const layout = this._elevationTileLayouts.get(key);
            if (layout) {
                layout.dispose();
                this._elevationTileLayouts.delete(key);
                this._invalidateElevationRange();
                this.markAsDirty(Material.TextureDirtyFlag);
            }
        }
    }

    protected elevationsUpdated(data: IPipelineMessageType<ITile<ElevationType>>, state: EventState): void {
        for (const tile of data) {
            const key = tile.address.quadkey;
            const layout = this._elevationTileLayouts.get(key);
            if (layout) {
                if (tile.content?.elevations) {
                    this._updateElevationRange(tile.content);
                    layout.area?.update(tile.content.elevations);
                    this.markAsDirty(Material.TextureDirtyFlag);
                }
            }
        }
    }

    public dispose(forceDisposeEffect?: boolean): void {
        super.dispose(forceDisposeEffect);
        this._textureSampler?.dispose();
        this._textureSampler = null;
        this._elevationSampler?.dispose();
        this._elevationSampler = null;
    }

    protected _reserveArea(sampler: Nullable<Texture3>, mess?: string): ITexture3Layer | undefined {
        if (!sampler) {
            return undefined;
        }

        let area = sampler.reserve();
        if (!area) {
            if (mess) {
                console.log(mess);
            }
            // this is the place where we need to reallocate some depth into the samplers
            sampler.ensureRoomFor(1);
            area = sampler.reserve();
        }
        return area;
    }

    protected _ensureTextureSamplersReady(src: TextureLayerView): void {
        if (!this._textureSampler) {
            let size = src.metrics.tileSize;
            this._textureSampler = this._buildTextureSampler(size, size);
            this._ensureInstanceBufferReady(src._map.grid);
        }
    }

    protected _ensureElevationSamplersReady(src: ElevationLayerView): void {
        if (!this._elevationSampler) {
            const size = src.metrics.tileSize;
            // we try optimize the depth using the zoom offset.
            const offset = src.layer.zoomOffset ?? 0;
            const r = offset == 0 ? 1.0 : offset > 0 ? Math.pow(2, offset) : 1.0 / Math.pow(2, -offset);
            const depth = this._getOverallSamplerDepth(size * r);
            this._elevationSampler = this._buildElevationSampler(size, size, depth);
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
        //target.registerInstancedBuffer(Map3dMaterial.ElevationDepthsAttName, Map3dMaterial.ElevationDepthsSize);
        //target.registerInstancedBuffer(Map3dMaterial.NormalDepthsAttName, Map3dMaterial.NormalDepthsSize);
        target.registerInstancedBuffer(Map3dMaterial.TextureDepthsAttName, Map3dMaterial.TextureDepthsSize);
    }

    protected _buildTextureSampler(width: number, height?: number, depth?: number): Texture3 {
        height = height ?? width;
        const maxDepth = depth ?? this._getOverallSamplerDepth(width, height);
        const scene = this.getScene();

        const options = {
            width: width,
            height: height,
            depth: maxDepth,
            format: Constants.TEXTUREFORMAT_RGB,
            textureType: Constants.TEXTURETYPE_UNSIGNED_BYTE,
            samplingMode: Constants.TEXTURE_BILINEAR_SAMPLINGMODE,
            internalFormat: scene.getEngine()._gl.RGB8,
            generateMipMap: false,
        };
        // this is where we leverage the Map3dTexture class to handle the layer texture
        return new Texture3(scene, options);
    }

    protected _buildElevationSampler(width: number, height?: number, depth?: number): Texture3 {
        height = height ?? width;
        const maxDepth = depth ?? this._getOverallSamplerDepth(width, height);
        const scene = this.getScene();
        const options = {
            width: width,
            height: height,
            depth: maxDepth,
            format: Constants.TEXTUREFORMAT_R,
            textureType: Constants.TEXTURETYPE_FLOAT, // the input is Float32Array
            samplingMode: Constants.TEXTURE_NEAREST_NEAREST,
            internalFormat: scene.getEngine()._gl.R16F, // force internal format to save half space
            generateMipMap: false,
        };
        return new Texture3(scene, options);
    }

    protected _getOverallSamplerDepth(width: number, height?: number): number {
        if (Size3.IsEmpty(this._displayResolution)) {
            return Map3dMaterial.DefaultElevationTextureDepth; // we set a fixed number of tiles
        }

        height = height ?? width;
        // we calculate the number of tiles that can be displayed on the screen
        // using empiric formula based on surface, trying to minimize the number of tiles
        const a = this._displayResolution.width / width;
        const b = this._displayResolution.height / height;
        const N = Math.ceil(a * b + 2 * (a + b));
        return N;
    }

    protected _bindMatrix(effect: Effect, world: Matrix, scene: Scene): void {
        effect.setMatrix(Map3dMaterial.ViewProjectionMatrixUniformName, scene.getTransformMatrix());
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
        effect.setTexture(Map3dMaterial.TextureSamplerUniformName, this._textureSampler);
        effect.setTexture(Map3dMaterial.ElevationSamplerUniformName, this._elevationSampler);
    }

    protected _bindHolographicBounds(): void {
        if (this._holoBounds) {
            if (IsHolographicBox(this._holoBounds)) {
                this._clipPlanesAddedObservers = this._holoBounds.clipPlanesAddedObservable.add(this._onClipPlanesAdded.bind(this));
                this._clipPlanesRemovedObservers = this._holoBounds.clipPlanesRemovedObservable.add(this._onClipPlanesRemoved.bind(this));
            }
        }
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

    protected _prepareUniforms(name: string, ...properties: string[]): string[] {
        return properties.map((p) => `${name}.${p}`);
    }

    protected _onClipPlanesAdded(planes: Array<ClipPlaneDefinition>): void {
        this.markAsDirty(Material.AttributesDirtyFlag);
    }

    protected _onClipPlanesRemoved(planes: Array<ClipPlaneDefinition>): void {
        this.markAsDirty(Material.AttributesDirtyFlag);
    }

    private _onEffectCompiled(effect: Effect): void {
        // console.log("DEFINES:", effect.defines);
        // console.log("VERTEX:", effect.vertexSourceCode);
        // console.log("FRAGMENT:", effect.fragmentSourceCode);
        if (this.onCompiled) {
            this.onCompiled(effect);
        }
    }

    private _getElevationRange(): Range {
        if (this._elevationRange === null) {
            this._elevationRange = this._buildElevationRange();
        }
        return this._elevationRange;
    }

    private _invalidateElevationRange(): void {
        this._elevationRange = null;
    }

    private _buildElevationRange(): Range {
        let range: Nullable<Range> = null;
        for (let b of this._elevationTileLayouts.values()) {
            const infos = b.tile.content;
            if (infos) {
                if (range === null) {
                    range = new Range(infos.min.z, infos.max.z);
                    continue;
                }
                range.unionInPlace(infos.min.z, infos.max.z);
            }
        }
        return range ?? new Range(Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER);
    }

    private _updateElevationRange(infos: Nullable<ElevationType>): void {
        if (infos) {
            this._getElevationRange().unionInPlace(infos.min.z, infos.max.z);
            this.markAsDirty(Material.AttributesDirtyFlag);
        }
    }
}
