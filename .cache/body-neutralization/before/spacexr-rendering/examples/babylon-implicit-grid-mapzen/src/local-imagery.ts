import type { IRasterGrid } from "@spacexr/raster";
import type { ITileAddress, RasterRegistration } from "@spacexr/tiles";

/** Imagery pyramid provided by a module kept out of the repository. */
export interface ILocalImagery {
    /** Loads the raster of a tile, or `undefined` when the tile does not exist. */
    load: (
        address: ITileAddress,
    ) => Promise<IRasterGrid<Uint8Array | Uint8ClampedArray> | undefined>;
    /** Deepest level of the pyramid. */
    maxLOD: number;
    /** Where the pixels of its tiles lie, declared by the source. */
    registration: RasterRegistration;
    /** Text to display with the imagery. */
    attribution?: string;
}

interface ILocalImageryModule {
    createImagery: () => ILocalImagery;
}

// Optional modules in src/local/, ignored by git: the build succeeds without them.
const modules = import.meta.glob<ILocalImageryModule>("./local/*.imagery.ts");

/**
 * Loads the imagery named by the `imagery` URL parameter from `src/local/<name>.imagery.ts`, a module exporting
 * `createImagery()`. Such modules stay on the developer machine, for sources that cannot be published.
 */
export async function loadLocalImagery(name: string): Promise<ILocalImagery> {
    const module = modules[`./local/${name}.imagery.ts`];
    if (!module)
        throw new Error(
            `imagery=${name} requires src/local/${name}.imagery.ts, which is not in the repository.`,
        );
    return (await module()).createImagery();
}
