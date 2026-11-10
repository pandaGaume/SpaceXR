import * as fs from "fs";

/// <summary>
/// A single labeled sample: flat pixel array + integer label.
/// </summary>
export interface IDatasetSample {
    label: number;
    pixels: number[];
}

/// <summary>
/// A dataset loaded from a JSON file exported by cifar10_to_json.py (or similar).
/// </summary>
export interface IDataset {
    count: number;
    width: number;
    height: number;
    channels: number;
    format: string; // "CHW" or "HWC"
    samples: IDatasetSample[];
}

/// <summary>
/// Dataset metadata (label names, shape).
/// </summary>
export interface IDatasetMeta {
    labels: string[];
    numClasses: number;
    width: number;
    height: number;
    channels: number;
    format: string;
}

/// <summary>
/// Loads image classification datasets from JSON files.
/// Compatible with the output of cifar10_to_json.py.
/// </summary>
export class DatasetLoader {
    /// <summary>
    /// Loads a dataset JSON file from disk.
    /// </summary>
    public static loadFromFile(filePath: string): IDataset {
        const raw = fs.readFileSync(filePath, "utf-8");
        return JSON.parse(raw) as IDataset;
    }

    /// <summary>
    /// Loads dataset metadata from a JSON file.
    /// </summary>
    public static loadMeta(filePath: string): IDatasetMeta {
        const raw = fs.readFileSync(filePath, "utf-8");
        return JSON.parse(raw) as IDatasetMeta;
    }

    /// <summary>
    /// Converts a label index to a one-hot encoded array.
    /// Example: oneHot(3, 10) → [0, 0, 0, 1, 0, 0, 0, 0, 0, 0]
    /// </summary>
    public static oneHot(label: number, numClasses: number): number[] {
        const vec = new Array(numClasses).fill(0);
        vec[label] = 1;
        return vec;
    }

    /// <summary>
    /// Shuffles samples in-place using Fisher-Yates.
    /// </summary>
    public static shuffle(dataset: IDataset): void {
        const samples = dataset.samples;
        for (let i = samples.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [samples[i], samples[j]] = [samples[j], samples[i]];
        }
    }

    /// <summary>
    /// Returns a subset of the dataset (first `count` samples).
    /// </summary>
    public static subset(dataset: IDataset, count: number): IDataset {
        return {
            ...dataset,
            count: Math.min(count, dataset.count),
            samples: dataset.samples.slice(0, count),
        };
    }

    /// <summary>
    /// Iterates over mini-batches of samples.
    /// </summary>
    public static *batches(dataset: IDataset, batchSize: number): Generator<IDatasetSample[]> {
        for (let i = 0; i < dataset.samples.length; i += batchSize) {
            yield dataset.samples.slice(i, i + batchSize);
        }
    }
}
