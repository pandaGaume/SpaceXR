import * as fs from "fs";
import * as zlib from "zlib";
import * as https from "https";
import * as path from "path";
import { IDataset, IDatasetSample } from "./dataset";

const MNIST_BASE_URL = "https://storage.googleapis.com/cvdf-datasets/mnist/";

const MNIST_FILES = {
    trainImages: "train-images-idx3-ubyte.gz",
    trainLabels: "train-labels-idx1-ubyte.gz",
    testImages: "t10k-images-idx3-ubyte.gz",
    testLabels: "t10k-labels-idx1-ubyte.gz",
};

/// <summary>
/// Downloads a file from a URL to disk. Skips if already present.
/// </summary>
function downloadFile(url: string, destPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        if (fs.existsSync(destPath)) {
            resolve();
            return;
        }

        const dir = path.dirname(destPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        const file = fs.createWriteStream(destPath);
        https
            .get(url, (response) => {
                if (response.statusCode === 301 || response.statusCode === 302) {
                    const redirectUrl = response.headers.location!;
                    https
                        .get(redirectUrl, (redirectResponse) => {
                            redirectResponse.pipe(file);
                            file.on("finish", () => {
                                file.close();
                                resolve();
                            });
                        })
                        .on("error", reject);
                    return;
                }
                response.pipe(file);
                file.on("finish", () => {
                    file.close();
                    resolve();
                });
            })
            .on("error", reject);
    });
}

/// <summary>
/// Reads a .gz file and returns the decompressed buffer.
/// </summary>
function readGzipped(filePath: string): Buffer {
    const compressed = fs.readFileSync(filePath);
    return zlib.gunzipSync(compressed);
}

/// <summary>
/// Parses IDX3 image file format (magic, count, rows, cols, pixels).
/// Returns an array of flat pixel arrays normalized to [0, 1].
/// </summary>
function parseIDX3Images(buffer: Buffer): { images: number[][]; rows: number; cols: number } {
    const magic = buffer.readUInt32BE(0);
    if (magic !== 2051) {
        throw new Error(`Invalid IDX3 magic number: ${magic}`);
    }

    const count = buffer.readUInt32BE(4);
    const rows = buffer.readUInt32BE(8);
    const cols = buffer.readUInt32BE(12);
    const pixelsPerImage = rows * cols;

    const images: number[][] = [];
    let offset = 16;
    for (let i = 0; i < count; i++) {
        const pixels = new Array(pixelsPerImage);
        for (let j = 0; j < pixelsPerImage; j++) {
            pixels[j] = buffer[offset++] / 255.0;
        }
        images.push(pixels);
    }

    return { images, rows, cols };
}

/// <summary>
/// Parses IDX1 label file format (magic, count, labels).
/// </summary>
function parseIDX1Labels(buffer: Buffer): number[] {
    const magic = buffer.readUInt32BE(0);
    if (magic !== 2049) {
        throw new Error(`Invalid IDX1 magic number: ${magic}`);
    }

    const count = buffer.readUInt32BE(4);
    const labels: number[] = [];
    for (let i = 0; i < count; i++) {
        labels.push(buffer[8 + i]);
    }

    return labels;
}

/// <summary>
/// Downloads and loads the MNIST dataset.
/// Returns train and test sets as IDataset objects.
///
/// Options:
///   dataDir:       directory to store downloaded files (default: "data/mnist")
///   maxTrain:      limit number of training samples (default: all 60000)
///   maxTest:       limit number of test samples (default: all 10000)
/// </summary>
export class MnistLoader {
    public static async download(dataDir: string = "data/mnist"): Promise<void> {
        for (const [, filename] of Object.entries(MNIST_FILES)) {
            const url = MNIST_BASE_URL + filename;
            const dest = path.join(dataDir, filename);
            process.stdout.write(`Downloading ${filename}...`);
            await downloadFile(url, dest);
            process.stdout.write(" done\n");
        }
    }

    public static loadTrainSet(dataDir: string = "data/mnist", maxSamples?: number): IDataset {
        return MnistLoader._load(path.join(dataDir, MNIST_FILES.trainImages), path.join(dataDir, MNIST_FILES.trainLabels), maxSamples);
    }

    public static loadTestSet(dataDir: string = "data/mnist", maxSamples?: number): IDataset {
        return MnistLoader._load(path.join(dataDir, MNIST_FILES.testImages), path.join(dataDir, MNIST_FILES.testLabels), maxSamples);
    }

    private static _load(imagesPath: string, labelsPath: string, maxSamples?: number): IDataset {
        const imgBuf = readGzipped(imagesPath);
        const lblBuf = readGzipped(labelsPath);

        const { images, rows, cols } = parseIDX3Images(imgBuf);
        const labels = parseIDX1Labels(lblBuf);

        const count = maxSamples ? Math.min(maxSamples, images.length) : images.length;
        const samples: IDatasetSample[] = [];
        for (let i = 0; i < count; i++) {
            samples.push({ label: labels[i], pixels: images[i] });
        }

        return {
            count,
            width: cols,
            height: rows,
            channels: 1,
            format: "CHW",
            samples,
        };
    }
}
