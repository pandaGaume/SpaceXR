import * as BABYLON from "@babylonjs/core";

import { SourceBlock } from "core/tiles";
import { ITile3d, ITileset } from "core/tiles/3d/interfaces";
import { ITile3dContentLoader, TileContentStatus } from "core/tiles/3d/engine";
import { Nullable } from "core/types";

/** Scene-side augmentation: the decoded imagery texture for a tile content. */
declare module "core/tiles/3d/interfaces/content" {
    interface IContent {
        texture?: BABYLON.Texture;
    }
}

/**
 * Minimal ITile3dContentLoader for the implicit-surface test: fetches each
 * tile's imagery raster as a Babylon texture and flips the tile to `ready`
 * (which opens the REPLACE gate so the traversal descends).
 *
 * It is the raster counterpart of Tile3dContentLoader (glTF): same lifecycle
 * (idle -> loading -> ready/error, cancel, notifyUpdated), no mesh loading.
 * `loadTileSetAsync` is unused (implicit tilesets carry no external documents).
 */
export class EllipsoidImageryTileLoader extends SourceBlock<ITile3d> implements ITile3dContentLoader {
    private readonly _scene: BABYLON.Scene;

    public constructor(scene: BABYLON.Scene) {
        super();
        this._scene = scene;
    }

    public load(tile: ITile3d): void {
        if (tile.contentStatus !== TileContentStatus.idle) return;
        const content = (tile.contents ?? []).find((c) => !!c.uri);
        if (!content) {
            tile.contentStatus = TileContentStatus.error;
            this.notifyUpdated([tile], -1, this, this);
            return;
        }
        tile.contentStatus = TileContentStatus.loading;
        const texture = new BABYLON.Texture(
            content.uri,
            this._scene,
            true, // no mipmap: one tile == one screen patch
            true, // invertY: slippy tiles are top-left origin
            BABYLON.Texture.BILINEAR_SAMPLINGMODE,
            () => {
                content.texture = texture;
                // Guard against a settle that cancelled us mid-flight.
                if (tile.contentStatus === TileContentStatus.loading) {
                    tile.contentStatus = TileContentStatus.ready;
                    this.notifyUpdated([tile], -1, this, this);
                }
            },
            () => {
                texture.dispose();
                if (tile.contentStatus === TileContentStatus.loading) {
                    tile.contentStatus = TileContentStatus.error;
                    this.notifyUpdated([tile], -1, this, this);
                }
            }
        );
        texture.wrapU = BABYLON.Texture.CLAMP_ADDRESSMODE;
        texture.wrapV = BABYLON.Texture.CLAMP_ADDRESSMODE;
    }

    /**
     * Called by the binding when a tile leaves the cut. Evicts the tile's
     * imagery: disposes the GPU texture and resets the content to `idle` so a
     * later re-entry reloads cleanly (the HTTP layer usually serves it from
     * cache). Without eviction the textures of every tile ever visited would
     * accumulate on the GPU and navigation would slow down over time.
     */
    public cancel(tile: ITile3d): void {
        for (const c of tile.contents ?? []) {
            if (c.texture) {
                c.texture.dispose();
                c.texture = undefined;
            }
        }
        tile.contentStatus = TileContentStatus.idle;
    }

    public loadTileSetAsync(_uri: string): Promise<Nullable<ITileset>> {
        return Promise.resolve(null);
    }
}
