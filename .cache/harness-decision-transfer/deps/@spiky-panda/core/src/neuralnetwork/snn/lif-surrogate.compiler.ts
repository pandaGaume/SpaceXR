import { RuntimeGraph } from "../../execution/execution.graph";
import { inSlotOf, type IChannel, type IRuntimeNode } from "../../execution/execution.interfaces";
import { LifNeuronNode } from "./lif-neuron.node";
import {
    ConstrainedLifSurrogateSubgraph,
    LIF_SURROGATE_DECISION_SLOT,
    LIF_SURROGATE_INTEGRATED_SLOT,
    LIF_SURROGATE_SPIKE_SLOT,
    LIF_SURROGATE_STATE_SLOT,
} from "./lif-surrogate.subgraph";

export interface IConstrainedLifCompilationResult {
    graph: RuntimeGraph<IRuntimeNode, IChannel>;
    neuron: LifNeuronNode;
    removedNodes: number;
    removedLinks: number;
}

export interface IConstrainedLifNetworkCompilationResult {
    graph: RuntimeGraph<IRuntimeNode, IChannel>;
    neurons: ReadonlyArray<LifNeuronNode>;
    removedNodes: number;
    removedLinks: number;
}

/**
 * Destructively compiles one constrained training motif into one native LIF.
 * External channels are preserved and rewired. Internal stages and channels
 * are removed from the runtime topology, so they have no inference cost.
 *
 * Existing Session instances become stale after this rewrite. Construct a new
 * Session from the returned graph before running inference.
 */
export function compileConstrainedLifSubgraph(graph: RuntimeGraph<IRuntimeNode, IChannel>, surrogate: ConstrainedLifSurrogateSubgraph): IConstrainedLifCompilationResult {
    assertConstrainedTopology(graph, surrogate);

    const config = surrogate.config;
    const neuron = new LifNeuronNode();
    neuron.id = surrogate.groupId;
    neuron.position = surrogate.integrate.position;
    neuron.restingPotential = config.restingPotential;
    neuron.initialPotential = config.initialPotential;
    neuron.threshold = config.threshold;
    neuron.resetPotential = config.resetPotential;
    neuron.membraneTimeConstant = config.membraneTimeConstant;
    neuron.refractoryPeriod = 0;
    neuron.spikeAmplitude = config.spikeAmplitude;

    const stages = new Set<IRuntimeNode>(surrogate.nodes);
    const internalLinks = new Set<IChannel>(surrogate.links);

    for (const link of graph.links) {
        if (internalLinks.has(link)) continue;
        if (link.ofin === surrogate.inputNode) {
            link.ofin = neuron;
        }
        if (link.oini === surrogate.outputNode) {
            link.oini = neuron;
        }
    }

    for (const link of surrogate.links) link.dispose();
    graph.links = graph.links.filter((link) => !internalLinks.has(link));

    const firstStageIndex = Math.min(...surrogate.nodes.map((node) => graph.nodes.indexOf(node)));
    graph.nodes = graph.nodes.filter((node) => !stages.has(node));
    graph.nodes.splice(firstStageIndex, 0, neuron);
    graph.inputs = replacePartition(graph.inputs, stages, neuron);
    graph.outputs = replacePartition(graph.outputs, stages, neuron);
    graph.hiddens = replacePartition(graph.hiddens, stages, neuron);

    for (const link of graph.links) {
        delete (link as IChannel & { _idx?: number })._idx;
    }
    graph.invalidateTopology();

    return {
        graph,
        neuron,
        removedNodes: surrogate.nodes.length,
        removedLinks: surrogate.links.length,
    };
}

/** Compile every distinct constrained teacher in a network to one native LIF. */
export function compileConstrainedLifNetwork(
    graph: RuntimeGraph<IRuntimeNode, IChannel>,
    surrogates: ReadonlyArray<ConstrainedLifSurrogateSubgraph>
): IConstrainedLifNetworkCompilationResult {
    if (surrogates.length === 0) throw new Error("A constrained LIF network compilation requires at least one teacher.");
    if (new Set(surrogates).size !== surrogates.length) throw new Error("A constrained LIF teacher can be compiled only once.");
    for (const surrogate of surrogates) assertConstrainedTopology(graph, surrogate);

    const neurons: LifNeuronNode[] = [];
    let removedNodes = 0;
    let removedLinks = 0;
    for (const surrogate of surrogates) {
        const result = compileConstrainedLifSubgraph(graph, surrogate);
        neurons.push(result.neuron);
        removedNodes += result.removedNodes;
        removedLinks += result.removedLinks;
    }
    return { graph, neurons, removedNodes, removedLinks };
}

function assertConstrainedTopology(graph: RuntimeGraph<IRuntimeNode, IChannel>, surrogate: ConstrainedLifSurrogateSubgraph): void {
    if (graph.mode !== "dynamic") {
        throw new Error("A constrained LIF surrogate requires a dynamic RuntimeGraph.");
    }
    for (const node of surrogate.nodes) {
        if (!graph.nodes.includes(node)) throw new Error(`Surrogate stage "${String(node.id)}" is not part of the graph.`);
    }
    for (const link of surrogate.links) {
        if (!graph.links.includes(link)) throw new Error("The constrained LIF surrogate is missing an internal link.");
    }

    assertInternalLink(surrogate.integratedLink, surrogate.integrate, surrogate.thresholdStage, LIF_SURROGATE_INTEGRATED_SLOT);
    assertInternalLink(surrogate.decisionLink, surrogate.thresholdStage, surrogate.reset, LIF_SURROGATE_DECISION_SLOT);
    assertInternalLink(surrogate.stateFeedbackLink, surrogate.reset, surrogate.integrate, LIF_SURROGATE_STATE_SLOT);
    if (!surrogate.stateFeedbackLink.delayed || !surrogate.stateFeedbackLink.initialValue) {
        throw new Error("The constrained LIF state feedback must be seeded.");
    }

    const stages = new Set<IRuntimeNode>(surrogate.nodes);
    const internalLinks = new Set<IChannel>(surrogate.links);
    for (const link of graph.links) {
        if (internalLinks.has(link)) continue;
        const fromStage = link.oini !== null && stages.has(link.oini as IRuntimeNode);
        const toStage = link.ofin !== null && stages.has(link.ofin as IRuntimeNode);
        if (toStage && (link.ofin !== surrogate.inputNode || inSlotOf(link) !== LIF_SURROGATE_SPIKE_SLOT)) {
            throw new Error("Only the integrate stage spike input may receive external channels.");
        }
        if (fromStage && (link.oini !== surrogate.outputNode || link.slot !== LIF_SURROGATE_SPIKE_SLOT)) {
            throw new Error("Only the threshold stage spike output may feed external channels.");
        }
    }
}

function assertInternalLink(link: IChannel, source: IRuntimeNode, target: IRuntimeNode, slot: string): void {
    if (link.oini !== source || link.ofin !== target || link.slot !== slot || inSlotOf(link) !== slot) {
        throw new Error(`Invalid constrained LIF internal link "${slot}".`);
    }
}

function replacePartition(partition: IRuntimeNode[], stages: ReadonlySet<IRuntimeNode>, neuron: LifNeuronNode): IRuntimeNode[] {
    const output: IRuntimeNode[] = [];
    let replaced = false;
    for (const node of partition) {
        if (stages.has(node)) {
            if (!replaced) output.push(neuron);
            replaced = true;
        } else {
            output.push(node);
        }
    }
    return output;
}
