export type STDPFunction = (deltaT: number, weight: number) => number;

export interface ISTDPConfig {
    minWeight: number;
    maxWeight: number;
}

export const DEFAULT_STDP_CONFIG: ISTDPConfig = {
    minWeight: 0.01,
    maxWeight: 1.0,
};

export class STDP {
    public static exponential(learningRate: number = 0.01, tau: number = 20): STDPFunction {
        return (deltaT: number, weight: number): number => {
            if (deltaT > 0) {
                return weight + learningRate * Math.exp(-deltaT / tau); // LTP
            } else if (deltaT < 0) {
                return weight - learningRate * Math.exp(deltaT / tau); // LTD
            }
            return weight;
        };
    }

    public static hebbian(learningRate: number = 0.005): STDPFunction {
        return (deltaT: number, weight: number): number => {
            return weight + learningRate * deltaT;
        };
    }

    public static threshold(window: number = 10, potentiation: number = 0.02, depression: number = 0.01): STDPFunction {
        return (deltaT: number, weight: number): number => {
            if (Math.abs(deltaT) < window) {
                return weight + potentiation;
            } else {
                return weight - depression;
            }
        };
    }
}
