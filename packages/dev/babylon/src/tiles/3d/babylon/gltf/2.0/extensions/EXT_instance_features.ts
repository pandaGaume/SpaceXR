import { IndicesArray, Nullable, TransformNode } from "@babylonjs/core";
import { IGLTFLoaderExtension } from "@babylonjs/loaders";
import { ArrayItem, EXT_mesh_gpu_instancing, GLTFLoader, IEXTInstanceFeatures, INode } from "@babylonjs/loaders/glTF/2.0";
import { EXT_mesh_features, IFeatureId, IHasFeatureIds } from "./EXT_mesh_features";

const NAME = "EXT_instance_features";

export interface IHasInstanceIds extends IHasFeatureIds {
    // babylon specific.
    thinInstanceIds: Array<IndicesArray>;
}

/**
 * [Specification](https://github.com/CesiumGS/glTF/tree/3d-tiles-next/extensions/2.0/Vendor/EXT_instance_features)
 * [Playground Sample]()
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export class EXT_instance_features implements IGLTFLoaderExtension {
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
        // according the specification :  Each node that is extended with EXT_instance_features must also define an
        // EXT_mesh_gpu_instancing extension object, and is invalid without this dependency.
        this.enabled = this._loader.isExtensionUsed(NAME) && this._loader.isExtensionUsed(EXT_mesh_gpu_instancing.name);
    }

    public dispose(): void {
        (this._loader as any) = null;
    }

    public loadNodeAsync(context: string, node: INode, assign: (babylonTransformNode: TransformNode) => void): Nullable<Promise<TransformNode>> {
        if (node.extensions) {
            const ext_gpu_instancing = node.extensions[EXT_mesh_gpu_instancing.name];
            if (ext_gpu_instancing) {
                return GLTFLoader.LoadExtensionAsync<IEXTInstanceFeatures, TransformNode>(context, node, this.name, (extensionContext, extension) => {
                    const promise = this._loader.loadNodeAsync(`/nodes/${node.index}`, node, assign);
                    if (!node._primitiveBabylonMeshes) {
                        return promise;
                    }

                    for (const babylonMesh of node._primitiveBabylonMeshes) {
                        const babylonObject: any = babylonMesh;
                        const gpu_instancing_context = `${context}.${EXT_mesh_gpu_instancing.name}`;

                        const featureIds: Array<IFeatureId> = (babylonObject.featureIds = babylonObject.featureIds ?? []);
                        for (const fid of extension.featureIds) {
                            featureIds.push(fid);
                            if (fid.attribute != undefined) {
                                // Feature ID by Vertex
                                const n = EXT_mesh_features.BuildKind("_FEATURE_ID_", fid.attribute);
                                const accessor = ArrayItem.Get(`${gpu_instancing_context}/attributes/${n}`, this._loader.gltf.accessors, ext_gpu_instancing.attributes[n]);
                                this._loader._loadIndicesAccessorAsync(`/accessors/${accessor.bufferView}`, accessor).then((data) => {
                                    babylonObject.thinInstanceIds = babylonObject.thinInstanceIds ?? [];
                                    babylonObject.thinInstanceIds.push(data);
                                });
                            }
                        }
                    }
                    return promise;
                });
            }
        }
        return null;
    }
}

GLTFLoader.RegisterExtension(NAME, (loader) => new EXT_instance_features(loader));
