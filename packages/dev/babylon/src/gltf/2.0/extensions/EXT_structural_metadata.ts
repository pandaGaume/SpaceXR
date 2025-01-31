import { IGLTFLoaderExtension } from "@babylonjs/loaders";
import { GLTFLoader } from "@babylonjs/loaders/glTF/2.0";

const NAME = "EXT_structural_metadata";

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
}

GLTFLoader.RegisterExtension(NAME, (loader) => new EXT_structural_metadata(loader));
