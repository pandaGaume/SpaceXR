import { IClass } from "./class";
import { IEnum } from "./enum";

/**
 * An object defining classes and enums.
 */
export interface ISchema {
    /**
     * Unique identifier for the schema. Schema IDs shall be alphanumeric identifiers matching the regular expression `^[a-zA-Z_][a-zA-Z0-9_]*$`.
     */
    id: string;
    /**
     * The name of the schema, e.g. for display purposes.
     */
    name?: string;
    /**
     * The description of the schema.
     */
    description?: string;
    /**
     * Application-specific version of the schema.
     */
    version?: string;
    /**
     * A dictionary, where each key is a class ID and each value is an object defining the class. Class IDs shall be alphanumeric identifiers matching the regular expression `^[a-zA-Z_][a-zA-Z0-9_]*$`.
     */
    classes?: {
        [k: string]: IClass;
    };
    /**
     * A dictionary, where each key is an enum ID and each value is an object defining the values for the enum. Enum IDs shall be alphanumeric identifiers matching the regular expression `^[a-zA-Z_][a-zA-Z0-9_]*$`.
     */
    enums?: {
        [k: string]: IEnum;
    };
    [k: string]: unknown;
}
