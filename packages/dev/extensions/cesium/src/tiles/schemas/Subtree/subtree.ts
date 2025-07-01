import { IMetadataEntity } from "../metadataEntity";
import { IPropertyTable } from "../PropertyTable/propertyTable";
import { IAvailability } from "./availability";
import { IBufferView } from "./bufferView";

/**
 * An object describing the availability of tiles and content in a subtree, as well as availability of children subtrees. May also store metadata for available tiles and content.
 */
export interface ISubtree {
    /**
     * An array of buffers.
     *
     * @minItems 1
     */
    buffers?: [Buffer, ...Buffer[]];
    /**
     * An array of buffer views.
     *
     * @minItems 1
     */
    bufferViews?: [IBufferView, ...IBufferView[]];
    /**
     * An array of property tables.
     *
     * @minItems 1
     */
    propertyTables?: [IPropertyTable, ...IPropertyTable[]];
    tileAvailability: IAvailability;
    /**
     * An array of content availability objects. If the tile has a single content this array will have one element; if the tile has multiple contents - as supported by 3DTILES_multiple_contents and 3D Tiles 1.1 - this array will have multiple elements.
     *
     * @minItems 1
     */
    contentAvailability?: [IAvailability, ...IAvailability[]];
    childSubtreeAvailability: IAvailability;
    /**
     * Index of the property table containing tile metadata. Tile metadata only exists for available tiles and is tightly packed by increasing tile index. To access individual tile metadata, implementations may create a mapping from tile indices to tile metadata indices.
     */
    tileMetadata?: number;
    /**
     * An array of indexes to property tables containing content metadata. If the tile has a single content this array will have one element; if the tile has multiple contents - as supported by 3DTILES_multiple_contents and 3D Tiles 1.1 - this array will have multiple elements. Content metadata only exists for available contents and is tightly packed by increasing tile index. To access individual content metadata, implementations may create a mapping from tile indices to content metadata indices.
     *
     * @minItems 1
     */
    contentMetadata?: [number, ...number[]];
    subtreeMetadata?: IMetadataEntity;
}
