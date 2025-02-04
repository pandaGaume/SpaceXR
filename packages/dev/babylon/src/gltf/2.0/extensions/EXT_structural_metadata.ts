import { IGLTFLoaderExtension } from "@babylonjs/loaders";
import { GLTFLoader, IMeshPrimitive } from "@babylonjs/loaders/glTF/2.0";
import { IMetadataSchema, IMetadataPropertyTable, IMetadataPropertyAttribute, IMetadataPropertyTexture } from "./EXT_structural_metadata.types";
import { Geometry, Mesh, Nullable } from "@babylonjs/core";

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
        const gltfProp = primitive.extensions?.EXT_mesh_features;
        if (IsStructuralMetadata(gltfProp) && this._metadata) {
        }
        return null;
    }

    public dispose(): void {
        (this._loader as any) = null;
    }
}

GLTFLoader.RegisterExtension(NAME, (loader) => new EXT_structural_metadata(loader));
