import { IActivationFunction } from "./mlp.interfaces";

/**
 * Common activation functions
 */
export const ActivationFunctions = {
    relu: {
        fn: (x: number) => Math.max(0, x),
        derivative: (y: number) => (y > 0 ? 1 : 0),
    },

    sigmoid: {
        fn: (x: number) => 1 / (1 + Math.exp(-x)),
        derivative: (y: number) => y * (1 - y), // y = sigmoid(x)
    },

    tanh: {
        fn: (x: number) => Math.tanh(x),
        derivative: (y: number) => 1 - y * y, // y = tanh(x)
    },

    linear: {
        fn: (x: number) => x,
        derivative: (_y: number) => 1,
    },
} satisfies Record<string, IActivationFunction>;

export type ActivationFunctionName = keyof typeof ActivationFunctions;
