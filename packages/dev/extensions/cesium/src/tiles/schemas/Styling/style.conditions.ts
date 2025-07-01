import { Expression } from "./style.expression";

/**
 * An `expression` evaluated as the result of a condition being true. An array of two expressions. If the first expression is evaluated and the result is `true`, then the second expression is evaluated and returned as the result of the condition.
 *
 * @minItems 2
 * @maxItems 2
 */
export type Condition = [Expression, Expression];

/**
 * A series of conditions evaluated in order, like a series of if...else statements that result in an expression being evaluated.
 */
export interface IConditions {
    /**
     * A series of boolean conditions evaluated in order. For the first one that evaluates to true, its value, the 'result' (which is also an expression), is evaluated and returned. Result expressions shall all be the same type. If no condition evaluates to true, the result is `undefined`. When conditions is `undefined`, `null`, or an empty object, the result is `undefined`.
     */
    conditions?: Condition[];
    [k: string]: unknown;
}
