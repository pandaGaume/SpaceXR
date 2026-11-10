/**
 * Location of the samples of a raster over the tile extent. It belongs to the data, so every source declares it where
 * its data is imported: there is no default.
 *
 * - `area`: each sample covers one pixel, so sample `i` is centred at `(i + 0.5) / size`. This is how web tiles are
 *   published, elevation and imagery alike; two neighbouring tiles never share a sample.
 * - `point`: sample `i` lies at `i / (size - 1)`, so the first and last samples lie on the tile edges, as in the tiles of
 *   the cube index and in stitched rasters.
 */
export type RasterRegistration = "area" | "point";

/**
 * Checks the registration a source declares, for callers the compiler does not reach: a raster read with the wrong one
 * moves half a pixel without any other sign.
 *
 * @throws TypeError When the registration is missing or unknown.
 */
export function assertRasterRegistration(registration: unknown): asserts registration is RasterRegistration {
    if (registration !== "area" && registration !== "point") {
        throw new TypeError(`A source declares its registration, "area" or "point", where its data is imported: got ${String(registration)}.`);
    }
}
