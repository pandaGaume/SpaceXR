import { IConditions } from "./style.conditions";
import { BooleanExpression, ColorExpression, Expression } from "./style.expression";
import { IMeta } from "./style.meta";

/**
 * A 3D Tiles style.
 */
export interface IStyle {
    /**
     * A dictionary object of `expression` strings mapped to a variable name key that may be referenced throughout the style. If an expression references a defined variable, it is replaced with the evaluated result of the corresponding expression.
     */
    defines?: {
        [k: string]: Expression;
    };
    /**
     * A `boolean expression` or `conditions` property which determines if a feature should be shown.
     */
    show?: BooleanExpression | IConditions;
    /**
     * A `color expression` or `conditions` property which determines the color blended with the feature's intrinsic color.
     */
    color?: ColorExpression | IConditions;
    meta?: IMeta;
    [k: string]: unknown;
}
