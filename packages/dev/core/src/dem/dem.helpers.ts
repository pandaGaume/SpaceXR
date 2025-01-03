export type ElevationBuffer = Float64Array | Float32Array | Uint32Array | Uint16Array | Uint8Array | Uint8ClampedArray | Int32Array | Int16Array | Int8Array;

export class ElevationHelpers {
    /**
     * Performs cubic interpolation between four values.
     * @param v0 The value at position -1.
     * @param v1 The value at position 0.
     * @param v2 The value at position +1.
     * @param v3 The value at position +2.
     * @param t The interpolation factor (0.0 to 1.0).
     * @returns The interpolated value.
     */
    private static _cubicInterpolate(v0: number, v1: number, v2: number, v3: number, t: number): number {
        return v1 + 0.5 * t * (v2 - v0 + t * (2 * v0 - 5 * v1 + 4 * v2 - v3 + t * (3 * (v1 - v2) + v3 - v0)));
    }

    /**
     * Safely retrieves an elevation value, clamping indices to valid ranges.
     * @param elevations The elevation data as a 1D ElevationBuffer.
     * @param w The width of the elevation grid.
     * @param h The height of the elevation grid.
     * @param xi The x-coordinate to retrieve.
     * @param yi The y-coordinate to retrieve.
     * @returns The elevation value at the clamped (xi, yi).
     */
    private static getSafeElevation(elevations: ElevationBuffer, w: number, h: number, xi: number, yi: number): number {
        const clampedX = Math.min(Math.max(0, xi), w - 1);
        const clampedY = Math.min(Math.max(0, yi), h - 1);
        return elevations[clampedX + clampedY * w];
    }

    /**
     * Computes the elevation at a normalized position using bilinear interpolation.
     * @param elevations The elevation data as a 1D ElevationBuffer.
     * @param w The width of the elevation grid.
     * @param h The height of the elevation grid.
     * @param xNorm Normalized x-coordinate (0.0 to 1.0).
     * @param yNorm Normalized y-coordinate (0.0 to 1.0).
     * @returns The interpolated elevation value.
     */
    public static GetElevationBilinear(elevations: ElevationBuffer, w: number, h: number, xNorm: number, yNorm: number): number {
        const x = xNorm * (w - 1);
        const y = yNorm * (h - 1);

        const x0 = Math.floor(x);
        const y0 = Math.floor(y);
        const x1 = Math.min(x0 + 1, w - 1);
        const y1 = Math.min(y0 + 1, h - 1);

        const q11 = elevations[x0 + y0 * w];
        const q21 = elevations[x1 + y0 * w];
        const q12 = elevations[x0 + y1 * w];
        const q22 = elevations[x1 + y1 * w];

        const dx = x - x0;
        const dy = y - y0;

        const r1 = q11 * (1 - dx) + q21 * dx;
        const r2 = q12 * (1 - dx) + q22 * dx;

        return r1 * (1 - dy) + r2 * dy;
    }

    /**
     * Computes the elevation at a normalized position using cubic interpolation.
     * @param elevations The elevation data as a 1D ElevationBuffer.
     * @param w The width of the elevation grid.
     * @param h The height of the elevation grid.
     * @param xNorm Normalized x-coordinate (0.0 to 1.0).
     * @param yNorm Normalized y-coordinate (0.0 to 1.0).
     * @returns The interpolated elevation value.
     */
    public static GetElevationCubic(elevations: ElevationBuffer, w: number, h: number, xNorm: number, yNorm: number): number {
        const x = xNorm * (w - 1);
        const y = yNorm * (h - 1);

        const x0 = Math.floor(x);
        const y0 = Math.floor(y);

        const dx = x - x0;
        const dy = y - y0;

        // Fetch 4x4 grid of elevations around (x, y)
        const values = [];
        for (let j = -1; j <= 2; j++) {
            const row = [];
            for (let i = -1; i <= 2; i++) {
                row.push(ElevationHelpers.getSafeElevation(elevations, w, h, x0 + i, y0 + j));
            }
            values.push(row);
        }

        // Perform cubic interpolation row by row
        const interpolatedRows = values.map((row) => ElevationHelpers._cubicInterpolate(row[0], row[1], row[2], row[3], dx));

        // Perform cubic interpolation across the resulting column
        return ElevationHelpers._cubicInterpolate(interpolatedRows[0], interpolatedRows[1], interpolatedRows[2], interpolatedRows[3], dy);
    }

    /**
     * Retrieves the last column of the elevation grid.
     * @param elevations The elevation data as a 1D ElevationBuffer.
     * @param w The width of the elevation grid.
     * @param h The height of the elevation grid.
     * @returns A new ElevationBuffer containing the last column values.
     */
    public static GetLastColumn<T extends ElevationBuffer>(elevations: T, w: number, h: number): T {
        // Use the constructor of the array type
        const lastColumn = new (elevations.constructor as { new (length: number): T })(h);
        for (let i = 0, w1 = w - 1; i < h; i++, w1 += w) {
            lastColumn[i] = elevations[w1];
        }
        return lastColumn;
    }

    /**
     * Retrieves the last row of the elevation grid.
     * @param elevations The elevation data as a 1D ElevationBuffer.
     * @param w The width of the elevation grid.
     * @param h The height of the elevation grid.
     * @returns A new ElevationBuffer containing the last row values.
     */
    public static GetLastRow<T extends ElevationBuffer>(elevations: T, w: number, h: number): T {
        const startIndex = (h - 1) * w;
        return new (elevations.constructor as { new (buffer: ArrayBuffer, byteOffset?: number, length?: number): T })(
            elevations.buffer,
            elevations.byteOffset + startIndex * elevations.BYTES_PER_ELEMENT,
            w
        );
    }

    /**
     * Retrieves the first column of the elevation grid.
     * @param elevations The elevation data as a 1D ElevationBuffer.
     * @param w The width of the elevation grid.
     * @param h The height of the elevation grid.
     * @param duplicateFirst Whether to duplicate the last value.
     * @returns A new ElevationBuffer containing the first column values.
     */
    public static GetFirstColumn<T extends ElevationBuffer>(elevations: T, w: number, h: number, duplicateFirst: boolean = false): T {
        // Use the constructor of the array type
        const firstColumn = new (elevations.constructor as { new (length: number): T })(h + (duplicateFirst ? 1 : 0));
        for (let i = 0; i < h; i++) {
            firstColumn[i] = elevations[i * w];
        }
        if (duplicateFirst) {
            firstColumn[h] = firstColumn[h - 1];
        }
        return firstColumn;
    }

    /**
     * Retrieves the first row of the elevation grid.
     * @param elevations The elevation data as a 1D ElevationBuffer.
     * @param w The width of the elevation grid.
     * @returns A new ElevationBuffer containing the first row values.
     */
    public static GetFirstRow<T extends ElevationBuffer>(elevations: T, w: number): T {
        return new (elevations.constructor as { new (buffer: ArrayBuffer, byteOffset?: number, length?: number): T })(elevations.buffer, elevations.byteOffset, w);
    }

    /**
     * Retrieves the elevation value at a specific (x, y) position.
     * @param elevations The elevation data as a 1D ElevationBuffer.
     * @param w The width of the elevation grid.
     * @param h The height of the elevation grid.
     * @param x The x-coordinate.
     * @param y The y-coordinate.
     * @returns A new ElevationBuffer containing the elevation value.
     */
    public static GetElevationAt<T extends ElevationBuffer>(elevations: T, w: number, h: number, x: number, y: number): T {
        if (x < 0 || x >= w || y < 0 || y >= h) {
            throw new Error("Coordinates out of bounds");
        }

        const index = x + y * w;
        const target = new (elevations.constructor as { new (length: number): T })(1);
        target[0] = elevations[index];
        return target;
    }

    /**
     * Retrieves a specific column from the elevation grid.
     * @param elevations The elevation data as a 1D ElevationBuffer.
     * @param w The width of the elevation grid.
     * @param h The height of the elevation grid.
     * @param colIndex The index of the column to retrieve.
     * @returns A new ElevationBuffer containing the column values.
     */
    public static GetColumn<T extends ElevationBuffer>(elevations: ElevationBuffer, w: number, h: number, colIndex: number): ElevationBuffer {
        const column = new (elevations.constructor as { new (length: number): T })(h);
        for (let i = 0; i < h; i++) {
            column[i] = elevations[colIndex + i * w];
        }
        return column;
    }

    /**
     * Retrieves a specific row from the elevation grid.
     * @param elevations The elevation data as a 1D ElevationBuffer.
     * @param w The width of the elevation grid.
     * @param rowIndex The index of the row to retrieve.
     * @returns A new ElevationBuffer containing the row values.
     */
    public static GetRow<T extends ElevationBuffer>(elevations: T, w: number, rowIndex: number): T {
        const startIndex = rowIndex * w;
        const endIndex = startIndex + w;

        if (startIndex < 0 || endIndex > elevations.length) {
            throw new Error("Row index out of bounds");
        }

        return new (elevations.constructor as { new (buffer: ArrayBuffer, byteOffset?: number, length?: number): T })(
            elevations.buffer,
            elevations.byteOffset + startIndex * elevations.BYTES_PER_ELEMENT,
            w
        );
    }

    /**
     * Retrieves a rectangular area from the elevation grid.
     * @param elevations The elevation data as a 1D ElevationBuffer.
     * @param w The width of the elevation grid.
     * @param h The height of the elevation grid.
     * @param startX The starting x-coordinate of the area.
     * @param startY The starting y-coordinate of the area.
     * @param areaWidth The width of the area.
     * @param areaHeight The height of the area.
     * @returns A new ElevationBuffer containing the values in the specified area.
     */
    public static GetArea<T extends ElevationBuffer>(elevations: T, w: number, h: number, startX: number, startY: number, areaWidth: number, areaHeight: number): T {
        if (startX < 0 || startY < 0 || startX + areaWidth > w || startY + areaHeight > h) {
            throw new Error("Specified area is out of bounds.");
        }

        const area = new (elevations.constructor as { new (length: number): T })(areaWidth * areaHeight);

        for (let y = 0; y < areaHeight; y++) {
            const sourceStart = (startY + y) * w + startX;
            const destStart = y * areaWidth;
            area.set(elevations.subarray(sourceStart, sourceStart + areaWidth), destStart);
        }

        return area;
    }

    /**
     * Compares two elevation arrays element by element within a specified epsilon tolerance.
     * @param array1 The first elevation array.
     * @param array2 The second elevation array.
     * @param epsilon The tolerance value for comparison.
     * @returns `true` if all elements are within the epsilon tolerance; otherwise, `false`.
     */
    public static CompareElevations(array1: ElevationBuffer, array2: ElevationBuffer, epsilon: number): boolean {
        if (array1.length !== array2.length) {
            return false;
        }
        for (let i = 0; i < array1.length; i++) {
            if (Math.abs(array1[i] - array2[i]) > epsilon) {
                return false;
            }
        }
        return true;
    }

    /**
     * Computes an array of elevation values along a line between two normalized points.
     * @param elevations The elevation data as a 1D ElevationBuffer.
     * @param w The width of the elevation grid.
     * @param h The height of the elevation grid.
     * @param x1Norm Normalized x-coordinate of the starting point (0.0 to 1.0).
     * @param y1Norm Normalized y-coordinate of the starting point (0.0 to 1.0).
     * @param x2Norm Normalized x-coordinate of the ending point (0.0 to 1.0).
     * @param y2Norm Normalized y-coordinate of the ending point (0.0 to 1.0).
     * @param steps The number of steps to divide the line.
     * @returns A ElevationBuffer containing the elevation values at each step.
     */
    public static GetElevationsBetween<T extends ElevationBuffer>(
        elevations: ElevationBuffer,
        w: number,
        h: number,
        x1Norm: number,
        y1Norm: number,
        x2Norm: number,
        y2Norm: number,
        steps: number
    ): ElevationBuffer {
        const result = new (elevations.constructor as { new (length: number): T })(steps);

        const dxNorm = (x2Norm - x1Norm) / (steps - 1);
        const dyNorm = (y2Norm - y1Norm) / (steps - 1);

        for (let i = 0; i < steps; i++) {
            const xNorm = x1Norm + dxNorm * i;
            const yNorm = y1Norm + dyNorm * i;
            result[i] = ElevationHelpers.GetElevationBilinear(elevations, w, h, xNorm, yNorm);
        }

        return result;
    }

    /**
     * Normalizes the elevation data to a specified range.
     * Each value in the elevation buffer is linearly scaled between `minRange` and `maxRange`.
     *
     * @template T - The type of the ElevationBuffer (e.g., Float32Array, Int16Array).
     * @param elevations - The elevation data as a 1D ElevationBuffer.
     * @param minRange - The minimum value of the normalized range (default is 0).
     * @param maxRange - The maximum value of the normalized range (default is 1).
     * @returns A new ElevationBuffer of the same type, containing normalized elevation values.
     * @throws Will throw an error if all values in the elevation buffer are identical, as normalization is not possible.
     *
     * @example
     * const elevations = new Float32Array([10, 20, 30, 40, 50]);
     *
     * // Normalize to [0, 1]
     * const normalized = ElevationHelpers.Normalize(elevations, 0, 1);
     * console.log(normalized); // Float32Array [ 0, 0.25, 0.5, 0.75, 1 ]
     *
     * // Normalize to [-1, 1]
     * const normalizedToNegative = ElevationHelpers.Normalize(elevations, -1, 1);
     * console.log(normalizedToNegative); // Float32Array [ -1, -0.5, 0, 0.5, 1 ]
     */
    public static Normalize<T extends ElevationBuffer>(elevations: T, minRange: number = 0, maxRange: number = 1): T {
        const minValue = Math.min(...elevations);
        const maxValue = Math.max(...elevations);

        if (minValue === maxValue) {
            throw new Error("Normalization is not possible when all values are identical.");
        }

        const normalized = new (elevations.constructor as { new (length: number): T })(elevations.length);
        const scale = (maxRange - minRange) / (maxValue - minValue);

        for (let i = 0; i < elevations.length; i++) {
            normalized[i] = minRange + (elevations[i] - minValue) * scale;
        }

        return normalized;
    }
}
