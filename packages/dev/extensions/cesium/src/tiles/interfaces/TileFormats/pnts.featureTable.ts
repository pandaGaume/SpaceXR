import { IRootProperty } from "../common/rootProperty";
import { IBinaryBodyReference, GlobalPropertyCartesian3, GlobalPropertyCartesian4, GlobalPropertyInteger } from "./featureTable";

/**
 * A set of Point Cloud semantics that contains values defining the position and appearance properties for points in a tile.
 */
export interface IPointCloudFeatureTable extends IRootProperty {
    POSITION?: IBinaryBodyReference;
    POSITION_QUANTIZED?: IBinaryBodyReference;
    RGBA?: IBinaryBodyReference;
    RGB?: IBinaryBodyReference;
    RGB565?: IBinaryBodyReference;
    NORMAL?: IBinaryBodyReference;
    NORMAL_OCT16P?: IBinaryBodyReference;
    BATCH_ID?: IBinaryBodyReference;
    POINTS_LENGTH: GlobalPropertyInteger;
    RTC_CENTER?: GlobalPropertyCartesian3;
    QUANTIZED_VOLUME_OFFSET?: GlobalPropertyCartesian3;
    QUANTIZED_VOLUME_SCALE?: GlobalPropertyCartesian3;
    CONSTANT_RGBA?: GlobalPropertyCartesian4;
    BATCH_LENGTH?: GlobalPropertyInteger;
}
