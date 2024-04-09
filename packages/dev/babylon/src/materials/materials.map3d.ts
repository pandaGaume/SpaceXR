import { AbstractMesh, Constants, Effect, Material, MaterialDefines, Nullable, PushMaterial, Scene, SubMesh } from "@babylonjs/core";
import { IDemInfos } from "core/dem";
import { EventState } from "core/events";
import { IPipelineMessageType, ITargetBlock, ITile } from "core/tiles";
import { Range } from "core/math";
import { Texture3 } from "babylon-ext/materials";
import { ClipIndex, ClipPlaneDefinition } from "./materials.clipPlane";

// we use type of IDemInfos for elevation and rgb images for the texture.
export type ElevationTileContentType = IDemInfos | HTMLImageElement;

export class Map3dMaterialDefines extends MaterialDefines {
    constructor() {
        super();
        this.rebuild();
    }
}
/**
 * Base class for Map3D related materials.
 */
export class Map3dMaterial extends PushMaterial implements ITargetBlock<ITile<ElevationTileContentType>> {
    public static ElevationKind: string = "altitudes";
    public static NormalKind: string = "normals";
    public static LayerKind: string = "layer";

    // the samplers for the elevation, normal and layer textures.
    private _elevationSampler: Nullable<Texture3>;
    private _normalSampler: Nullable<Texture3>;
    private _layerSampler: Nullable<Texture3>;

    // the elevation related properties.
    private _elevationScale: number;
    private _elevationOffset: number;
    private _elevationRange: Range;

    // the clip planes used by the material, if any
    private _clipPlanes: Nullable<ClipPlaneDefinition>[];

    constructor(name: string, scene: Scene) {
        super(name, scene);

        this._elevationSampler = null;
        this._normalSampler = null;
        this._layerSampler = null;

        this._elevationOffset = 0.0;
        this._elevationScale = 1.0;
        this._elevationRange = Range.Zero();

        this._clipPlanes = [null, null, null, null, null, null];
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
        return this._elevationRange.clone();
    }

    public get elevationScale(): number {
        return this._elevationScale;
    }

    public set elevationScale(value: number) {
        if (this._elevationScale !== value) {
            this._elevationScale = value;
            this.markAsDirty(Material.AttributesDirtyFlag);
        }
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
        return super.isReadyForSubMesh(mesh, subMesh, useInstances);
    }

    public added(eventData: IPipelineMessageType<ITile<ElevationTileContentType>>, eventState: EventState): void {}
    public removed(eventData: IPipelineMessageType<ITile<ElevationTileContentType>>, eventState: EventState): void {}
    public updated(eventData: IPipelineMessageType<ITile<ElevationTileContentType>>, eventState: EventState): void {}

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
                this._layerSampler = new Texture3(scene, options);
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
}
