import type {
    ITileActivationAdapter,
    ITileActivationContext,
    ITilePresentationAdapter,
    ITilePresentationContext,
} from "@spacexr/3d-tiles-runtime";
import type { ITileAddress } from "@spacexr/tiles";

import type { BabylonRasterPages, IBabylonRasterPage } from "./raster-pages";

export interface IBabylonRasterTileAdapterOptions<TSpatial> {
    /** Address of a runtime tile in the raster pyramid, read for example from its metadata. */
    addressOf: (context: ITileActivationContext<TSpatial, IBabylonRasterPage, never>) => ITileAddress;
}

/**
 * Runtime adapter of an imagery tree: activating a tile loads its page, releasing it frees the page.
 *
 * Pages stay resident while the runtime keeps their content, including hidden tiles, so that bindings can fall back
 * to coarser pages while finer ones load. The adapter draws nothing: draping engines bind the resident pages to the
 * tiles they render.
 */
export class BabylonRasterTileAdapter<TSpatial>
    implements ITileActivationAdapter<TSpatial, IBabylonRasterPage, never>, ITilePresentationAdapter<TSpatial, IBabylonRasterPage, never>
{
    public constructor(
        private readonly pages: BabylonRasterPages,
        private readonly options: IBabylonRasterTileAdapterOptions<TSpatial>,
    ) {}

    public async activate(context: ITileActivationContext<TSpatial, IBabylonRasterPage, never>): Promise<void> {
        for (const content of context.pendingContents) {
            if (context.signal.aborted) {
                await context.readiness.cancelled(content.id);
                continue;
            }
            try {
                const page = await this.pages.load(this.options.addressOf(context));
                if (!page) {
                    await context.readiness.failed(content.id, new Error("The raster pyramid has no page for this tile."));
                    continue;
                }
                const accepted = await context.readiness.ready(content.id, {
                    kind: "renderable",
                    handle: page,
                    cacheKey: content.uri,
                    cost: {
                        cpuBytes: 0,
                        gpuBytes: this.pages.size * this.pages.size * 4,
                        networkBytes: 0,
                    },
                });
                if (!accepted) this.pages.release(page.address);
            } catch (error) {
                if (context.signal.aborted) await context.readiness.cancelled(content.id);
                else await context.readiness.failed(content.id, error);
            }
        }
    }

    public deactivate(): void {
        // Pages stay resident until their content is released.
    }

    /** Presented tiles form the imagery cut, which sets how deep draping engines bind pages. */
    public present(context: ITilePresentationContext<TSpatial, IBabylonRasterPage, never>): void {
        for (const resource of context.resources) this.pages.present(resource.handle.address);
    }

    /** Hidden pages leave the cut but remain resident, as fallbacks. */
    public hide(context: ITilePresentationContext<TSpatial, IBabylonRasterPage, never>): void {
        for (const resource of context.resources) this.pages.hide(resource.handle.address);
    }

    public release(context: ITilePresentationContext<TSpatial, IBabylonRasterPage, never>): void {
        for (const resource of context.resources) this.pages.release(resource.handle.address);
    }
}
