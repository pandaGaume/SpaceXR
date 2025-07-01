import { IClassStatistics } from "./statistics.class";

/**
 * Statistics about entities.
 */
export interface IStatistics {
    /**
     * A dictionary, where each key corresponds to a class ID in the `classes` dictionary of the metatata schema that was defined for the tileset that contains these statistics. Each value is an object containing statistics about entities that conform to the class.
     */
    classes?: {
        [k: string]: IClassStatistics;
    };
    [k: string]: unknown;
}
