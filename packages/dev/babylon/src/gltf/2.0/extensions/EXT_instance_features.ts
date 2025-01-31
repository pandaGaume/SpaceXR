import { IGLTFLoaderExtension } from "@babylonjs/loaders";
import { EXT_mesh_gpu_instancing, GLTFLoader } from "@babylonjs/loaders/glTF/2.0";

const NAME = "EXT_instance_features";

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
}

GLTFLoader.RegisterExtension(NAME, (loader) => new EXT_instance_features(loader));
