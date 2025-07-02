export type NumericValue = number | Numeric1DArray | Numeric2DArray;
/**
 * An array of numeric values
 *
 * @minItems 1
 */
export type Numeric1DArray = [number, ...number[]];
/**
 * An array of arrays of numeric values
 *
 * @minItems 1
 */
export type Numeric2DArray = [Numeric1DArray, ...Numeric1DArray[]];

export type OffsetType = "UINT8" | "UINT16" | "UINT32" | "UINT64" | string;

export type String1DArray = [string, ...string[]];
export type Boolean1DArray = [boolean, ...boolean[]];

export type NoDataValue = NumericValue | string | String1DArray;
export type AnyValue = NumericValue | string | String1DArray | boolean | Boolean1DArray;
