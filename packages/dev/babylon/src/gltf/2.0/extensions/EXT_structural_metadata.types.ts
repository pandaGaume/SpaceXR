import { IProperty, ITextureInfo } from "@babylonjs/loaders/glTF/2.0";

export interface IMetadataItem extends IProperty {
    /// <summary>
    /// The name of the class, primarily used for display purposes.
    /// Must be a non-empty string.
    name?: string;

    /// <summary>
    /// A textual description of the class.
    /// Must be a non-empty string.
    /// </summary>
    description?: string;
}

export interface IMetadataClass extends IMetadataItem {
    /// <summary>
    /// A dictionary of property definitions.
    /// Each key represents a property ID, which must be an alphanumeric identifier.
    /// Each value defines the corresponding property.
    /// Must contain at least one property.
    /// </summary>
    properties: {
        [key: string]: any;
    };
}

export type IMetadataEnumType = "INT8" | "UINT8" | "INT16" | "UINT16" | "INT32" | "UINT32" | "INT64" | "UINT64" | string;

/// <summary>
/// Represents an enumeration in the EXT_structural_metadata extension.
/// Defines the values of an enum.
/// </summary>
export interface IMetadataEnum extends IMetadataItem {
    /// <summary>
    /// The type of the integer enum value.
    /// Defaults to UINT16.
    /// </summary>
    valueType?: IMetadataEnumType;

    /// <summary>
    /// An array of enum values.
    /// Duplicate names or duplicate integer values are not allowed.
    /// Must contain at least one value.
    /// </summary>
    values: Array<IMetadataEnumValue>;
}

/// <summary>
/// Represents a single value in an enumeration.
/// </summary>
export interface IMetadataEnumValue {
    /// <summary>
    /// The name of the enum value.
    /// </summary>
    name: string;

    /// <summary>
    /// The integer value of the enum.
    /// </summary>
    value: number;
}

/// <summary>
/// Represents a schema in the EXT_structural_metadata extension.
/// Defines classes and enums within the schema.
/// </summary>
export interface IMetadataSchema extends IMetadataItem {
    /// <summary>
    /// Unique identifier for the schema.
    /// Must be an alphanumeric identifier matching the regex `^[a-zA-Z_][a-zA-Z0-9_]*$`.
    /// </summary>
    id: string;

    /// <summary>
    /// Application-specific version of the schema.
    /// Must be a non-empty string.
    /// </summary>
    version?: string;

    /// <summary>
    /// A dictionary of class definitions.
    /// Each key represents a class ID, which must be an alphanumeric identifier.
    /// Each value defines the corresponding class.
    /// Must contain at least one class.
    /// </summary>
    classes?: {
        [key: string]: IMetadataClass;
    };

    /// <summary>
    /// A dictionary of enum definitions.
    /// Each key represents an enum ID, which must be an alphanumeric identifier.
    /// Each value defines the corresponding enum.
    /// Must contain at least one enum.
    /// </summary>
    enums?: {
        [key: string]: IMetadataEnum;
    };
}

/// <summary>
/// Represents a property table in the EXT_structural_metadata extension.
/// Properties conforming to a class, stored in binary columnar arrays.
/// </summary>
export interface IMetadataPropertyTable extends IProperty {
    /// <summary>
    /// The name of the property table, primarily used for display purposes.
    /// Must be a non-empty string.
    /// </summary>
    name?: string;

    /// <summary>
    /// The class that property values conform to.
    /// Must be a class ID declared in the `classes` dictionary.
    /// </summary>
    class: string;

    /// <summary>
    /// The number of elements in each property array.
    /// Must be a positive integer.
    /// </summary>
    count: number;

    /// <summary>
    /// A dictionary of property definitions.
    /// Each key corresponds to a property ID in the class' `properties` dictionary.
    /// Required properties must be included in this dictionary.
    /// </summary>
    properties: {
        [key: string]: IPropertyMetadataTableProperty;
    };
}

export type IPropertyMetadataType = "UINT8" | "UINT16" | "UINT32" | "UINT64" | string;

/// <summary>
/// Represents a property table property in the EXT_structural_metadata extension.
/// An array of binary property values.
/// </summary>
export interface IPropertyMetadataTableProperty extends IProperty {
    /// <summary>
    /// The index of the buffer view containing property values.
    /// </summary>
    values: number;

    /// <summary>
    /// The index of the buffer view containing offsets for variable-length arrays.
    /// </summary>
    arrayOffsets?: number;

    /// <summary>
    /// The index of the buffer view containing offsets for strings.
    /// </summary>
    stringOffsets?: number;

    /// <summary>
    /// The type of values in `arrayOffsets`.
    /// Defaults to UINT32.
    /// </summary>
    arrayOffsetType?: IPropertyMetadataType;

    /// <summary>
    /// The type of values in `stringOffsets`.
    /// Defaults to UINT32.
    /// </summary>
    stringOffsetType?: IPropertyMetadataType;

    /// <summary>
    /// An offset to apply to property values.
    /// </summary>
    offset?: number;

    /// <summary>
    /// A scale to apply to property values.
    /// </summary>
    scale?: number;

    /// <summary>
    /// Maximum value present in the property values.
    /// </summary>
    max?: number;

    /// <summary>
    /// Minimum value present in the property values.
    /// </summary>
    min?: number;
}

/// <summary>
/// Represents a property attribute in the EXT_structural_metadata extension.
/// Properties conforming to a class, organized as property values stored in attributes.
/// </summary>
export interface IMetadataPropertyAttribute extends IProperty {
    /// <summary>
    /// The name of the property attribute, primarily used for display purposes.
    /// Must be a non-empty string.
    /// </summary>
    name?: string;

    /// <summary>
    /// The class that property values conform to.
    /// Must be a class ID declared in the `classes` dictionary.
    /// </summary>
    class: string;

    /// <summary>
    /// A dictionary of property definitions.
    /// Each key corresponds to a property ID in the class' `properties` dictionary.
    /// Required properties must be included in this dictionary.
    /// </summary>
    properties: {
        [key: string]: IMetadataPropertyAttributeProperty;
    };
}

/// <summary>
/// Represents a property attribute property in the EXT_structural_metadata extension.
/// An attribute containing property values.
/// </summary>
export interface IMetadataPropertyAttributeProperty extends IProperty {
    /// <summary>
    /// The name of the attribute containing property values.
    /// </summary>
    attribute: string;

    /// <summary>
    /// An offset to apply to property values.
    /// </summary>
    offset?: number;

    /// <summary>
    /// A scale to apply to property values.
    /// </summary>
    scale?: number;

    /// <summary>
    /// Maximum value present in the property values.
    /// </summary>
    max?: number;

    /// <summary>
    /// Minimum value present in the property values.
    /// </summary>
    min?: number;
}

/// <summary>
/// Represents a property texture in the EXT_structural_metadata extension.
/// Properties conforming to a class, organized as property values stored in textures.
/// </summary>
export interface IMetadataPropertyTexture extends IProperty {
    /// <summary>
    /// The name of the property texture, primarily used for display purposes.
    /// Must be a non-empty string.
    /// </summary>
    name?: string;

    /// <summary>
    /// The class that property values conform to.
    /// Must be a class ID declared in the `classes` dictionary.
    /// </summary>
    class: string;

    /// <summary>
    /// A dictionary of property definitions.
    /// Each key corresponds to a property ID in the class' `properties` dictionary.
    /// Required properties must be included in this dictionary.
    /// </summary>
    properties: {
        [key: string]: IMetadataPropertyTextureProperty;
    };
}

/// <summary>
/// Represents a property texture property in the EXT_structural_metadata extension.
/// A texture containing property values.
/// </summary>
export interface IMetadataPropertyTextureProperty extends ITextureInfo {
    /// <summary>
    /// Texture channels containing property values, identified by index.
    /// The values may be packed into multiple channels if a single channel does not have sufficient bit depth.
    /// The values are packed in little-endian order.
    /// Defaults to [0].
    /// </summary>
    channels?: number[];

    /// <summary>
    /// An offset to apply to property values.
    /// </summary>
    offset?: number;

    /// <summary>
    /// A scale to apply to property values.
    /// </summary>
    scale?: number;

    /// <summary>
    /// Maximum value present in the property values.
    /// </summary>
    max?: number;

    /// <summary>
    /// Minimum value present in the property values.
    /// </summary>
    min?: number;
}
