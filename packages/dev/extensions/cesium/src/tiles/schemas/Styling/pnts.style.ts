import { IConditions } from "./style.conditions";
import { NumberExpression } from "./style.expression";

/**
 * A 3D Tiles style with additional properties for Point Clouds.
 */
export interface IPointCloudStyle {
    /**
     * A `number expression` or `conditions` property which determines the size of the points in pixels.
     */
    pointSize?: NumberExpression | IConditions;
    [k: string]: unknown;
}
