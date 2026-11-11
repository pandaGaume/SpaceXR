import { IBackpropSynapseContext, IOptimizer } from "./nn.training";

/// <summary>
/// Common optimizer strategies for neural network training.
/// These are not architecture-specific and can be used with MLPs, CNNs, etc.
/// </summary>
export class Optimizers {
    /// <summary>
    /// Stochastic Gradient Descent (SGD) optimizer
    /// </summary>
    public static SGD = (): IOptimizer => ({
        apply(synapse, lr, gradient, _ctx) {
            const bag = (synapse.bag ??= { gradient: gradient }) as IBackpropSynapseContext;

            bag.gradient = gradient;
            bag.weightDelta = -lr * gradient;

            synapse.weight += bag.weightDelta;
        },
    });

    /// <summary>
    /// SGD with Momentum optimizer
    /// </summary>
    public static MomentumSGD = (momentum: number): IOptimizer => ({
        apply(synapse, lr, gradient, _ctx) {
            const bag = (synapse.bag ??= { gradient: gradient }) as IBackpropSynapseContext;

            bag.gradient = gradient;
            bag.velocity ??= 0;

            bag.velocity = momentum * bag.velocity - lr * gradient;
            bag.weightDelta = bag.velocity;

            synapse.weight += bag.weightDelta;
        },
    });

    /// <summary>
    /// Nesterov Accelerated Gradient (NAG) optimizer
    /// </summary>
    public static NAG = (momentum: number = 0.9): IOptimizer => ({
        apply(synapse, lr, gradient, _ctx) {
            const bag = (synapse.bag ??= { gradient: gradient }) as IBackpropSynapseContext;

            bag.gradient = gradient;
            bag.velocity ??= 0;

            bag.velocity = momentum * bag.velocity - lr * gradient;
            bag.weightDelta = bag.velocity;

            synapse.weight += bag.weightDelta;
            bag.prelookedWeight = undefined;
        },
    });

    /// <summary>
    /// Adam optimizer with bias correction
    /// </summary>
    public static Adam = (beta1 = 0.9, beta2 = 0.999, epsilon = 1e-8): IOptimizer => ({
        apply(synapse, lr, gradient, ctx) {
            const bag = (synapse.bag ??= { gradient: gradient }) as IBackpropSynapseContext;
            const t = ctx.iteration + 1;

            bag.gradient = gradient;
            bag.m ??= 0;
            bag.v ??= 0;

            bag.m = beta1 * bag.m + (1 - beta1) * gradient;
            bag.v = beta2 * bag.v + (1 - beta2) * gradient * gradient;

            const mHat = bag.m / (1 - Math.pow(beta1, t));
            const vHat = bag.v / (1 - Math.pow(beta2, t));

            bag.weightDelta = (-lr * mHat) / (Math.sqrt(vHat) + epsilon);
            synapse.weight += bag.weightDelta;
        },
    });
}
