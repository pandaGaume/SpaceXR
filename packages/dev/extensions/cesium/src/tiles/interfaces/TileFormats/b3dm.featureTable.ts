import { IRootProperty } from "../common/rootProperty";
import { GlobalPropertyCartesian3, GlobalPropertyInteger } from "./featureTable";

/**
 * A set of Batched 3D Model semantics that contain additional information about features in a tile.
 */
export interface IBatched3DModelFeatureTable extends IRootProperty {
    BATCH_LENGTH: GlobalPropertyInteger;
    RTC_CENTER?: GlobalPropertyCartesian3;
}
