/**
 * An enum value.
 */
export interface IEnumValue {
    /**
     * The name of the enum value.
     */
    name: string;
    /**
     * The description of the enum value.
     */
    description?: string;
    /**
     * The integer enum value.
     */
    value: number;
    [k: string]: unknown;
}
