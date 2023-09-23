import { Nullable } from "core/types";
import { ITileMetrics } from "./tiles.interfaces";
import { AbstractTileCruncher } from "./tiles.crunchers";

export class Float32ArrayTileCruncher extends AbstractTileCruncher<Float32Array> {
    private _smoothingEnabled: boolean = false;

    public constructor(metrics: ITileMetrics) {
        super(metrics);
    }

    public get smoothingEnabled(): boolean {
        return this._smoothingEnabled;
    }

    public set smoothingEnabled(value: boolean) {
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
        const section = this._sections[sectionIndex];
        const height = this._metrics.tileSize;
        const width = this._metrics.tileSize;

        const target = new Float32Array(height * height);

        for (let j = 0; j < section.height; j++) {
            const originalY = section.y + j;
            for (let i = 0; i < section.width; i++) {
                const originalX = section.x + i;

                if (this._smoothingEnabled) {
                    // Calculate the coordinates for the upsampled image using non optimized bilinear interpolation
                    const upsampledX = i * 2;
                    const upsampledY = j * 2;
                    const targetIndex = upsampledY * width + upsampledX;

                    // Calculate the coordinates for bilinear interpolation
                    const x1 = originalX;
                    const x2 = x1 + 1;
                    const y1 = originalY * width;
                    const y2 = y1 + width;

                    // Perform bilinear interpolation
                    const q11 = parent[y1 + x1];
                    const q12 = parent[y2 + x1];
                    const q21 = parent[y1 + x2];
                    const q22 = parent[y2 + x2];
                    target[targetIndex] = this._bilinearInterpolation(x1, y1, x2, y2, originalX, originalY, q11, q12, q21, q22);
                    continue;
                }

                const sourceIndex = originalY * width + originalX;
                const value = parent[sourceIndex];
                const targetIndex = j * width * 2 + i * 2;
                target[targetIndex] = value;
                target[targetIndex + 1] = value;
                target[targetIndex + width] = value;
                target[targetIndex + width + 1] = value;
            }
        }

        return null;
    }

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
