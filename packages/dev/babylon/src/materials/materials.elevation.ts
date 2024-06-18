import {
    AbstractMesh,
    Color4,
    Constants,
    Effect,
    EffectFallbacks,
    HemisphericLight,
    IEffectCreationOptions,
    InstancedMesh,
    Light,
    Material,
    MaterialDefines,
    MaterialHelper,
    Matrix,
    Mesh,
    Nullable,
    Observer,
    PointLight,
    PushMaterial,
    Scene,
    SpotLight,
    SubMesh,
    Vector2,
    Vector3,
    Vector4,
    VertexBuffer,
} from "@babylonjs/core";

import { IPipelineMessageType, ITargetBlock, ITile, IsTileMetricsProvider, TileAddress } from "core/tiles";
import { Range } from "core/math";
import { ClipIndex, ClipPlaneDefinition, IHasHolographicBox, IHolographicBox } from "../display";
import { ElevationTile, IHasMapScale } from "../map";
import { ITexture3Layer, Texture3 } from "./textures";
import { ICartesian3, ISize2 } from "core/geometry";
import { EventState } from "..";

export enum Map3dShadingMode {
    // In flat shading, a single color is computed per polygon face,
    // and all pixels within that face are assigned the same color.
    // This can give a faceted look to the 3D model. This is the default shading mode when no texture layers are used.
    // OpenGL function: glShadeModel(GL_FLAT);
    FLAT,
    // In Gouraud shading, lighting calculations are done at the vertices,
    // and the resulting vertex colors are interpolated across the surface of the polygon.
    // This can produce smoother transitions between colors on the surface.
    // OpenGL function: glShadeModel(GL_SMOOTH);
    GOUREAUD,
    // n Phong shading, lighting calculations are performed per pixel (fragment).
    // The normal vectors are interpolated across the surface of the polygon, and the lighting
    // equation is applied to each pixel. This produces a smoother and more realistic shading
    // effect compared to Gouraud shading.
    // Phong shading is not directly supported by the fixed-function pipeline in legacy OpenGL
    // but can be implemented using GLSL (OpenGL Shading Language).
    PHONG,
    // A variant of Phong shading that uses a different approach to calculate the specular highlight.
    // It is often preferred because it can be more efficient.
    // Like Phong shading, Blinn-Phong shading is implemented using GLSL.
    BLINN_PHONG,
}

class AreaInfos {
    layer: ITexture3Layer;
    adjacentIds: Array<number> = [-1, -1, -1, -1];
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
class TileBag {
    public constructor(public tile: ElevationTile, public areas: Array<Nullable<AreaInfos>> = [null, null, null]) {}

    getArea(kind: Map3dLayerKind): Nullable<AreaInfos> {
        return this.areas[kind];
    }

    setArea(kind: Map3dLayerKind, value: Nullable<AreaInfos>): void {
        this.areas[kind] = value;
    }
}

export interface IMap3dMaterial extends ITargetBlock<ElevationTile | ITile<ImageData>>, IHasHolographicBox, IHasMapScale {}

/**
 * Base class for Map3D related materials. This class is intended to be used as a base class for
 * different materials that are used to render 3D maps such as EllipsoidMaterial and WebMapMaterial.
 * Thus materials are related to a specific geometry which are implemented into the vertex shader.
 * Commons properties and methods are implemented in this class, such as data samplers (elevation, normals and layer)
 * and clip planes.
 * Support ONLY ONE dem layer and ONE layer texture.
 */
export class Map3dMaterial extends PushMaterial implements IMap3dMaterial {
    public static DefaultTerrainColor: Color4 = Color4.FromInts(70, 130, 180, 255); // cool steel blue

    public static DemInfosAttName: string = "demInfos";
    public static DemIdsAttName: string = "demIds";
    public static NormalIdsAttName: string = "normalIds";
    public static TextureIdsAttName: string = "textureIds";

    public static WorldMatrixUniformName: string = "world";
    public static ViewProjectionMatrixUniformName: string = "viewProjection";

    public static TerrainColorUniformName: string = "uTerrainColor";
    public static ShininessUniformName: string = "uShininess";
    public static HemiLightUniformName: string = "uHemiLight";
    public static PointLightsUniformName: string = "uPointLights";
    public static SpotLightsUniformName: string = "uSpotLights";
    public static NumPointLightsUniformName: string = "uNumPointLights";
    public static NumSpotLightsUniformName: string = "uNumSpotLights";
    public static AmbientLightUniformName: string = "uAmbientLight";

    public static AltRangeUniformName: string = "uAltRange";
    public static MapScaleUniformName: string = "uMapScale";

    public static ElevationSamplerUniformName: string = "uAltitudes";
    public static NormalSamplerUniformName: string = "uNormals";
    public static TextureSamplerUniformName: string = "uTextures";
    public static SpecularMapSamplerUniformName: string = "uSpecularMap";

    public static NorthClipPlaneUniformName: string = "uNorthClip";
    public static SouthClipPlaneUniformName: string = "uSouthClip";
    public static EastClipPlaneUniformName: string = "uEastClip";
    public static WestClipPlaneUniformName: string = "uWestClip";

    // the properties used by the material
    protected _shaderName: Nullable<string> = null;

    // the terrain color if no texture defined
    protected _terrainColor: Nullable<Color4> = Map3dMaterial.DefaultTerrainColor;
    // the shininess of the material if no texture defined
    protected _shininess: number = 0.0;
    // shading mode used by the material if no texture defined
    protected _shadingMode: Map3dShadingMode = Map3dShadingMode.BLINN_PHONG;
    // the max number of lights used by the material
    protected _maxSpotLights: number = 3;
    protected _maxPointLights: number = 3;

    // the properties of tiles
    protected _bags: Map<string, TileBag> = new Map<string, TileBag>();

    // the samplers for the elevation, normal and layer textures.
    private _elevationSampler: Nullable<Texture3> = null;
    private _normalSampler: Nullable<Texture3> = null;
    private _textureSampler: Nullable<Texture3> = null;

    // the elevation related properties.
    private _elevationRange: Nullable<Range> = null;
    private _mapScale: ICartesian3 = Vector3.One();

    // the optional display where the material is used
    private _holoBounds: Nullable<IHolographicBox> = null;

    // the texture reolution used by the material
    private _textureResolution?: ISize2;

    // the light filter used by the material, if any
    protected _lightFilter: Nullable<(light: Light) => boolean> = null;
    protected _lightAddedObserver: Nullable<Observer<Light>> = null;
    protected _lightRemovedObserver: Nullable<Observer<Light>> = null;

    public constructor(name: string, shaderName: string, scene?: Scene) {
        super(name, scene);
        if (!shaderName) throw new Error("shaderName is required");
        this._shaderName = shaderName;
        // setting up the light filter and observers
        this._setupLights();
    }

    public get textureResolution(): ISize2 | undefined {
        return this._textureResolution;
    }

    public set textureResolution(value: ISize2 | undefined) {
        this._textureResolution = value;
    }

    public get holographicBox(): Nullable<IHolographicBox> {
        return this._holoBounds;
    }

    public set holographicBox(value: Nullable<IHolographicBox>) {
        if (this._holoBounds === value) return;
        this._holoBounds = value;
        this.markAsDirty(Material.AttributesDirtyFlag);
    }

    public getLights(): Light[] {
        return this._lightFilter ? this.getScene().lights.filter(this._lightFilter) : this.getScene().lights;
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

    public get terrainColor(): Nullable<Color4> {
        return this._terrainColor;
    }

    public set terrainColor(value: Nullable<Color4>) {
        if (this._terrainColor !== value) {
            this._terrainColor = value;
            this.markAsDirty(Material.AttributesDirtyFlag);
        }
    }

    public get shininess(): number {
        return this._shininess;
    }

    public set shininess(value: number) {
        if (this._shininess !== value) {
            this._shininess = value;
            this.markAsDirty(Material.AttributesDirtyFlag);
        }
    }

    /// #region ITargetBlock
    public added(eventData: IPipelineMessageType<ElevationTile | ITile<ImageData>>, eventState: EventState): void {
        for (let tile of eventData) {
            if (tile instanceof ElevationTile) {
                this._demAdded(tile, eventState.currentTarget);
                continue;
            }
            this._imageAdded(tile);
        }
    }

    public removed(eventData: IPipelineMessageType<ElevationTile | ITile<ImageData>>, eventState: EventState): void {
        for (let tile of eventData) {
            if (tile instanceof ElevationTile) {
                this._demRemoved(tile);
                continue;
            }
            this._imageRemoved(tile);
        }
    }

    public updated(eventData: IPipelineMessageType<ElevationTile | ITile<ImageData>>, eventState: EventState): void {
        for (let tile of eventData) {
            if (tile instanceof ElevationTile) {
                this._demUpdated(tile);
                continue;
            }
            this._imageUpdated(tile);
        }
    }
    /// #endregion

    public isReadyForSubMesh(mesh: AbstractMesh, subMesh: SubMesh, useInstances?: boolean): boolean {
        return this._isReady(mesh, subMesh, useInstances);
    }

    protected _prepareUniforms(name: string, ...properties: string[]): string[] {
        return properties.map((p) => `${name}.${p}`);
    }

    protected _prepareArrayOfUniforms(name: string, count: number, ...properties: string[]): string[] {
        const result = new Array<string>();
        for (let i = 0; i < count; i++) {
            for (let p of properties) {
                result.push(`${name}[${i}].${p}`);
            }
        }
        return result;
    }

    protected _isReady(mesh: AbstractMesh, subMesh: SubMesh, useInstances?: boolean): boolean {
        const drawWrapper = subMesh._drawWrapper;

        if (this.isFrozen) {
            if (drawWrapper._wasPreviouslyReady && drawWrapper._wasPreviouslyUsingInstances === useInstances) {
                return true;
            }
        }

        const defines: MaterialDefines = new MaterialDefines();
        const scene = this.getScene();

        if (this._isReadyForSubMesh(subMesh)) {
            return true;
        }

        const attribs = [VertexBuffer.PositionKind, VertexBuffer.UVKind, Map3dMaterial.DemIdsAttName];

        const hemiLightProperties = ["skyColor", "groundColor", "direction", "intensity"];
        const pointLightProperties = ["position", "color", "intensity"];
        const spotLightProperties = ["position", "direction", "color", "intensity", "innerCutoff", "outerCutoff", "exponent"];

        const uniforms = [
            // babylon related
            Map3dMaterial.ViewProjectionMatrixUniformName,

            // elevations
            Map3dMaterial.AltRangeUniformName,
            Map3dMaterial.MapScaleUniformName,

            // lights and colors
            Map3dMaterial.TerrainColorUniformName,
            Map3dMaterial.AmbientLightUniformName,

            ...this._prepareUniforms(Map3dMaterial.HemiLightUniformName, ...hemiLightProperties),
            ...this._prepareArrayOfUniforms(Map3dMaterial.PointLightsUniformName, this._maxPointLights, ...pointLightProperties),
            ...this._prepareArrayOfUniforms(Map3dMaterial.SpotLightsUniformName, this._maxSpotLights, ...spotLightProperties),

            Map3dMaterial.NumPointLightsUniformName,
            Map3dMaterial.NumSpotLightsUniformName,
        ];

        const samplers = [Map3dMaterial.ElevationSamplerUniformName, Map3dMaterial.NormalSamplerUniformName, Map3dMaterial.TextureSamplerUniformName];
        const uniformBuffers = new Array<string>();
        const fallbacks = new EffectFallbacks();
        const engine = scene.getEngine();

        switch (this._shadingMode) {
            case Map3dShadingMode.FLAT:
                defines.FLAT_SHADING = true;
                break;
            case Map3dShadingMode.GOUREAUD:
                defines.GOUREAUD_SHADING = true;
                break;
            case Map3dShadingMode.PHONG:
                defines.PHONG_SHADING = true;
                break;
            case Map3dShadingMode.BLINN_PHONG:
                defines.BLINN_PHONG_SHADING = true;
                break;
        }

        if (this._maxSpotLights) {
            defines.MAX_SPOT_LIGHTS = this._maxSpotLights;
        }

        if (this._maxPointLights) {
            defines.MAX_POINT_LIGHTS = this._maxPointLights;
        }

        if (this._shininess > 0.0) {
            defines.SPECULAR = true;
            uniforms.push(Map3dMaterial.ShininessUniformName);
        }

        if (this._holoBounds) {
            defines.CLIP_PLANES = true;
            const properties = ["point", "normal"];
            uniforms.push(
                // clip planes
                ...this._prepareUniforms(Map3dMaterial.NorthClipPlaneUniformName, ...properties),
                ...this._prepareUniforms(Map3dMaterial.SouthClipPlaneUniformName, ...properties),
                ...this._prepareUniforms(Map3dMaterial.EastClipPlaneUniformName, ...properties),
                ...this._prepareUniforms(Map3dMaterial.WestClipPlaneUniformName, ...properties)
            );
        }

        // we heavily rely on instances
        defines.INSTANCES = true;
        MaterialHelper.PushAttributesForInstances(attribs);

        defines.rebuild();

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

    // called when dem tile added
    protected _demAdded(tile: ElevationTile, source: any): void {
        this._ensureElevationLayerReady(tile, source);

        const elevationTile = tile as ElevationTile;

        // we reserve the texture areas for the tile
        const bag = new TileBag(elevationTile);
        // we store the bag for the tile
        this._bags.set(tile.address.quadkey, bag);

        // prepare the elevation sampler.
        let elevationArea = this._elevationSampler?.reserve();
        if (!elevationArea) {
            // this is the place where we need to reallocate some depth into the samplers
            this._growSamplersDepth();
            elevationArea = this._elevationSampler?.reserve();
        }
        if (elevationArea) {
            const areaInfos = new AreaInfos(elevationArea);
            bag.setArea(Map3dLayerKind.Elevation, areaInfos);
            // prepare the adjacent ids.
            this._updateAdjacentIds(bag, Map3dLayerKind.Elevation);
            const elevations = tile.content?.infos?.elevations;
            if (elevations) {
                // we process the dem content and update the elevation range
                this._updateElevationRange(tile);
                elevationArea.update(elevations);
                areaInfos.isReady = true;
            } else {
                // disabling the surface, waiting for the data
                tile.content?.surface?.setEnabled(false);
                areaInfos.isReady = false;
            }
        }

        // prepare the normal sampler
        const normalArea = this._normalSampler?.reserve();
        if (normalArea) {
            bag.setArea(Map3dLayerKind.Normal, new AreaInfos(normalArea));
            const normals = tile.content?.infos?.normals;
            if (normals) {
                normalArea.update(normals);
            }
        }

        // prepare the texture sampler
        const textureArea = this._textureSampler?.reserve();
        if (textureArea) {
            bag.setArea(Map3dLayerKind.Texture, new AreaInfos(textureArea));
        }

        this.markAsDirty(Material.TextureDirtyFlag);
    }

    protected _updateAdjacentIds(bag: TileBag, kind: Map3dLayerKind): void {
        const area = bag.getArea(kind);
        if (!area) return;
        const depth = area.layer.depth;
        const quadkey = bag.tile.address.quadkey;
        const keys = TileAddress.ToNeigborsKey(quadkey);

        area.adjacentIds[1] = this._getAdjacentIds(keys[5], kind);
        area.adjacentIds[2] = this._getAdjacentIds(keys[7], kind);
        area.adjacentIds[3] = this._getAdjacentIds(keys[8], kind);

        this._setAdjacentIdsFromBag(bag, 0, kind, depth);

        this._setAdjacentIds(keys[3], 1, kind, depth);
        this._setAdjacentIds(keys[1], 2, kind, depth);
        this._setAdjacentIds(keys[0], 3, kind, depth);
    }

    protected _getAdjacentIds(quadkey: Nullable<string>, kind: Map3dLayerKind, index: number = 0): number {
        if (!quadkey) return -1;
        const bag = this._bags.get(quadkey);
        const a = bag?.getArea(kind);
        if (a === undefined || a === null || a.isReady == false) {
            return -1;
        }
        return a.adjacentIds[index];
    }

    protected _setAdjacentIds(quadkey: Nullable<string>, index: number, kind: Map3dLayerKind, id: number = -1): void {
        if (!quadkey) return;
        const bag = this._bags.get(quadkey);
        if (!bag) return;
        this._setAdjacentIdsFromBag(bag, index, kind, id);
    }

    protected _setAdjacentIdsFromBag(bag: TileBag, index: number, kind: Map3dLayerKind, id: number = -1): void {
        const area = bag.getArea(kind);
        if (area) {
            area.adjacentIds[index] = id;
            // update the attribute
            const surface = bag.tile.content?.surface;
            if (surface) {
                surface.instancedBuffers.demIds = Vector4.FromArray(area.adjacentIds);
            }
        }
    }

    protected _createZeroBuffer(n: number): ArrayBufferView {
        const buffer = new ArrayBuffer(n);
        return new Float32Array(buffer);
    }

    protected _demRemoved(eventData: ElevationTile): void {
        const qk = eventData.address.quadkey;
        const bag = this._bags.get(qk);
        if (bag) {
            // Create a zero-filled buffer
            const size = eventData.content?.infos?.elevations?.buffer.byteLength ?? 0;
            if (size) {
                const zero = this._createZeroBuffer(size);
                bag.getArea(Map3dLayerKind.Elevation)?.layer.update(zero);
            }
            bag.getArea(Map3dLayerKind.Elevation)?.layer.release();
            bag.getArea(Map3dLayerKind.Normal)?.layer.release();
            bag.getArea(Map3dLayerKind.Texture)?.layer.release();
            this._bags.delete(qk);
            this._elevationRange = null;
        }

        this.markAsDirty(Material.TextureDirtyFlag);
    }

    protected _demUpdated(eventData: ElevationTile): void {
        const bag = this._bags.get(eventData.address.quadkey);
        if (bag) {
            const elevations = eventData.content?.infos?.elevations;
            if (elevations) {
                // we update the elevation range
                this._updateElevationRange(eventData);
                bag.tile.content?.surface?.setEnabled(true);
                const area = bag.getArea(Map3dLayerKind.Elevation);
                if (area) {
                    area.layer.update(elevations);
                    area.isReady = true;
                    this._updateAdjacentIds(bag, Map3dLayerKind.Elevation);
                }
            }
            const normals = eventData.content?.infos?.normals;
            if (normals) {
                bag.getArea(Map3dLayerKind.Normal)?.layer.update(normals);
            }
        }
        this.markAsDirty(Material.TextureDirtyFlag);
    }

    protected _imageAdded(tile: ITile<ImageData>): void {
        // nothing to do here while the the image is strongly coupled with the elevation tile
    }

    protected _imageRemoved(tile: ITile<ImageData>): void {
        // nothing to do here while the the image is strongly coupled with the elevation tile
    }

    protected _imageUpdated(tile: ITile<ImageData>): void {
        // this is the only event it will be raised by the texture source. this will let us to feed the texture sampler
        // with the image data. the tile address is suppose to be the same as the elevation tile.
        // so we may
        // 1 - retrieve the correponding bag
        // 2 - retrieve the texture area
        // 3 - update the texture area with the image data
        const bag = this._bags.get(tile.address.quadkey);
        if (bag) {
            const area = bag.getArea(Map3dLayerKind.Texture);
            if (area) {
                area.layer.update(tile.content);
            }
        }
    }

    public dispose(forceDisposeEffect?: boolean, forceDisposeTextures?: boolean, notBoundToMesh?: boolean): void {
        this._bags.clear();
        this._elevationSampler?.dispose();
        this._normalSampler?.dispose();
        this._textureSampler?.dispose();
        this._lightAddedObserver?.remove();
        this._lightRemovedObserver?.remove();

        super.dispose(forceDisposeEffect, forceDisposeTextures, notBoundToMesh);
    }

    public bindForSubMesh(world: Matrix, mesh: Mesh, subMesh: SubMesh): void {
        const scene = this.getScene();

        const defines = subMesh.materialDefines;
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

        if (this._mustRebind(scene, effect, subMesh)) {
            // Clip planes
            this._bindClipPlanes(effect);
            // samplers
            this._bindSamplers(effect);
            // Elevations.
            this._bindElevations(effect);
            // lights
            this._bindLights(effect);
            // matter
            this._bindTerrainMatter(effect);
        }
    }

    protected _bindLights(effect: Effect): void {
        let pointLightCount = 0;
        let spotLightCount = 0;
        const scene = this.getScene();
        if (scene.ambientColor && (scene.ambientColor.r !== 0 || scene.ambientColor.g !== 0 || scene.ambientColor.b !== 0)) {
            effect.setColor3(Map3dMaterial.AmbientLightUniformName, scene.ambientColor);
        }
        for (let l of this.getLights()) {
            if (l instanceof HemisphericLight) {
                effect
                    .setColor3(`${Map3dMaterial.HemiLightUniformName}.skyColor`, l.diffuse)
                    .setColor3(`${Map3dMaterial.HemiLightUniformName}.groundColor`, l.groundColor)
                    .setVector3(`${Map3dMaterial.HemiLightUniformName}.direction`, l.direction)
                    .setFloat(`${Map3dMaterial.HemiLightUniformName}.intensity`, l.intensity);
                continue;
            }
            if (l instanceof PointLight && pointLightCount < this._maxPointLights) {
                effect
                    .setVector3(`${Map3dMaterial.PointLightsUniformName}[${pointLightCount}].position`, l.position)
                    .setColor3(`${Map3dMaterial.PointLightsUniformName}[${pointLightCount}].color`, l.diffuse)
                    .setFloat(`${Map3dMaterial.PointLightsUniformName}[${pointLightCount}].intensity`, l.intensity);
                pointLightCount++;
                continue;
            }
            if (l instanceof SpotLight && spotLightCount < this._maxSpotLights) {
                effect
                    .setVector3(`${Map3dMaterial.SpotLightsUniformName}[${spotLightCount}].position`, l.position)
                    .setVector3(`${Map3dMaterial.SpotLightsUniformName}[${spotLightCount}].direction`, l.direction)
                    .setColor3(`${Map3dMaterial.SpotLightsUniformName}[${spotLightCount}].color`, l.diffuse)
                    .setFloat(`${Map3dMaterial.SpotLightsUniformName}[${spotLightCount}].intensity`, l.intensity);

                const innerCutoff = Math.cos(l.angle / 2.0); // Inner cutoff
                const outerCutoff = Math.cos((l.angle * 1.5) / 2.0); // Outer cutoff, slightly larger angle for smooth transition

                effect
                    .setFloat(`${Map3dMaterial.SpotLightsUniformName}[${spotLightCount}].innerCutoff`, innerCutoff)
                    .setFloat(`${Map3dMaterial.SpotLightsUniformName}[${spotLightCount}].outerCutoff`, outerCutoff)
                    .setFloat(`${Map3dMaterial.SpotLightsUniformName}[${spotLightCount}].exponent`, l.exponent);

                spotLightCount++;
                continue;
            }
        }
        effect.setInt(Map3dMaterial.NumPointLightsUniformName, pointLightCount).setInt(Map3dMaterial.NumSpotLightsUniformName, spotLightCount);
    }

    protected _bindTerrainMatter(effect: Effect): void {
        if (this._terrainColor) {
            effect.setColor4(Map3dMaterial.TerrainColorUniformName, this._terrainColor, this._terrainColor.a);
        } else {
            effect.setColor4(Map3dMaterial.TerrainColorUniformName, Map3dMaterial.DefaultTerrainColor, 1.0);
        }
        if (this._shininess > 0.0) {
            effect.setFloat(Map3dMaterial.ShininessUniformName, this._shininess);
        }
    }

    protected _bindElevations(effect: Effect): void {
        const r = this._getElevationRange();
        effect.setVector2(Map3dMaterial.AltRangeUniformName, new Vector2(r.min, r.max));
        effect.setFloat(Map3dMaterial.MapScaleUniformName, this._mapScale.x);
    }

    protected _bindMatrix(effect: Effect, world: Matrix, scene: Scene): void {
        effect.setMatrix(Map3dMaterial.ViewProjectionMatrixUniformName, scene.getTransformMatrix());
    }

    protected _bindClipPlanes(effect: Effect): void {
        if (this._holoBounds) {
            const clips = this._holoBounds.clipPlanesWorld;
            if (clips) {
                this._bindClipPlane(effect, clips, Map3dMaterial.NorthClipPlaneUniformName, ClipIndex.North);
                this._bindClipPlane(effect, clips, Map3dMaterial.SouthClipPlaneUniformName, ClipIndex.South);
                this._bindClipPlane(effect, clips, Map3dMaterial.EastClipPlaneUniformName, ClipIndex.East);
                this._bindClipPlane(effect, clips, Map3dMaterial.WestClipPlaneUniformName, ClipIndex.West);
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
        effect.setTexture(Map3dMaterial.NormalSamplerUniformName, this._normalSampler);
        effect.setTexture(Map3dMaterial.TextureSamplerUniformName, this._textureSampler);
    }

    protected _acceptLight(light: Light): boolean {
        return light !== undefined && (light instanceof PointLight || light instanceof HemisphericLight || light instanceof SpotLight);
    }

    protected _lightAdded(light: Light): void {
        if (!this._lightFilter || this._lightFilter(light)) {
            this.markAsDirty(Material.LightDirtyFlag);
        }
    }

    protected _lightRemoved(light: Light): void {
        if (!this._lightFilter || this._lightFilter(light)) {
            this.markAsDirty(Material.LightDirtyFlag);
        }
    }

    protected _setupLights() {
        this._lightFilter = this._acceptLight.bind(this);
        this._lightAddedObserver = this.getScene().onNewLightAddedObservable.add(this._lightAdded.bind(this));
        this._lightRemovedObserver = this.getScene().onLightRemovedObservable.add(this._lightRemoved.bind(this));
    }

    protected _registerInstanceBuffers(target: Mesh): void {
        target.registerInstancedBuffer(Map3dMaterial.DemIdsAttName, 4);
    }

    protected _ensureElevationLayerReady(tile: ElevationTile, src: any): void {
        // ensure the samplers are ready (altitude and normal)
        if (!this._elevationSampler) {
            let size = IsTileMetricsProvider(src) ? src.metrics.tileSize : 0;
            if (!size) {
                size = Math.sqrt(tile.content?.infos?.elevations?.length ?? 0);
            }
            if (size) {
                this._buildElevationSamplers(size);
                if (this._textureResolution) {
                    this._buildTextureSamplers(this._textureResolution.width, this._textureResolution.height);
                } else {
                    this._buildTextureSamplers(size);
                }
                const mesh = tile.content?.surface instanceof InstancedMesh ? tile.content.surface.sourceMesh : (tile.content?.surface as Mesh);
                this._registerInstanceBuffers(mesh);
                this.markAsDirty(Material.TextureDirtyFlag);
            }
        }
    }

    protected _buildElevationSamplers(width: number, height?: number, depth?: number): void {
        height = height ?? width;
        const maxDepth = depth ?? this._getElevationSamplerDepth();
        const generateMipMap = false;
        const scene = this.getScene();
        this._elevationSampler = <Texture3>this._buildSampler(Map3dLayerKind.Elevation, width, height, maxDepth, generateMipMap, scene);
        this._normalSampler = <Texture3>this._buildSampler(Map3dLayerKind.Normal, width, height, maxDepth, generateMipMap, scene);
        this._textureSampler = <Texture3>this._buildSampler(Map3dLayerKind.Texture, width, height, maxDepth, generateMipMap, scene);
    }

    protected _buildTextureSamplers(width: number, height?: number, depth?: number): void {
        height = height ?? width;
        const maxDepth = depth ?? this._getTextureSamplerDepth();
        const generateMipMap = true;
        const scene = this.getScene();
        this._textureSampler = <Texture3>this._buildSampler(Map3dLayerKind.Texture, width, height, maxDepth, generateMipMap, scene);
    }

    protected _getTextureSamplerDepth(): number {
        return 24; // for dev purpose we set a fixed number of tiles
    }

    protected _getElevationSamplerDepth(): number {
        return 24; // for dev purpose we set a fixed number of tiles
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

    protected _onEffectCompiled(effect: Effect): void {
        //console.log("DEFINES:", effect.defines);
        //console.log("VERTEX:", effect.vertexSourceCode);
        //console.log("FRAGMENT:", effect.fragmentSourceCode);
        if (this.onCompiled) {
            this.onCompiled(effect);
        }
    }

    protected _onEffectError(effect: Effect, errors: string): void {
        //console.error("ERRORS:", errors);
        if (this.onError) {
            this.onError(effect, errors);
        }
    }

    protected _buildElevationRange(): Range {
        let range: Nullable<Range> = null;
        for (let b of this._bags.values()) {
            const infos = b.tile.content?.infos;
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

    protected _updateElevationRange(elevationTile: ElevationTile): void {
        const infos = elevationTile.content?.infos;
        if (infos) {
            this._getElevationRange().unionInPlace(infos.min.z, infos.max.z);
            this.markAsDirty(Material.AttributesDirtyFlag);
        }
    }

    protected _getElevationRange(): Range {
        if (this._elevationRange === null) {
            this._elevationRange = this._buildElevationRange();
        }
        return this._elevationRange;
    }

    protected _growSamplersDepth(): void {
        // this is the place we gonna grow the depth of the samplers
        // TODO
    }

    public debug(ctx: CanvasRenderingContext2D, x: number, y: number, tile: ITile<Map3dMaterial>, scale: number): void {
        // this is the place where we can draw some debug information
        // such as the elevation range, the texture areas, etc.
    }
}
