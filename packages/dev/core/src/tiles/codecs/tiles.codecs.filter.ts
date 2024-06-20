import { IFilter } from "./tiles.codecs.interfaces";

export class MedianFilter implements IFilter<Float32Array> {
    public static Shared = new MedianFilter();

    constructor(private _windowSize: number = 5, private _threshold: number = 50) {
        if (_windowSize % 2 === 0) {
            throw new Error("Window size must be odd.");
        }
    }

    public apply(values: Float32Array, x: number, y: number, width: number, height: number): Float32Array {
        const edge = Math.floor(this._windowSize / 2);
        const result = new Float32Array(values.length);
        values.copyWithin(0, 0); // Copy original values to result to maintain untouched values

        for (let i = 0; i < height; i++) {
            for (let j = 0; j < width; j++) {
                const window: number[] = [];
                // Dynamically adjust window edges based on pixel position
                for (let wi = Math.max(-edge, -i); wi <= Math.min(edge, height - 1 - i); wi++) {
                    for (let wj = Math.max(-edge, -j); wj <= Math.min(edge, width - 1 - j); wj++) {
                        const index = (i + wi) * width + (j + wj);
                        window.push(values[index]);
                    }
                }
                window.sort((a, b) => a - b);
                const median = window[Math.floor(window.length / 2)];
                const currentIndex = i * width + j;
                const currentValue = values[currentIndex];
                // Replace the current value only if it deviates from the median by more than the threshold
                if (Math.abs(currentValue - median) > this._threshold) {
                    result[currentIndex] = median;
                } else {
                    result[currentIndex] = currentValue;
                }
            }
        }

        return result;
    }
}
