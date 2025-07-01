import { TemplateURI } from "./templateUri";

/**
 * An object describing the location of subtree files.
 */
export interface ISubtrees {
    uri: TemplateURI;
    [k: string]: unknown;
}
