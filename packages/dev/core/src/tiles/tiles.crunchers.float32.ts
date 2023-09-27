import { Nullable } from "core/types";
import { ITileMetrics } from "./tiles.interfaces";
import { AbstractTileCruncher } from "./tiles.crunchers";

export class Float32ArrayTileCruncher extends AbstractTileCruncher<Float32Array> {
    private _smoothingEnabled: boolean = false;

    public constructor(metrics: ITileMetrics) {
        super(metrics);
    }

    public get SmoothingEnabled(): boolean {
        return this._smoothingEnabled;
    }

    public set SmoothingEnabled(value: boolean) {
        this._smoothingEnabled = value;
    }

    public Downsampling(childs: Float32Array[]): Nullable<Float32Array> {
        const target = new Float32Array(this._metrics.tileSize * this._metrics.tileSize);
        // loop over each child and copy the pixels to the target
        for (let i = 0; i != 4; i++) {
            const source = childs[i];
            const section = this._sections[i];

            // loop over the pixels of the section
            for (let y = 0; y < section.height; y++) {
                const targetOffset = (y + section.y) * section.width + section.x;
                for (let x = 0; x < section.width; x++) {
                    // we compute the average of the sources pixels
                    let sum = 0;
                    let count = 0;
                    for (let j = 0; j < 2; j++) {
                        const sourceY = y * 2 + j;
                        if (sourceY >= this._metrics.tileSize) break;
                        const sourceOffset = sourceY * this._metrics.tileSize;
                        for (let k = 0; k < 2; i++) {
                            const sourceX = x * 2 + k;
                            if (sourceX >= this._metrics.tileSize) break;
                            const sourceIndex = sourceOffset + sourceX;
                            sum += source[sourceIndex];
                            count++;
                        }
                    }
                    const average = sum / count;
                    // then we copy the average to the target
                    const targetIndex = targetOffset + x;
                    target[targetIndex] = average;
                }
            }
        }
        return null;
    }

    public Upsampling(parent: Float32Array, sectionIndex: number): Nullable<Float32Array> {
        if (this._smoothingEnabled) {
            return this._upsamplingBilinear(parent, sectionIndex);
        }
        return this._upsampling(parent, sectionIndex);
    }

    private _upsampling(parent: Float32Array, sectionIndex: number): Nullable<Float32Array> {
        const section = this._sections[sectionIndex];
        const w = this._metrics.tileSize;
        const target = new Float32Array(w * w);

        for (let j = 0; j < section.height; j++) {
            const originalY = section.y + j;
            for (let i = 0; i < section.width; i++) {
                const originalX = section.x + i;
                const sourceIndex = originalY * w + originalX;
                const value = parent[sourceIndex];
                const targetIndex = j * w * 2 + i * 2;
                target[targetIndex] = value;
                target[targetIndex + 1] = value;
                target[targetIndex + w] = value;
                target[targetIndex + w + 1] = value;
            }
        }
        return target;
    }

    private _upsamplingBilinear(parent: Float32Array, sectionIndex: number): Nullable<Float32Array> {
        const section = this._sections[sectionIndex];
        const w = this._metrics.tileSize;
        const target = new Float32Array(w * w);

        for (let j = 0; j < section.height; j++) {
            const originalY = section.y + j;
            for (let i = 0; i < section.width; i++) {
                const originalX = section.x + i;
                // Calculate the coordinates for the upsampled image using non optimized bilinear interpolation
                const upsampledX = i * 2;
                const upsampledY = j * 2;
                const targetIndex = upsampledY * w + upsampledX;

                // Calculate the coordinates for bilinear interpolation
                const x1 = originalX;
                const x2 = x1 + 1;
                const y1 = originalY * w;
                const y2 = y1 + w;

                // Perform bilinear interpolation
                const q11 = parent[y1 + x1];
                const q12 = parent[y2 + x1];
                const q21 = parent[y1 + x2];
                const q22 = parent[y2 + x2];
                target[targetIndex] = this._bilinearInterpolation(x1, y1, x2, y2, originalX, originalY, q11, q12, q21, q22);
            }
        }

        return target;
    }

    /**
     * Performs bilinear interpolation between four values
     * @param x1 The x coordinate of the first value
     * @param y1 The y coordinate of the first value
     * @param x2 The x coordinate of the second value
     * @param y2 The y coordinate of the second value
     * @param x The x coordinate of the value to interpolate
     * @param y The y coordinate of the value to interpolate
     * @param q11 The value at (x1, y1)
     * @param q12 The value at (x1, y2)
     * @param q21 The value at (x2, y1)
     * @param q22 The value at (x2, y2)
     * @returns The interpolated value
     */

    private _bilinearInterpolation(x1: number, y1: number, x2: number, y2: number, x: number, y: number, q11: number, q12: number, q21: number, q22: number): number {
        const dx1 = x2 - x1;
        const dy1 = y2 - y1;
        const dx2 = x - x1;
        const dy2 = y - y1;

        const crossProduct = dx1 * dy2 - dx2 * dy1;

        const weight1 = (dx1 * dy2 - dx2 * dy1) / crossProduct;
        const weight2 = (dx2 * dy1 - dx1 * dy2) / crossProduct;
        const weight3 = (dx2 * dy2) / crossProduct;
        const weight4 = (dx1 * dy1) / crossProduct;

        return q11 * weight1 + q21 * weight2 + q12 * weight3 + q22 * weight4;
    }
}
