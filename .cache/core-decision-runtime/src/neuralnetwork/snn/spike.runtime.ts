import { ISpikeNeuron, ISnnGraph, ISpike, ISpikeSynapse } from "./spike.interfaces";
import { STDP, STDPFunction, ISTDPConfig, DEFAULT_STDP_CONFIG } from "./spike.stdp";

export class SNNRuntime {
    /**
     * Prepares input spikes from an ISnnGraph by binding input data to the graph's input nodes.
     */
    public static prepareInputs(graph: ISnnGraph, inputData: number[]): Array<{ neuron: ISpikeNeuron; amplitude: number }> {
        if (graph.inputs.length !== inputData.length) {
            throw new Error(`Input data size (${inputData.length}) does not match the number of graph inputs (${graph.inputs.length})`);
        }

        return graph.inputs.map((neuron, index) => ({
            neuron,
            amplitude: inputData[index],
        }));
    }

    private _stdpRule: STDPFunction;
    private _stdpConfig: ISTDPConfig;
    private _tick: number = 0;

    public constructor(stdpRule?: STDPFunction, stdpConfig?: ISTDPConfig) {
        this._stdpRule = stdpRule ?? STDP.exponential();
        this._stdpConfig = stdpConfig ?? DEFAULT_STDP_CONFIG;
    }

    public get tick(): number {
        return this._tick;
    }

    /**
     * Injects spikes into the input neurons and propagates them through the network until no more spikes occur.
     */
    public pulse(inputSpikes: Array<{ neuron: ISpikeNeuron; amplitude: number }>) {
        let activeSpikes: ISpike[] = [];

        // Step 1: Inject initial spikes
        for (const { neuron, amplitude } of inputSpikes) {
            neuron.membranePotential += amplitude;

            if (neuron.membranePotential >= neuron.threshold) {
                activeSpikes.push(this._fireNeuron(neuron));
            }
        }

        // Step 2: Process spikes continuously until no more spikes are generated
        while (activeSpikes.length > 0) {
            const nextSpikes: ISpike[] = [];
            this._tick++;

            for (const spike of activeSpikes) {
                const neuron = spike.source;

                // Step 3: Propagate to connected neurons via 'onsc' links
                const synapses = neuron.onsc<ISpikeSynapse>();
                if (synapses) {
                    for (const synapse of synapses) {
                        const postNeuron = synapse.ofin as ISpikeNeuron;

                        // Apply synaptic weight
                        postNeuron.membranePotential += spike.amplitude * synapse.weight;

                        // If neuron reaches threshold, it fires
                        if (postNeuron.membranePotential >= postNeuron.threshold) {
                            const newSpike = this._fireNeuron(postNeuron);
                            nextSpikes.push(newSpike);

                            // Apply STDP only to the active synapse
                            this._applySTDP(synapse);
                        }
                    }
                }
            }

            // Continue propagation if new spikes were created
            activeSpikes = nextSpikes;
        }
    }

    /**
     * Fires a neuron and resets its membrane potential.
     */
    private _fireNeuron(neuron: ISpikeNeuron): ISpike {
        this._tick++;
        const spike: ISpike = {
            timestamp: this._tick,
            amplitude: neuron.membranePotential,
            source: neuron,
        };

        neuron.spikes.push(spike);
        neuron.membranePotential = 0;
        neuron.lastSpikeTime = spike.timestamp;

        return spike;
    }

    /**
     * Applies STDP learning to the active synapse using the configured rule and weight bounds.
     */
    private _applySTDP(synapse: ISpikeSynapse) {
        const preNeuron = synapse.oini as ISpikeNeuron;
        const postNeuron = synapse.ofin as ISpikeNeuron;

        if (preNeuron.lastSpikeTime !== null && postNeuron.lastSpikeTime !== null) {
            const deltaT = postNeuron.lastSpikeTime - preNeuron.lastSpikeTime;
            synapse.weight = this._stdpRule(deltaT, synapse.weight);
            synapse.weight = Math.max(this._stdpConfig.minWeight, Math.min(this._stdpConfig.maxWeight, synapse.weight));
        }
    }
}
