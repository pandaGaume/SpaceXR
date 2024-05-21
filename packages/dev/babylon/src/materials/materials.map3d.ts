import {
    AbstractMesh,
    Color4,
    Constants,
    Effect,
    EffectFallbacks,
    HemisphericLight,
    IEffectCreationOptions,
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
    VertexBuffer,
} from "@babylonjs/core";

import { ITile, ImageLayer, TileAddress } from "core/tiles";
import { Range } from "core/math";
import { ClipIndex, ClipPlaneDefinition } from "./materials.clipPlane";
import { ElevationLayer, IMap3dElevationTarget, IMap3dImageTarget } from "../map";
import { ITexture3Layer, Texture3 } from "./textures";
import { Map3dTexture } from "./textures";
import { IDemInfos } from "core/dem";

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

// internal class used to hold the tile pool texture areas
class TileBag {
    public constructor(
        public tile: ITile<IDemInfos>,
        public elevationArea: Nullable<ITexture3Layer> = null,
        public normalArea: Nullable<ITexture3Layer> = null,
        public AdjacentIds: Array<number> = [-1, -1, -1, -1]
    ) {}
}

/**
 * Base class for Map3D related materials. This class is intended to be used as a base class for
 * different materials that are used to render 3D maps such as EllipsoidMaterial and WebMapMaterial.
 * Thus materials are related to a specific geometry which are implemented into the vertex shader.
 * Commons properties and methods are implemented in this class, such as data samplers (elevation, normals and layer)
 * and clip planes.
 * Support ONLY ONE dem layer and ONE layer texture.
 */
export class Map3dMaterial extends PushMaterial implements IMap3dElevationTarget, IMap3dImageTarget {
    public static DefaultTerrainColor: Color4 = Color4.FromInts(70, 130, 180, 1); // cool steel blue

    public static DemInfosAttName: string = "demInfos";
    public static DemIdsAttName: string = "demIds";
    public static LayerIdsAttName: string = "layerIds";

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

    public static ElevationSamplerUniformName: string = "uAltitudes";
    public static NormalSamplerUniformName: string = "uNormals";
    public static SpecularMapSamplerUniformName: string = "uSpecularMap";
    public static TextureSamplerUniformName: string = "uTexture";

    public static NorthClipPlaneUniformName: string = "uNorthClip";
    public static SouthClipPlaneUniformName: string = "uSouthClip";
    public static EastClipPlaneUniformName: string = "UEastClip";
    public static WestClipPlaneUniformName: string = "uWestClip";
    public static TopClipPlaneUniformName: string = "uTopClip";
    public static BottomClipPlaneUniformName: string = "uBottomClip";

    public static ElevationKind: string = "altitudes";
    public static NormalKind: string = "normals";
    public static LayerKind: string = "texture";
    public static SpecularMapKind: string = "specularMap";

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
    private _layerSampler: Nullable<Map3dTexture> = null;

    // the elevation related properties.
    private _elevationOffset: number = 0.0;
    private _elevationRange: Nullable<Range> = null;

    // the clip planes used by the material, if any
    private _clipPlanes: Nullable<ClipPlaneDefinition>[] = [];

    // the light filter used by the material, if any
    protected _lightFilter: Nullable<(light: Light) => boolean> = null;
    protected _lightAddedObserver: Nullable<Observer<Light>> = null;
    protected _lightRemovedObserver: Nullable<Observer<Light>> = null;

    constructor(name: string, shaderName: string, scene?: Scene) {
        super(name, scene);
        if (!shaderName) throw new Error("shaderName is required");
        this._shaderName = shaderName;
        // setting up the light filter and observers
        this._setupLights();
    }

    public getLights(): Light[] {
        return this._lightFilter ? this.getScene().lights.filter(this._lightFilter) : this.getScene().lights;
    }

    public addClipPlane(...clipPlanes: ClipPlaneDefinition[]): void {
        for (let cp of clipPlanes) {
            this._clipPlanes[cp.index] = cp;
        }
        this.markAsDirty(Material.MiscDirtyFlag);
    }

    public removeClipPlane(...indices: ClipIndex[]): void {
        for (let i of indices) {
            this._clipPlanes[i] = null;
        }
        this.markAsDirty(Material.MiscDirtyFlag);
    }

    public get elevationRange(): Range {
        // we clone the range to avoid modification of the original range used by the shader
        return this._elevationRange ? this._elevationRange.clone() : Range.Zero();
    }

    public get elevationOffset(): number {
        return this._elevationOffset;
    }

    public set elevationOffset(value: number) {
        if (this._elevationOffset !== value) {
            this._elevationOffset = value;
            this.markAsDirty(Material.AttributesDirtyFlag);
        }
    }

    // Override the isReady method
    public isReadyForSubMesh(mesh: AbstractMesh, subMesh: SubMesh, useInstances?: boolean): boolean {
        if (this.isFrozen) {
            if (subMesh.effect && subMesh.effect._wasPreviouslyReady && subMesh.effect._wasPreviouslyUsingInstances === useInstances) {
                return true;
            }
        }

        const defines: MaterialDefines = new MaterialDefines();
        const scene = this.getScene();

        if (this._isReadyForSubMesh(subMesh)) {
            return true;
        }

        const attribs = [VertexBuffer.PositionKind, VertexBuffer.UVKind, Map3dMaterial.DemIdsAttName];

        const uniforms = [
            // babylon related
            Map3dMaterial.WorldMatrixUniformName,
            Map3dMaterial.ViewProjectionMatrixUniformName,

            // clip planes
            Map3dMaterial.NorthClipPlaneUniformName,
            Map3dMaterial.SouthClipPlaneUniformName,
            Map3dMaterial.EastClipPlaneUniformName,
            Map3dMaterial.WestClipPlaneUniformName,
            Map3dMaterial.TopClipPlaneUniformName,
            Map3dMaterial.BottomClipPlaneUniformName,

            // elevations
            Map3dMaterial.AltRangeUniformName,

            // lights and colors
            Map3dMaterial.TerrainColorUniformName,
            Map3dMaterial.HemiLightUniformName,
            Map3dMaterial.PointLightsUniformName,
            Map3dMaterial.SpotLightsUniformName,
            Map3dMaterial.NumPointLightsUniformName,
            Map3dMaterial.NumSpotLightsUniformName,
        ];

        const samplers = [Map3dMaterial.ElevationSamplerUniformName, Map3dMaterial.NormalSamplerUniformName];
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

        // we heavily rely on instances
        if (useInstances) {
            defines.INSTANCES = true;
            MaterialHelper.PushAttributesForInstances(attribs);
        }

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
        subMesh.effect._wasPreviouslyReady = true;
        subMesh.effect._wasPreviouslyUsingInstances = !!useInstances;

        return true;
    }

    // called when dem tile added
    public demAdded(src: ElevationLayer, eventData: ITile<IDemInfos>): void {
        this._ensureLayerReady(src, eventData);

        // we reserve the texture areas for the tile
        const bag = new TileBag(eventData);

        // we process the dem content and update the elevation range
        if (eventData.content) {
            if (this._elevationRange === null) {
                this._elevationRange = new Range(eventData.content.min.z, eventData.content.max.z);
            } else {
                this._elevationRange.union(eventData.content.min.z, eventData.content.max.z);
            }
            this.markAsDirty(Material.AttributesDirtyFlag);
        }

        // prepare the elevation sampler.
        const elevationArea = this._elevationSampler?.reserve();
        if (elevationArea) {
            bag.elevationArea = elevationArea;
            // prepare the adjacent ids.
            this._updateAdjacentIds(bag);
            if (eventData.content?.elevations) {
                elevationArea.update(eventData.content.elevations);
            }
        }

        // prepare the normal sampler
        const normalArea = this._normalSampler?.reserve();
        if (normalArea) {
            bag.normalArea = normalArea;
            if (eventData.content?.normals) {
                normalArea?.update(eventData.content.normals);
            }
        }

        // we store the bag for the tile
        this._bags.set(eventData.address.quadkey, bag);

        // we call the layer sampler to create the layer texture support.
        // remember that the layer texture is a special texture that is used to draw dynamically
        // the image layers on a kind of dynamic texture- this allow to add layer with an LOD offset.
        this._layerSampler?.demAdded(src, eventData);

        this.markAsDirty(Material.TextureDirtyFlag);
    }

    protected _updateAdjacentIds(bag: TileBag): void {
        const area = bag.elevationArea;
        if (!area) return;
        const depth = area.depth;
        const quadkey = bag.tile.address.quadkey;
        bag.AdjacentIds[0] = depth;
        const keys = TileAddress.ToNeigborsKey(quadkey);
        bag.AdjacentIds[1] = this._getAdjacentIds(keys[5]);
        bag.AdjacentIds[2] = this._getAdjacentIds(keys[7]);
        bag.AdjacentIds[3] = this._getAdjacentIds(keys[8]);

        // update the attribute

        this._setAdjacentIds(keys[3], 1, depth);
        this._setAdjacentIds(keys[1], 2, depth);
        this._setAdjacentIds(keys[0], 3, depth);
    }

    protected _getAdjacentIds(quadkey: Nullable<string>, index: number = 0): number {
        if (!quadkey) return -1;
        const bag = this._bags.get(quadkey);
        return bag?.AdjacentIds[index] ?? -1;
    }

    protected _setAdjacentIds(quadkey: Nullable<string>, index: number, id: number = -1): void {
        if (!quadkey) return;
        const bag = this._bags.get(quadkey);
        if (!bag) return;
        bag.AdjacentIds[index] = id;

        // update the attribute
    }

    public demRemoved(src: ElevationLayer, eventData: ITile<IDemInfos>): void {
        const qk = eventData.address.quadkey;
        const bag = this._bags.get(qk);
        if (bag) {
            bag.elevationArea?.release();
            bag.normalArea?.release();
            this._bags.delete(qk);
        }
        this._layerSampler?.demRemoved(src, eventData);

        this.markAsDirty(Material.TextureDirtyFlag);
    }

    public demUpdated(src: ElevationLayer, eventData: ITile<IDemInfos>): void {
        const bag = this._bags.get(eventData.address.quadkey);
        if (bag) {
            if (eventData.content?.elevations) {
                bag.elevationArea?.update(eventData.content.elevations);
            }
            if (eventData.content?.normals) {
                bag.normalArea?.update(eventData.content.normals);
            }
        }
        this._layerSampler?.demUpdated(src, eventData);

        this.markAsDirty(Material.TextureDirtyFlag);
    }

    public imageAdded(src: ImageLayer, eventData: ITile<HTMLImageElement>): void {
        // all the logic is done in the underlyng texture
        this._layerSampler?.imageAdded(src, eventData);
        this.markAsDirty(Material.TextureDirtyFlag);
    }

    public imageRemoved(src: ImageLayer, eventData: ITile<HTMLImageElement>): void {
        // all the logic is done in the underlyng texture
        this._layerSampler?.imageRemoved(src, eventData);
        this.markAsDirty(Material.TextureDirtyFlag);
    }

    public imageUpdated(src: ImageLayer, eventData: ITile<HTMLImageElement>): void {
        // all the logic is done in the underlyng texture
        this._layerSampler?.imageUpdated(src, eventData);
        this.markAsDirty(Material.TextureDirtyFlag);
    }

    public dispose(forceDisposeEffect?: boolean, forceDisposeTextures?: boolean, notBoundToMesh?: boolean): void {
        this._bags.clear();
        this._elevationSampler?.dispose();
        this._normalSampler?.dispose();
        this._layerSampler?.dispose();
        this._layerSampler?.dispose();
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

        if (scene.isCachedMaterialInvalid(this, effect)) {
            // Clip planes
            this._bindClipPlanes(effect);
            // samplers
            this._bindSamplers(effect);
            // Elevations.
            this._bindElevations(effect);
            // lights
            this._bindLights(effect);
        }
    }

    protected _bindLights(effect: Effect): void {
        let pointLightCount = 0;
        let spotLightCount = 0;
        const scene = this.getScene();
        if (scene.ambientColor) {
            effect.setColor3(Map3dMaterial.AmbientLightUniformName, scene.ambientColor);
        }
        for (let l of this.getLights()) {
            if (l instanceof HemisphericLight) {
                effect.setColor3(`${Map3dMaterial.HemiLightUniformName}.skyColor`, l.diffuse);
                effect.setColor3(`${Map3dMaterial.HemiLightUniformName}.groundColor`, l.groundColor);
                effect.setVector3(`${Map3dMaterial.HemiLightUniformName}.direction`, l.direction);
                effect.setFloat(`${Map3dMaterial.HemiLightUniformName}.intensity`, l.intensity);
                continue;
            }
            if (l instanceof PointLight) {
                effect.setVector3(`${Map3dMaterial.PointLightsUniformName}[${pointLightCount}].position`, l.position);
                effect.setColor3(`${Map3dMaterial.PointLightsUniformName}[${pointLightCount}].color`, l.diffuse);
                effect.setFloat(`${Map3dMaterial.PointLightsUniformName}[${pointLightCount}].intensity`, l.intensity);
                pointLightCount++;
                continue;
            }
            if (l instanceof SpotLight) {
                effect.setVector3(`${Map3dMaterial.SpotLightsUniformName}[${spotLightCount}].position`, l.position);
                effect.setVector3(`${Map3dMaterial.SpotLightsUniformName}[${spotLightCount}].direction`, l.direction);
                effect.setColor3(`${Map3dMaterial.SpotLightsUniformName}[${spotLightCount}].color`, l.diffuse);
                effect.setFloat(`${Map3dMaterial.SpotLightsUniformName}[${spotLightCount}].intensity`, l.intensity);

                const innerCutoff = Math.cos(l.angle / 2.0); // Inner cutoff
                const outerCutoff = Math.cos((l.angle * 1.5) / 2.0); // Outer cutoff, slightly larger angle for smooth transition

                effect.setFloat(`${Map3dMaterial.SpotLightsUniformName}[${spotLightCount}].innerCutoff`, innerCutoff);
                effect.setFloat(`${Map3dMaterial.SpotLightsUniformName}[${spotLightCount}].outerCutoff`, outerCutoff);
                effect.setFloat(`${Map3dMaterial.SpotLightsUniformName}[${spotLightCount}].exponent`, l.exponent);

                spotLightCount++;
                continue;
            }
        }
        effect.setInt(Map3dMaterial.NumPointLightsUniformName, pointLightCount);
        effect.setInt(Map3dMaterial.NumSpotLightsUniformName, spotLightCount);
    }

    protected _bindElevations(effect: Effect): void {
        effect.setVector2(Map3dMaterial.AltRangeUniformName, new Vector2(this._elevationRange?.min ?? 0.0, this._elevationRange?.max ?? 0.0));
    }

    protected _bindMatrix(effect: Effect, world: Matrix, scene: Scene): void {
        effect.setMatrix(Map3dMaterial.WorldMatrixUniformName, world);
        effect.setMatrix(Map3dMaterial.ViewProjectionMatrixUniformName, scene.getTransformMatrix());
    }

    protected _bindClipPlanes(effect: Effect): void {
        if (this._clipPlanes) {
            this._bindClipPlane(effect, Map3dMaterial.NorthClipPlaneUniformName, ClipIndex.North);
            this._bindClipPlane(effect, Map3dMaterial.SouthClipPlaneUniformName, ClipIndex.South);
            this._bindClipPlane(effect, Map3dMaterial.EastClipPlaneUniformName, ClipIndex.East);
            this._bindClipPlane(effect, Map3dMaterial.WestClipPlaneUniformName, ClipIndex.West);
        }
    }

    protected _bindClipPlane(effect: Effect, name: string, index: number): void {
        let clipPlane = this._clipPlanes[index];
        if (clipPlane) {
            effect.setVector3(`${name}.point`, clipPlane.point);
            effect.setVector3(`${name}.normal`, clipPlane.normal);
        }
    }

    protected _bindSamplers(effect: Effect): void {
        effect.setTexture(Map3dMaterial.ElevationSamplerUniformName, this._elevationSampler);
        effect.setTexture(Map3dMaterial.NormalSamplerUniformName, this._normalSampler);
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
        target.registerInstancedBuffer(Map3dMaterial.DemInfosAttName, 4);
        target.registerInstancedBuffer(Map3dMaterial.DemIdsAttName, 4);
    }

    protected _ensureLayerReady(src: ElevationLayer, eventData: ITile<IDemInfos>): void {
        // ensure the samplers are ready (altitude and normal)
        // actually we ONLY support ONE dem layer. This is a limitation of the current implementation
        if (!this._elevationSampler) {
            this._buildElevationSamplers(src);
            this.markAsDirty(Material.TextureDirtyFlag);
        }
    }

    protected _buildElevationSamplers(layer: ElevationLayer) {
        // the challenge here is to create the elevation sampler with the right depth.
        // which mean we need to know how many tiles we may have in the pool.
        // the pool is created with the max number of tiles that can be displayed at once.
        // another strategy is to increase decrease the pool size dynamically.
        // this point is crucial for the performance.
        const maxDepth = this._getElevationSamplerDepth(layer);
        const width = layer.metrics.tileSize;
        const height = layer.metrics.tileSize;
        const generateMipMap = false;
        const scene = this.getScene();
        this._elevationSampler = <Texture3>this._buildSampler(Map3dMaterial.ElevationKind, width, height, maxDepth, generateMipMap, scene);
        this._normalSampler = <Texture3>this._buildSampler(Map3dMaterial.NormalKind, width, height, maxDepth, generateMipMap, scene);
    }

    protected _getElevationSamplerDepth(layer: ElevationLayer): number {
        return 16; // for dev purpose we set a fixed number of tiles
    }

    protected _buildSampler(kind: string, width: number, height: number, depth: number, generateMipMap: boolean, scene: Scene): Nullable<Texture3> | Nullable<Map3dTexture> {
        switch (kind) {
            case Map3dMaterial.ElevationKind: {
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
            case Map3dMaterial.NormalKind: {
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
            case Map3dMaterial.LayerKind: {
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
                return new Map3dTexture(scene, options);
            }
            default: {
                return null;
            }
        }
    }

    protected _onEffectCompiled(effect: Effect): void {
        console.log("DEFINES:", effect.defines);
        console.log("VERTEX:", effect.vertexSourceCode);
        console.log("FRAGMENT:", effect.fragmentSourceCode);
        if (this.onCompiled) {
            this.onCompiled(effect);
        }
    }

    protected _onEffectError(effect: Effect, errors: string): void {
        console.error("ERRORS:", errors);
        if (this.onError) {
            this.onError(effect, errors);
        }
    }
}
