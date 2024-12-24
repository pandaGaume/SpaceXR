export class ElevationHelpers {
    public static GetLastColumn(elevations: Float32Array, w: number, h: number, duplicateLast: boolean = false): Float32Array {
        const lastColumn = new Float32Array(h + (duplicateLast ? 1 : 0));
        for (let i = 0, w1 = w - 1; i < h; i++, w1 += w) {
            lastColumn[i] = elevations[w1];
        }
        if (duplicateLast) {
            lastColumn[h] = lastColumn[h - 1];
        }
        return lastColumn;
    }

    public static GetLastRow(elevations: Float32Array, w: number, h: number): Float32Array {
        const startIndex = (h - 1) * w;
        const lastRow = elevations.subarray(startIndex, startIndex + w);
        return new Float32Array(lastRow); // Copy to a new array if needed
    }

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

    public static GetFirstRow(elevations: Float32Array, w: number): Float32Array {
        const firstRow = elevations.subarray(0, w);
        return new Float32Array(firstRow); // Copy to a new array if needed
    }

    public static GetElevationAt(elevations: Float32Array, w: number, h: number, x: number, y: number): Float32Array {
        return new Float32Array([elevations[x + y * w]]);
    }
}
