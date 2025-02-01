import * as GLTF2 from "babylonjs-gltf2interface";
import { BoundingInfo, Geometry, Mesh, Nullable, TmpVectors, VertexBuffer } from "@babylonjs/core";
import { IGLTFLoaderExtension } from "@babylonjs/loaders";
import { GLTFLoader, IProperty, ITextureInfo, IMeshPrimitive, IAccessor, ArrayItem } from "@babylonjs/loaders/glTF/2.0";

const NAME = "EXT_mesh_features";

export type FeatureIdAttribute = number; // An integer value used to construct a string in the format `_FEATURE_ID_<set index>` which is a reference to a key in `mesh.primitives.attributes` (e.g. a value of `0` corresponds to `_FEATURE_ID_0`).

// A texture containing feature IDs
export interface IFeatureIdTexture extends ITextureInfo {
    channels: Array<number>; // Texture channels containing feature IDs, identified by index. Feature IDs may be packed into multiple channels if a single channel does not have sufficient bit depth to represent all feature ID values. The values are packed in little-endian order.
}

export interface IFeatureId extends IProperty {
    featureCount: number; // The number of unique features in the attribute or texture.
    nullFeatureId?: number; // A value that indicates that no feature is associated with this vertex or texel.
    label?: string; // A label assigned to this feature ID set. Labels must be alphanumeric identifiers matching the regular expression `^[a-zA-Z_][a-zA-Z0-9_]*$`.
    attribute?: FeatureIdAttribute; // An attribute containing feature IDs. When `attribute` and `texture` are omitted the feature IDs are assigned to vertices by their index.
    texture?: IFeatureIdTexture; // A texture containing feature IDs.
    propertyTable?: number; // the index of the property table containing per-feature property values. Only applicable when using the `EXT_structural_metadata` extension.
    // specific to babylon
    kind: string;
}

export interface IHasFeatureIds {
    featureIds: Array<IFeatureId>;
}

export function HasFeatureIds(b: unknown): b is IHasFeatureIds {
    if (b === null || b === undefined || typeof b !== "object") return false;
    const obj = b as Partial<IHasFeatureIds>;
    return obj.featureIds !== undefined && Array.isArray(obj.featureIds) && obj.featureIds.length != 0;
}

/**
 * [Specification](https://github.com/CesiumGS/glTF/blob/3d-tiles-next/extensions/2.0/Vendor/EXT_mesh_features/README.md)
 * [Playground Sample]()
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export class EXT_mesh_features implements IGLTFLoaderExtension {
    private static VerticeKindPrefix = "vfid";
    private static TextureKindPrefix = "tfid";
    /**
     * The name of this extension.
     */
    public readonly name = NAME;
    /**
     * Defines whether this extension is enabled.
     */
    public enabled: boolean;

    private _loader: GLTFLoader;

    /**
     * @internal
     */
    constructor(loader: GLTFLoader) {
        this._loader = loader;
        this.enabled = this._loader.isExtensionUsed(NAME);
    }

    public dispose(): void {
        (this._loader as any) = null;
    }

    /**
     * @internal
     */
    public _loadVertexDataAsync(context: string, primitive: IMeshPrimitive, babylonMesh: Mesh): Nullable<Promise<Geometry>> {
        const gltfProp = primitive.extensions?.EXT_mesh_features;
        if (HasFeatureIds(gltfProp)) {
            const babylonGeometry = new Geometry(babylonMesh.name, (<any>this._loader)._babylonScene);

            //#region extension specific
            const babylonObject: any = babylonMesh; // this is the object where we decide to put the feature ids accessor.
            const featureIds: Array<IFeatureId> = (babylonObject.featureIds = babylonObject.featureIds ?? []);
            for (const i of gltfProp.featureIds) {
                featureIds.push(i);
            }
            //#endregion extension specific

            const attributes = primitive.attributes;
            if (!attributes) {
                throw new Error(`${context}: Attributes are missing`);
            }

            const promises = new Array<Promise<any>>();

            if (primitive.indices == undefined) {
                babylonMesh.isUnIndexed = true;
            } else {
                const accessor: any = ArrayItem.Get(`${context}/indices`, (<any>this._loader)._gltf.accessors, primitive.indices);
                promises.push(
                    this._loader._loadIndicesAccessorAsync(`/accessors/${accessor.index}`, accessor).then((data) => {
                        babylonGeometry.setIndices(data);
                    })
                );
            }

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

            const lastTexCoordIndex = 5;
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
            // this is where we load the features id..
            let vfidCount = 0;
            const implicit: Array<IFeatureId> = [];
            for (const fid of featureIds) {
                if (fid.attribute != undefined) {
                    // Feature ID by Vertex
                    const n = this._getKind("_FEATURE_ID_", fid.attribute);
                    fid.kind = this._getKind(EXT_mesh_features.VerticeKindPrefix, fid.attribute);
                    attributeMappings.push([n, fid.kind, null]);
                    vfidCount++;
                    continue;
                }
                if (fid.texture?.texCoord != undefined) {
                    // Feature ID by Texture Coordinates
                    const n = this._getKind("TEXCOORD_", fid.texture.texCoord);
                    fid.kind = this._getKind(EXT_mesh_features.TextureKindPrefix, fid.texture.texCoord);
                    if (fid.texture?.texCoord <= lastTexCoordIndex) {
                        // we override the kind.
                        attributeMappings[fid.texture?.texCoord] = [n, fid.kind, null];
                    } else {
                        attributeMappings.push([n, fid.kind, null]);
                    }
                    continue;
                }
                // When both featureId.attribute and featureId.texture are undefined,
                // then the feature ID value for each vertex is given implicitly, via
                // the index of the vertex. In this case, the featureCount must match
                // the number of vertices of the mesh primitive.
                // push these into stack for later process (we need this to know the number of feature by vertex already declared)
                implicit.push(fid);
            }

            // loop over the implicit feature id, creating and set buffer.
            for (const fid of implicit) {
                fid.kind = this._getKind(EXT_mesh_features.VerticeKindPrefix, vfidCount++);
                const buffer = this._buildVertexBufferForImplicitId(fid.featureCount, fid.kind);
                babylonGeometry.setVerticesBuffer(buffer, fid.featureCount);
            }
            //#end region extension specific

            attributeMappings.forEach(([attributeName, vertexKind, callback]) => {
                loadAttribute(attributeName, vertexKind, callback == null ? undefined : callback);
            });

            return Promise.all(promises).then(() => {
                return babylonGeometry;
            });
        }
        return null; // default behavior if no feature ids defined..
    }

    private _buildVertexBufferForImplicitId(count: number, kind: string): VertexBuffer {
        const generatedIndices = Array.from({ length: count }, (_, i) => i);
        const engine = (<any>this._loader)._babylonScene.getEngine();
        // TODO - add more parameter such size, to avoid check for the kind and throw exception.
        return new VertexBuffer(engine, generatedIndices, kind);
    }

    private _getKind(prefix: string, n: number): string {
        return `${prefix}${n}`;
    }
}

GLTFLoader.RegisterExtension(NAME, (loader) => new EXT_mesh_features(loader));
