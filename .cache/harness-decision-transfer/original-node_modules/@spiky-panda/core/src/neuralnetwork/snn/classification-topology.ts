export interface IClassificationSummary {
    correct: number;
    total: number;
    accuracy: number;
    balancedAccuracy: number;
    macroF1: number;
    perClassRecall: number[];
    confusionMatrix: number[][];
}

export interface IOneVsReferenceDecision {
    predictedClass: number;
    activeHeadCount: number;
    winningMargin: number;
}

/**
 * Decodes independent class-vs-reference margins. Class zero is the reference
 * class and margin index zero corresponds to class one.
 */
export function decodeOneVsReference(margins: ReadonlyArray<number>, referenceThreshold = 0): IOneVsReferenceDecision {
    if (margins.length === 0) throw new Error("One-vs-reference decoding requires at least one specialist margin.");
    let winner = 0;
    let activeHeadCount = 0;
    for (let index = 0; index < margins.length; index++) {
        assertFinite(margins[index], "specialist margin");
        if (margins[index] > referenceThreshold) activeHeadCount++;
        if (margins[index] > margins[winner]) winner = index;
    }
    const winningMargin = margins[winner];
    return {
        predictedClass: winningMargin > referenceThreshold ? winner + 1 : 0,
        activeHeadCount,
        winningMargin,
    };
}

/** Decodes a healthy/fault gate followed by a fault-severity classifier. */
export function decodeHierarchicalClassification(gateMargin: number, severityScores: ReadonlyArray<number>, gateThreshold = 0): number {
    assertFinite(gateMargin, "hierarchical gate margin");
    if (severityScores.length === 0) throw new Error("Hierarchical decoding requires at least one severity score.");
    if (gateMargin <= gateThreshold) return 0;
    return argmax(severityScores) + 1;
}

/**
 * Decodes cumulative ordinal heads. Head k answers whether the class is at
 * least k + 1. A negative lower threshold stops the ordinal chain.
 */
export function decodeOrdinalClassification(margins: ReadonlyArray<number>, thresholds: ReadonlyArray<number>): number {
    if (margins.length === 0 || margins.length !== thresholds.length) {
        throw new Error("Ordinal decoding requires equally sized, non-empty margins and thresholds.");
    }
    let predictedClass = 0;
    for (let index = 0; index < margins.length; index++) {
        assertFinite(margins[index], "ordinal margin");
        assertFinite(thresholds[index], "ordinal threshold");
        if (margins[index] <= thresholds[index]) break;
        predictedClass++;
    }
    return predictedClass;
}

/** Counts adjacent false-to-true transitions in cumulative ordinal decisions. */
export function countOrdinalViolations(margins: ReadonlyArray<number>, thresholds: ReadonlyArray<number>): number {
    if (margins.length !== thresholds.length) throw new Error("Ordinal margins and thresholds must have the same size.");
    let violations = 0;
    let previousActive = true;
    for (let index = 0; index < margins.length; index++) {
        assertFinite(margins[index], "ordinal margin");
        assertFinite(thresholds[index], "ordinal threshold");
        const active = margins[index] > thresholds[index];
        if (!previousActive && active) violations++;
        previousActive = active;
    }
    return violations;
}

export function summarizeClassification(actual: ReadonlyArray<number>, predicted: ReadonlyArray<number>, classCount: number): IClassificationSummary {
    if (!Number.isInteger(classCount) || classCount <= 0) throw new Error("Classification class count must be a positive integer.");
    if (actual.length !== predicted.length) throw new Error("Actual and predicted class vectors must have the same size.");
    const confusionMatrix = Array.from({ length: classCount }, () => new Array<number>(classCount).fill(0));
    let correct = 0;
    for (let index = 0; index < actual.length; index++) {
        const expected = actual[index];
        const observed = predicted[index];
        assertClassIndex(expected, classCount, "actual");
        assertClassIndex(observed, classCount, "predicted");
        confusionMatrix[expected][observed]++;
        if (expected === observed) correct++;
    }
    const perClassRecall = new Array<number>(classCount).fill(0);
    const perClassF1 = new Array<number>(classCount).fill(0);
    for (let classIndex = 0; classIndex < classCount; classIndex++) {
        const truePositive = confusionMatrix[classIndex][classIndex];
        const actualCount = confusionMatrix[classIndex].reduce((total, value) => total + value, 0);
        let predictedCount = 0;
        for (let row = 0; row < classCount; row++) predictedCount += confusionMatrix[row][classIndex];
        perClassRecall[classIndex] = actualCount === 0 ? 0 : truePositive / actualCount;
        const precision = predictedCount === 0 ? 0 : truePositive / predictedCount;
        const recall = perClassRecall[classIndex];
        perClassF1[classIndex] = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
    }
    const total = actual.length;
    return {
        correct,
        total,
        accuracy: total === 0 ? 0 : correct / total,
        balancedAccuracy: mean(perClassRecall),
        macroF1: mean(perClassF1),
        perClassRecall,
        confusionMatrix,
    };
}

function argmax(values: ReadonlyArray<number>): number {
    let winner = 0;
    for (let index = 0; index < values.length; index++) {
        assertFinite(values[index], "classification score");
        if (values[index] > values[winner]) winner = index;
    }
    return winner;
}

function mean(values: ReadonlyArray<number>): number {
    return values.length === 0 ? 0 : values.reduce((total, value) => total + value, 0) / values.length;
}

function assertClassIndex(value: number, classCount: number, label: string): void {
    if (!Number.isInteger(value) || value < 0 || value >= classCount) {
        throw new Error(`Classification ${label} index ${value} is outside [0, ${classCount - 1}].`);
    }
}

function assertFinite(value: number, label: string): void {
    if (!Number.isFinite(value)) throw new Error(`Classification ${label} must be finite.`);
}
