import { NumericValue } from "../common/definitions";

/**
 * Statistics about property values.
 */
export interface IPropertyStatistics {
    min?: NumericValue;
    max?: NumericValue;
    mean?: NumericValue;
    median?: NumericValue;
    standardDeviation?: NumericValue;
    variance?: NumericValue;
    sum?: NumericValue;
    /**
     * A dictionary, where each key corresponds to an enum `name` and each value is the number of occurrences of that enum. Only applicable when `type` is `ENUM`. For fixed-length arrays, this is an array of component-wise occurrences.
     */
    occurrences?: {
        [k: string]: number | [number, ...number[]];
    };
}
