import { AnyValue, NoDataValue, NumericValue } from "../common/definitions";

/**
 * A single property of a metadata class.
 */
export interface IClassProperty {
    /**
     * The name of the property, e.g. for display purposes.
     */
    name?: string;
    /**
     * The description of the property.
     */
    description?: string;
    /**
     * The element type.
     */
    type: "SCALAR" | "VEC2" | "VEC3" | "VEC4" | "MAT2" | "MAT3" | "MAT4" | "STRING" | "BOOLEAN" | "ENUM" | string;
    /**
     * The datatype of the element's components. Required for `SCALAR`, `VECN`, and `MATN` types, and disallowed for other types.
     */
    componentType?: "INT8" | "UINT8" | "INT16" | "UINT16" | "INT32" | "UINT32" | "INT64" | "UINT64" | "FLOAT32" | "FLOAT64" | string;
    /**
     * Enum ID as declared in the `enums` dictionary. Required when `type` is `ENUM`. Disallowed when `type` is not `ENUM`
     */
    enumType?: string;
    /**
     * Whether the property is an array. When `count` is defined the property is a fixed-length array. Otherwise the property is a variable-length array.
     */
    array?: boolean;
    /**
     * The number of array elements. May only be defined when `array` is `true`.
     */
    count?: number;
    /**
     * Specifies whether integer values are normalized. Only applicable to `SCALAR`, `VECN`, and `MATN` types with integer component types. For unsigned integer component types, values are normalized between `[0.0, 1.0]`. For signed integer component types, values are normalized between `[-1.0, 1.0]`. For all other component types, this property shall be false.
     */
    normalized?: boolean;
    offset?: NumericValue;
    scale?: NumericValue;
    max?: NumericValue;
    min?: NumericValue;
    /**
     * If required, the property shall be present in every entity conforming to the class. If not required, individual entities may include `noData` values, or the entire property may be omitted. As a result, `noData` has no effect on a required property. Client implementations may use required properties to make performance optimizations.
     */
    required?: boolean;
    noData?: NoDataValue;
    default?: AnyValue;
    /**
     * An identifier that describes how this property should be interpreted. The semantic cannot be used by other properties in the class.
     */
    semantic?: string;
    [k: string]: unknown;
}
