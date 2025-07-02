import { IPropertyStatistics } from "./statistics.class.property";

/**
 * Statistics about entities that conform to a class that was defined in a metadata schema.
 */
export interface IClassStatistics {
    /**
     * The number of entities that conform to the class.
     */
    count?: number;
    /**
     * A dictionary, where each key corresponds to a property ID in the class' `properties` dictionary and each value is an object containing statistics about property values.
     */
    properties?: {
        [k: string]: IPropertyStatistics;
    };
}
