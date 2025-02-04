import * as GLTF2 from "babylonjs-gltf2interface";
import { IGLTFLoaderExtension } from "@babylonjs/loaders";
import { ArrayItem, GLTFLoader, IAccessor, IMeshPrimitive } from "@babylonjs/loaders/glTF/2.0";
import { IMetadataSchema, IMetadataPropertyTable, IMetadataPropertyAttribute, IMetadataPropertyTexture } from "./EXT_structural_metadata.types";
import { BoundingInfo, Geometry, Mesh, Nullable, TmpVectors, VertexBuffer } from "@babylonjs/core";

const NAME = "EXT_structural_metadata";

export interface IStructuralMetadata {
    schema: IMetadataSchema;
    propertyTables?: Array<IMetadataPropertyTable>;
    propertyAttributes?: Array<IMetadataPropertyAttribute>;
    propertyTextures?: Array<IMetadataPropertyTexture>;
}

export function IsStructuralMetadata(b: unknown): b is IStructuralMetadata {
    if (b === null || b === undefined || typeof b !== "object") return false;
    const obj = b as Partial<IStructuralMetadata>;
    return obj.schema !== undefined;
}

export interface IHasStructuralMetadata {
    structuralMetadata?: IStructuralMetadata;
}

export function IsHasStructuralMetadata(b: unknown): b is IStructuralMetadata {
    if (b === null || b === undefined || typeof b !== "object") return false;
    const obj = b as Partial<IHasStructuralMetadata>;
    return obj.structuralMetadata !== undefined;
}

/**
 * [Specification](https://github.com/CesiumGS/glTF/blob/3d-tiles-next/extensions/2.0/Vendor/EXT_structural_metadata/README.md)
 * [Playground Sample]()
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export class EXT_structural_metadata implements IGLTFLoaderExtension {
    /**
     * The name of this extension.
     */
    public readonly name = NAME;
    /**
     * Defines whether this extension is enabled.
     */
    public enabled: boolean;

    private _loader: GLTFLoader;
    private _metadata: Nullable<IStructuralMetadata> = null;

    /**
     * @internal
     */
    constructor(loader: GLTFLoader) {
        this._loader = loader;
        this.enabled = this._loader.isExtensionUsed(NAME);
    }

    /** @internal */
    public onLoading(): void {
        const extensions = this._loader.gltf.extensions;
        if (extensions && extensions[this.name]) {
            const extension = extensions[this.name] as any;
            const babylonObject: any = this._loader.rootBabylonMesh;
            babylonObject.structuralMetadata = {
                schema: extension.schema,
                propertyTables: extension.propertyTables,
                propertyAttributes: extension.propertyAttributes,
                propertyTextures: extension.propertyTextures,
            };
            this._metadata = babylonObject.structuralMetadata;
        }
    }

    public _loadVertexDataAsync(context: string, primitive: IMeshPrimitive, babylonMesh: Mesh): Nullable<Promise<Geometry>> {
        if (primitive.extensions) {
            const attributes = primitive.attributes;
            if (!attributes) {
                throw new Error(`${context}: Attributes are missing`);
            }

            const babylonGeometry = new Geometry(babylonMesh.name, (<any>this._loader)._babylonScene);
            const promises = new Array<Promise<any>>();
            const loadAttribute = (name: string, kind: string, callback?: (accessor: IAccessor) => void) => {
                if (attributes[name] == undefined) {
                    return;
                }

                babylonMesh._delayInfo = babylonMesh._delayInfo || [];
                if (babylonMesh._delayInfo.indexOf(kind) === -1) {
                    babylonMesh._delayInfo.push(kind);
                }

                const accessor: any = ArrayItem.Get(`${context}/attributes/${name}`, (<any>this._loader)._gltf.accessors, attributes[name]);
                promises.push(
                    this._loader._loadVertexAccessorAsync(`/accessors/${accessor.index}`, accessor, kind).then((babylonVertexBuffer) => {
                        if (babylonVertexBuffer.getKind() === VertexBuffer.PositionKind && !this._loader.parent.alwaysComputeBoundingBox && !babylonMesh.skeleton) {
                            if (accessor.min && accessor.max) {
                                const min = TmpVectors.Vector3[0].copyFromFloats(...(accessor.min as [number, number, number]));
                                const max = TmpVectors.Vector3[1].copyFromFloats(...(accessor.max as [number, number, number]));
                                if (accessor.normalized && accessor.componentType !== GLTF2.AccessorComponentType.FLOAT) {
                                    let divider = 1;
                                    switch (accessor.componentType) {
                                        case GLTF2.AccessorComponentType.BYTE:
                                            divider = 127.0;
                                            break;
                                        case GLTF2.AccessorComponentType.UNSIGNED_BYTE:
                                            divider = 255.0;
                                            break;
                                        case GLTF2.AccessorComponentType.SHORT:
                                            divider = 32767.0;
                                            break;
                                        case GLTF2.AccessorComponentType.UNSIGNED_SHORT:
                                            divider = 65535.0;
                                            break;
                                    }
                                    const oneOverDivider = 1 / divider;
                                    min.scaleInPlace(oneOverDivider);
                                    max.scaleInPlace(oneOverDivider);
                                }
                                babylonGeometry._boundingInfo = new BoundingInfo(min, max);
                                babylonGeometry.useBoundingInfoFromGeometry = true;
                            }
                        }
                        babylonGeometry.setVerticesBuffer(babylonVertexBuffer, accessor.count);
                    })
                );

                if (kind == VertexBuffer.MatricesIndicesExtraKind) {
                    babylonMesh.numBoneInfluencers = 8;
                }

                if (callback) {
                    callback(accessor);
                }
            };

            const attributeMappings: [string, string, Nullable<(accessor: IAccessor) => void>][] = [
                ["TEXCOORD_0", VertexBuffer.UVKind, null],
                ["TEXCOORD_1", VertexBuffer.UV2Kind, null],
                ["TEXCOORD_2", VertexBuffer.UV3Kind, null],
                ["TEXCOORD_3", VertexBuffer.UV4Kind, null],
                ["TEXCOORD_4", VertexBuffer.UV5Kind, null],
                ["TEXCOORD_5", VertexBuffer.UV6Kind, null],

                ["POSITION", VertexBuffer.PositionKind, null],
                ["NORMAL", VertexBuffer.NormalKind, null],
                ["TANGENT", VertexBuffer.TangentKind, null],

                ["JOINTS_0", VertexBuffer.MatricesIndicesKind, null],
                ["WEIGHTS_0", VertexBuffer.MatricesWeightsKind, null],
                ["JOINTS_1", VertexBuffer.MatricesIndicesExtraKind, null],
                ["WEIGHTS_1", VertexBuffer.MatricesWeightsExtraKind, null],
                [
                    "COLOR_0",
                    VertexBuffer.ColorKind,
                    (accessor) => {
                        if (accessor.type === GLTF2.AccessorType.VEC4) {
                            babylonMesh.hasVertexAlpha = true;
                        }
                    },
                ],
            ];

            //#region extension specific
            const extension = primitive.extensions[EXT_structural_metadata.name];
            if (extension && this._metadata) {
                if (extension.propertyAttributes && this._metadata.propertyAttributes) {
                    for (const i of extension.propertyAttributes) {
                        if (i >= 0 && i < this._metadata.propertyAttributes.length) {
                            const ref = this._metadata.propertyAttributes[i];
                            for (const propertyName in ref.properties) {
                                const v = ref.properties[propertyName];
                                attributeMappings.push([v.attribute, v.attribute, null]);
                            }
                        }
                    }
                }
                if (extension.propertyTextures && this._metadata.propertyTextures) {
                    for (const i of extension.propertyTextures) {
                        if (i >= 0 && i < this._metadata.propertyTextures.length) {
                            const ref = this._metadata.propertyTextures[i];
                            for (const propertyName in ref.properties) {
                                const textInfos = ref.properties[propertyName];
                                this._loader.loadTextureInfoAsync(context, textInfos).then((babylonTexture) => {
                                    ref.textures = ref.textures || [];
                                    ref.textures[propertyName] = babylonTexture;
                                });
                            }
                        }
                    }
                }
            }
            //#end region extension specific

            attributeMappings.forEach(([attributeName, vertexKind, callback]) => {
                loadAttribute(attributeName, vertexKind, callback == null ? undefined : callback);
            });

            return Promise.all(promises).then(() => {
                return babylonGeometry;
            });
        }
        return null;
    }

    public dispose(): void {
        (this._loader as any) = null;
    }
}

GLTFLoader.RegisterExtension(NAME, (loader) => new EXT_structural_metadata(loader));
