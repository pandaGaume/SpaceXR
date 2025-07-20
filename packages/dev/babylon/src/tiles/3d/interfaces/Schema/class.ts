import { IClassProperty } from "./class.property";

/**
 * A class containing a set of properties.
 */
export interface IClass {
    /**
     * The name of the class, e.g. for display purposes.
     */
    name?: string;
    /**
     * The description of the class.
     */
    description?: string;
    /**
     * A dictionary, where each key is a property ID and each value is an object defining the property. Property IDs shall be alphanumeric identifiers matching the regular expression `^[a-zA-Z_][a-zA-Z0-9_]*$`.
     */
    properties?: {
        [k: string]: IClassProperty;
    };
}
