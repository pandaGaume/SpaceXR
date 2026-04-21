import { IExtension } from "./extension";
import { IExtras } from "./extras";

/**
 * A basis for storing extensions and extras.
 */
export interface IRootProperty {
    extensions?: IExtension;
    extras?: IExtras;
}
