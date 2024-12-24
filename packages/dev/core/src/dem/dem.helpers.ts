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
    private static cubicInterpolate(v0: number, v1: number, v2: number, v3: number, t: number): number {
        return v1 + 0.5 * t * (v2 - v0 + t * (2 * v0 - 5 * v1 + 4 * v2 - v3 + t * (3 * (v1 - v2) + v3 - v0)));
    }

    /**
     * Safely retrieves an elevation value, clamping indices to valid ranges.
     * @param elevations The elevation data as a 1D Float32Array.
     * @param w The width of the elevation grid.
     * @param h The height of the elevation grid.
     * @param xi The x-coordinate to retrieve.
     * @param yi The y-coordinate to retrieve.
     * @returns The elevation value at the clamped (xi, yi).
     */
    private static getSafeElevation(elevations: Float32Array, w: number, h: number, xi: number, yi: number): number {
        const clampedX = Math.min(Math.max(0, xi), w - 1);
        const clampedY = Math.min(Math.max(0, yi), h - 1);
        return elevations[clampedX + clampedY * w];
    }

    /**
     * Computes the elevation at a normalized position using bilinear interpolation.
     * @param elevations The elevation data as a 1D Float32Array.
     * @param w The width of the elevation grid.
     * @param h The height of the elevation grid.
     * @param xNorm Normalized x-coordinate (0.0 to 1.0).
     * @param yNorm Normalized y-coordinate (0.0 to 1.0).
     * @returns The interpolated elevation value.
     */
    public static GetElevationBilinear(elevations: Float32Array, w: number, h: number, xNorm: number, yNorm: number): number {
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
     * @param elevations The elevation data as a 1D Float32Array.
     * @param w The width of the elevation grid.
     * @param h The height of the elevation grid.
     * @param xNorm Normalized x-coordinate (0.0 to 1.0).
     * @param yNorm Normalized y-coordinate (0.0 to 1.0).
     * @returns The interpolated elevation value.
     */
    public static GetElevationCubic(elevations: Float32Array, w: number, h: number, xNorm: number, yNorm: number): number {
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
        const interpolatedRows = values.map((row) => ElevationHelpers.cubicInterpolate(row[0], row[1], row[2], row[3], dx));

        // Perform cubic interpolation across the resulting column
        return ElevationHelpers.cubicInterpolate(interpolatedRows[0], interpolatedRows[1], interpolatedRows[2], interpolatedRows[3], dy);
    }

    /**
     * Retrieves the last column of the elevation grid.
     * @param elevations The elevation data as a 1D Float32Array.
     * @param w The width of the elevation grid.
     * @param h The height of the elevation grid.
     * @returns A new Float32Array containing the last column values.
     */
    public static GetLastColumn(elevations: Float32Array, w: number, h: number): Float32Array {
        const lastColumn = new Float32Array(h);
        for (let i = 0, w1 = w - 1; i < h; i++, w1 += w) {
            lastColumn[i] = elevations[w1];
        }
        return lastColumn;
    }

    /**
     * Retrieves the last row of the elevation grid.
     * @param elevations The elevation data as a 1D Float32Array.
     * @param w The width of the elevation grid.
     * @param h The height of the elevation grid.
     * @returns A new Float32Array containing the last row values.
     */
    public static GetLastRow(elevations: Float32Array, w: number, h: number): Float32Array {
        const startIndex = (h - 1) * w;
        return new Float32Array(elevations.subarray(startIndex, startIndex + w));
    }

    /**
     * Retrieves the first column of the elevation grid.
     * @param elevations The elevation data as a 1D Float32Array.
     * @param w The width of the elevation grid.
     * @param h The height of the elevation grid.
     * @param duplicateFirst Whether to duplicate the last value.
     * @returns A new Float32Array containing the first column values.
     */
    public static GetFirstColumn(elevations: Float32Array, w: number, h: number, duplicateFirst: boolean = false): Float32Array {
        const firstColumn = new Float32Array(h + (duplicateFirst ? 1 : 0));
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
     * @param elevations The elevation data as a 1D Float32Array.
     * @param w The width of the elevation grid.
     * @returns A new Float32Array containing the first row values.
     */
    public static GetFirstRow(elevations: Float32Array, w: number): Float32Array {
        return new Float32Array(elevations.subarray(0, w));
    }

    /**
     * Retrieves the elevation value at a specific (x, y) position.
     * @param elevations The elevation data as a 1D Float32Array.
     * @param w The width of the elevation grid.
     * @param h The height of the elevation grid.
     * @param x The x-coordinate.
     * @param y The y-coordinate.
     * @returns A new Float32Array containing the elevation value.
     */
    public static GetElevationAt(elevations: Float32Array, w: number, h: number, x: number, y: number): Float32Array {
        return new Float32Array([elevations[x + y * w]]);
    }

    /**
     * Retrieves a specific column from the elevation grid.
     * @param elevations The elevation data as a 1D Float32Array.
     * @param w The width of the elevation grid.
     * @param h The height of the elevation grid.
     * @param colIndex The index of the column to retrieve.
     * @returns A new Float32Array containing the column values.
     */
    public static GetColumn(elevations: Float32Array, w: number, h: number, colIndex: number): Float32Array {
        const column = new Float32Array(h);
        for (let i = 0; i < h; i++) {
            column[i] = elevations[colIndex + i * w];
        }
        return column;
    }

    /**
     * Retrieves a specific row from the elevation grid.
     * @param elevations The elevation data as a 1D Float32Array.
     * @param w The width of the elevation grid.
     * @param rowIndex The index of the row to retrieve.
     * @returns A new Float32Array containing the row values.
     */
    public static GetRow(elevations: Float32Array, w: number, rowIndex: number): Float32Array {
        const startIndex = rowIndex * w;
        return new Float32Array(elevations.subarray(startIndex, startIndex + w));
    }

    /**
     * Retrieves a rectangular area from the elevation grid.
     * @param elevations The elevation data as a 1D Float32Array.
     * @param w The width of the elevation grid.
     * @param h The height of the elevation grid.
     * @param startX The starting x-coordinate of the area.
     * @param startY The starting y-coordinate of the area.
     * @param areaWidth The width of the area.
     * @param areaHeight The height of the area.
     * @returns A new Float32Array containing the values in the specified area.
     */
    public static GetArea(elevations: Float32Array, w: number, h: number, startX: number, startY: number, areaWidth: number, areaHeight: number): Float32Array {
        const area = new Float32Array(areaWidth * areaHeight);
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
    public static CompareElevations(array1: Float32Array, array2: Float32Array, epsilon: number): boolean {
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
     * @param elevations The elevation data as a 1D Float32Array.
     * @param w The width of the elevation grid.
     * @param h The height of the elevation grid.
     * @param x1Norm Normalized x-coordinate of the starting point (0.0 to 1.0).
     * @param y1Norm Normalized y-coordinate of the starting point (0.0 to 1.0).
     * @param x2Norm Normalized x-coordinate of the ending point (0.0 to 1.0).
     * @param y2Norm Normalized y-coordinate of the ending point (0.0 to 1.0).
     * @param steps The number of steps to divide the line.
     * @returns A Float32Array containing the elevation values at each step.
     */
    public static GetElevationsBetween(
        elevations: Float32Array,
        w: number,
        h: number,
        x1Norm: number,
        y1Norm: number,
        x2Norm: number,
        y2Norm: number,
        steps: number
    ): Float32Array {
        const result = new Float32Array(steps);
        const dxNorm = (x2Norm - x1Norm) / (steps - 1);
        const dyNorm = (y2Norm - y1Norm) / (steps - 1);

        for (let i = 0; i < steps; i++) {
            const xNorm = x1Norm + dxNorm * i;
            const yNorm = y1Norm + dyNorm * i;
            result[i] = ElevationHelpers.GetElevationBilinear(elevations, w, h, xNorm, yNorm);
        }

        return result;
    }
}
