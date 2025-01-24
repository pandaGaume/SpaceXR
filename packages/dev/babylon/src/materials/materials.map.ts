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
import { IElevationHost, IMap3dMaterial, IsElevationHost, IsTileWithMesh, ITileWithMesh } from "../map/map.interfaces";
import { ICartesian3, ISize3, Size3 } from "core/geometry";
import { ClipIndex, ClipPlaneDefinition, IHolographicBounds, IsHolographicBox, IsHolographicCylinder, IsHolographicSphere } from "../display";
import { ITexture3Layer, Texture3 } from "./textures";
import { Observer } from "core/events";
import { ImageLayerContentType, ITile, ITileMapLayerView } from "core/tiles";
import { IDemInfos } from "core/dem";

export enum Map3dLayerKind {
    ELEVATION = 0,
    NORMAL = 1,
    TEXTURE = 2,
}

class AreaInfos {
    layer: ITexture3Layer;
    public constructor(layer: ITexture3Layer) {
        this.layer = layer;
    }
}

// internal class used to hold the tile pool texture areas
class TileLayout<T extends ImageLayerContentType> {
    public constructor(public tile: ITileWithMesh<T>, public areas: Array<Nullable<AreaInfos>> = [null, null, null]) {}

    getArea(kind: Map3dLayerKind): Nullable<AreaInfos> {
        return this.areas[kind];
    }

    setArea(kind: Map3dLayerKind, value: Nullable<AreaInfos>): void {
        this.areas[kind] = value;
    }
}

export class Map3dMaterial extends PushMaterial implements IMap3dMaterial {
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

    // the name of the shader used by the material
    protected _shaderName: Nullable<string> = null;

    // the optional holographix box where the material is used
    private _holoBounds: Nullable<IHolographicBounds> = null;
    // the observers for the holographic box clip planes
    private _clipPlanesAddedObservers: Nullable<Observer<Array<ClipPlaneDefinition>>> = null;
    private _clipPlanesRemovedObservers: Nullable<Observer<Array<ClipPlaneDefinition>>> = null;

    private _textureSampler: Nullable<Texture3> = null;

    // the elevation related properties.
    //private _elevationRange: Nullable<Range> = null;
    private _mapScale: ICartesian3 = Vector3.One();

    // the layout and meta properties of each tiles
    protected _tileLayouts: Map<string, TileLayout<any>> = new Map<string, TileLayout<any>>();

    // the resolution of the display
    private _displayResolution: ISize3 = Size3.Zero();

    public constructor(name: string, scene?: Scene, shaderName?: string) {
        super(name, scene);
        this._shaderName = shaderName ?? Map3dMaterial.ShaderName;
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

        const samplers = [Map3dMaterial.TextureSamplerUniformName];
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

    public addTile<T extends ImageLayerContentType>(tile: ITile<IDemInfos> | ITileWithMesh<T>, source: ITileMapLayerView<IDemInfos> | IElevationHost<T>): void {
        if (IsTileWithMesh(tile)) {
            const surface = tile.surface;
            if (!surface) {
                throw new Error("Tile surface is not defined");
            }

            if (IsElevationHost(source)) {
                this._ensureTextureSamplersReady(source);
            }

            const key = tile.address.quadkey;
            let layout = new TileLayout(tile);
            this._tileLayouts.set(key, layout);

            let textureArea = this._reserveArea(this._textureSampler);
            if (textureArea === undefined) {
                return;
            }

            // the depth of the texture x=uvs, y=ids
            const textureDepths = new Vector4(textureArea.depth, -1, -1, -1);
            surface.instancedBuffers[Map3dMaterial.TextureDepthsAttName] = textureDepths;

            let areaInfos = new AreaInfos(textureArea);
            let kind = Map3dLayerKind.TEXTURE;
            layout.setArea(kind, areaInfos);
            if (tile.content) {
                areaInfos.layer.update(tile.content);
                tile.surface?.setEnabled(true);
            }
            this.markAsDirty(Material.TextureDirtyFlag);
        }
    }

    public removeTile<T extends ImageLayerContentType>(tile: ITile<IDemInfos> | ITileWithMesh<T>, source: ITileMapLayerView<IDemInfos> | IElevationHost<T>): void {
        if (IsTileWithMesh(tile)) {
            const key = tile.address.quadkey;
            const layout = this._tileLayouts.get(key);
            if (layout) {
                if (tile.surface) {
                    tile.surface.instancedBuffers.textureDepths.x = -1;
                }
                layout.getArea(Map3dLayerKind.TEXTURE)?.layer.release();
                this._tileLayouts.delete(key);
                this.markAsDirty(Material.TextureDirtyFlag);
            }
        }
    }
    public updateTile<T extends ImageLayerContentType>(tile: ITile<IDemInfos> | ITileWithMesh<T>, source: ITileMapLayerView<IDemInfos> | IElevationHost<T>): void {
        if (IsTileWithMesh(tile)) {
            const key = tile.address.quadkey;
            const layout = this._tileLayouts.get(key);
            if (layout) {
                if (tile.content) {
                    let kind = Map3dLayerKind.TEXTURE;
                    let areaInfos = layout.getArea(kind);
                    if (areaInfos) {
                        areaInfos.layer.update(tile.content);
                        tile.surface?.setEnabled(true);
                        this.markAsDirty(Material.TextureDirtyFlag);
                    }
                }
            }
        }
    }

    public dispose(forceDisposeEffect?: boolean): void {
        super.dispose(forceDisposeEffect);
        this._textureSampler?.dispose();
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

    protected _ensureTextureSamplersReady<T extends ImageLayerContentType>(src: IElevationHost<T>): void {
        if (!this._textureSampler) {
            let size = src.metrics.tileSize;
            this._textureSampler = this._buildTextureSampler(size, size);
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
        //target.registerInstancedBuffer(Map3dMaterial.ElevationDepthsAttName, Map3dMaterial.ElevationDepthsSize);
        //target.registerInstancedBuffer(Map3dMaterial.NormalDepthsAttName, Map3dMaterial.NormalDepthsSize);
        target.registerInstancedBuffer(Map3dMaterial.TextureDepthsAttName, Map3dMaterial.TextureDepthsSize);
    }

    protected _buildTextureSampler(width: number, height?: number, depth?: number): Texture3 {
        height = height ?? width;
        const maxDepth = depth ?? this._getOverallSamplerDepth(width, height);
        const generateMipMap = false;
        const scene = this.getScene();
        return <Texture3>this._buildSampler(Map3dLayerKind.TEXTURE, width, height, maxDepth, generateMipMap, scene);
    }

    protected _buildSampler(kind: Map3dLayerKind, width: number, height: number, depth: number, generateMipMap: boolean, scene: Scene): Nullable<Texture3> {
        switch (kind) {
            case Map3dLayerKind.TEXTURE: {
                const options = {
                    width: width,
                    height: height,
                    depth: depth,
                    format: Constants.TEXTUREFORMAT_RGB,
                    textureType: Constants.TEXTURETYPE_UNSIGNED_BYTE,
                    samplingMode: Constants.TEXTURE_BILINEAR_SAMPLINGMODE,
                    internalFormat: scene.getEngine()._gl.RGB8,
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

    protected _getOverallSamplerDepth(width: number, height: number): number {
        if (Size3.IsEmpty(this._displayResolution)) {
            return Map3dMaterial.DefaultElevationTextureDepth; // we set a fixed number of tiles
        }

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
}
