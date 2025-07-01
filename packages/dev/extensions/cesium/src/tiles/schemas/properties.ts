/**
 * A dictionary object of metadata about per-feature properties.
 */
export interface IProperties {
    /**
     * The maximum value of this property of all the features in the tileset. The maximum value shall not be smaller than the minimum value.
     */
    maximum: number;
    /**
     * The minimum value of this property of all the features in the tileset. The maximum value shall not be smaller than the minimum value.
     */
    minimum: number;
    [k: string]: unknown;
}
