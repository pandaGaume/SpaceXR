import { Expression } from "./style.expression";

/**
 * A series of property names and the `expression` to evaluate for the value of that property.
 */
export interface IMeta {
    [k: string]: Expression;
}
