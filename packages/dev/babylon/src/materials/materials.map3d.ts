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
    Mesh,
    Nullable,
    Observer,
    PointLight,
    PushMaterial,
    Scene,
    SpotLight,
    SubMesh,
    VertexBuffer,
} from "@babylonjs/core";

import { ITile, ITileAddress, ImageLayer, IsTileContentView } from "core/tiles";
import { Range } from "core/math";
import { ClipIndex, ClipPlaneDefinition } from "./materials.clipPlane";
import { ElevationLayer } from "../map";
import { ITexture3Layer, Texture3 } from "babylon_ext/Materials";
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
    public constructor(public address: ITileAddress, public elevationArea: Nullable<ITexture3Layer> = null, public normalArea: Nullable<ITexture3Layer> = null) {}
}

/**
 * Base class for Map3D related materials. This class is intended to be used as a base class for
 * different materials that are used to render 3D maps such as EllipsoidMaterial and WebMapMaterial.
 * Thus materials are related to a specific geometry which are implemented into the vertex shader.
 * Commons properties and methods are implemented in this class, such as data samplers (elevation, normals and layer)
 * and clip planes.
 */
export class Map3dMaterial extends PushMaterial {
    public static DefaultTerrainColor: Color4 = Color4.FromInts(70, 130, 180, 1); // cool steel blue

    public static DemInfosAttName: string = "demInfos";
    public static DemIdsAttName: string = "demIds";
    public static LayerIdsAttName: string = "layerIds";

    public static ElevationKind: string = "altitudes";
    public static NormalKind: string = "normals";
    public static LayerKind: string = "layer";

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
            "world",
            "viewProjection",
            // elevations
            "uMapscale",
            "uExageration",
            "uMinAlt",
            // lights and colors
            "uTerrainColor",
            "uHemiLight",
            "uPointLights",
            "uSpotLights",
            "uNumPointLights",
            "uNumSpotLights",
        ];
        const samplers = ["uAltitudes", "uNormals"];
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
            uniforms.push("uShininess");
        }

        // we heavily rely on instances
        if (useInstances) {
            defines.INSTANCES = true;
            MaterialHelper.PushAttributesForInstances(attribs);
        }

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

    // called when dem tile added
    public demAdded(src: ElevationLayer, eventData: ITile<IDemInfos>): void {
        // we do not process if there is no content
        if (eventData.content === null) return;

        if (IsTileContentView(eventData.content)) {
            // we do not process content view yet
        } else {
            // we process the dem content and update the elevation range
            if (this._elevationRange === null) {
                this._elevationRange = new Range(eventData.content.min.z, eventData.content.max.z);
            } else {
                this._elevationRange.union(eventData.content.min.z, eventData.content.max.z);
            }

            // we reserve the texture areas for the tile
            const bag = new TileBag(eventData.address);
            // for the elevation.
            if (eventData.content.elevations) {
                const elevationArea = this._elevationSampler?.reserve();
                if (elevationArea) {
                    elevationArea?.update(eventData.content.elevations);
                    bag.elevationArea = elevationArea;
                }
            }
            // and for the normal
            if (eventData.content.normals) {
                const normalArea = this._normalSampler?.reserve();
                if (normalArea) {
                    normalArea?.update(eventData.content.normals);
                    bag.normalArea = normalArea;
                }
            }

            // we store the bag for the tile
            this._bags.set(eventData.address.quadkey, bag);

            // we call the layer sampler to create the layer texture support.
            // remember that the layer texture is a special texture that is used to draw dynamically
            // the image layers on a kind of dynamic texture- this allow to add layer with an LOD offset.
            this._layerSampler?.demAdded(src, eventData);
        }

        this.markAsDirty(Material.TextureDirtyFlag);
    }

    public demRemoved(src: ElevationLayer, eventData: ITile<IDemInfos>): void {
        // we do not process if there is no content
        if (eventData.content === null) return;
        if (IsTileContentView(eventData.content)) {
            // we do not process content view yet
        } else {
            const qk = eventData.address.quadkey;
            const bag = this._bags.get(qk);
            if (bag) {
                bag.elevationArea?.release();
                bag.normalArea?.release();
                this._bags.delete(qk);
            }
            this._layerSampler?.demRemoved(src, eventData);
        }
        this.markAsDirty(Material.TextureDirtyFlag);
    }

    public demUpdated(src: ElevationLayer, eventData: ITile<IDemInfos>): void {
        // we do not process if there is no content
        if (eventData.content === null) return;
        if (IsTileContentView(eventData.content)) {
            // we do not process content view yet
        } else {
            const bag = this._bags.get(eventData.address.quadkey);
            if (bag) {
                if (eventData.content.elevations) {
                    bag.elevationArea?.update(eventData.content.elevations);
                }
                if (eventData.content.normals) {
                    bag.normalArea?.update(eventData.content.normals);
                }
            }
            this._layerSampler?.demUpdated(src, eventData);
        }

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
        super.dispose(forceDisposeEffect, forceDisposeTextures, notBoundToMesh);
        this._bags.clear();
        this._elevationSampler?.dispose();
        this._normalSampler?.dispose();
        this._layerSampler?.dispose();
        this._lightAddedObserver?.remove();
        this._lightRemovedObserver?.remove();
    }

    protected _buildSampler(kind: string, width: number, height: number, depth: number, generateMipMap: boolean, scene: Scene) {
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
                this._elevationSampler = new Texture3(scene, options);
                break;
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
                this._normalSampler = new Texture3(scene, options);
                break;
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
                this._layerSampler = new Map3dTexture(scene, options);
                break;
            }
            default: {
                break;
            }
        }
    }

    protected _bindSamplers(effect: Effect): void {
        effect.setTexture(Map3dMaterial.ElevationKind, this._elevationSampler);
        effect.setTexture(Map3dMaterial.NormalKind, this._normalSampler);
        effect.setTexture(Map3dMaterial.LayerKind, this._layerSampler);
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
        target.registerInstancedBuffer(Map3dMaterial.LayerIdsAttName, 4);
    }
}
