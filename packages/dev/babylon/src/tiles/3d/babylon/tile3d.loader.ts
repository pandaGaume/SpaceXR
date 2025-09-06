import * as BABYLON from "@babylonjs/core";

import { SourceBlock } from "core/tiles";
import { IContent, ITile3d, ITileset } from "../interfaces";

import { PathUtils } from "core/utils";
import { ITile3dContentLoader, IUriResolver, TileContentStatus } from "../engine";
import { ActionQueueStatus, ConcurrentActionQueue, IActionQueueSettledEvent } from "core/collections/concurrentQueue";
import { WebClient } from "core/io";
import { TilesetClient } from "../engine/tile3d.stream.client";
import { Nullable } from "core/types";

/** Augmentation for the engine */
declare module "../interfaces/content" {
    interface IContent {
        container?: BABYLON.AssetContainer | any;
        error?: any;
        isLoadedInScene?: boolean; // flag to let the engine know that the container has been added to the scene.
    }
}

export class Tile3dContentLoader extends SourceBlock<ITile3d> implements ITile3dContentLoader {
    private static DefaultExtensions = [".gltf", ".glb", ".json"];
    private _scene: BABYLON.Scene;
    private _extensions: Array<string>;
    private _resolver?: IUriResolver;
    private _loader: ConcurrentActionQueue<ITile3d, ITile3d>;
    private readonly _tilesetClient: WebClient<string, ITileset>;

    public constructor(scene: BABYLON.Scene, resolver?: IUriResolver, extensions?: Array<string>) {
        super();
        this._scene = scene;
        this._resolver = resolver;
        this._tilesetClient = new TilesetClient("tileSetClient");
        this._extensions = extensions ?? Tile3dContentLoader.DefaultExtensions;
        this._loader = new ConcurrentActionQueue<ITile3d, ITile3d>(this._loadTile3dAsync.bind(this), 4);
        this._resolver = resolver;
    }

    public load(tile: ITile3d): void {
        if (tile.status == TileContentStatus.idle) {
            tile.status = TileContentStatus.pending;
            this._loader.enqueue(tile, { priority: tile.priority, onSettled: this._onSettled.bind(this) });
        }
    }

    public cancel(tile: ITile3d): void {
        if (tile.status == TileContentStatus.pending) {
            this._loader.cancelPending(tile);
            tile.status = TileContentStatus.idle;
        }
    }

    public async loadTileSetAsync(uri: string): Promise<Nullable<ITileset>> {
        /// Here we need the resolver because we want to avoid exposing the credentials whenever possible.
        /// The resolver is typically used for credential injection.
        const resolvedUri: string = this._resolver?.resolve(uri) ?? uri;
        const result = await this._tilesetClient.fetchAsync(resolvedUri);
        return result.content;
    }

    protected async _loadTile3dAsync(tile: ITile3d): Promise<ITile3d> {
        const contents = tile.contents ?? [tile.content];
        const toload = contents.filter((c): c is IContent => !!(c && c.uri && PathUtils.EndsWith(c.uri, ...this._extensions)));
        if (toload.length) {
            for (const c of toload) {
                const currentContent = c;
                tile.status = TileContentStatus.loading;
                if (PathUtils.EndsWith(c.uri, ".json")) {
                    currentContent.container = await this.loadTileSetAsync(c.uri);
                } else {
                    /// Here we need the resolver because we want to avoid exposing the credentials whenever possible.
                    /// The resolver is typically used for credential injection.
                    const resolvedUri: string = this._resolver?.resolve(c.uri) ?? c.uri;
                    const { rootUrl, fileName } = PathUtils.SplitRootAndFile(resolvedUri);
                    currentContent.container = await BABYLON.SceneLoader.LoadAssetContainerAsync(rootUrl, fileName, this._scene, undefined);
                }
            }
        }
        return tile;
    }

    protected _onSettled(e: IActionQueueSettledEvent<ITile3d, ITile3d>): void {
        switch (e.status) {
            case ActionQueueStatus.fulfilled: {
                e.data.status = TileContentStatus.ready;
                this.notifyUpdated([e.data], -1, this, this);
                break;
            }
            case ActionQueueStatus.rejected: {
                e.data.status = TileContentStatus.error;
                this.notifyUpdated([e.data], -1, this, this);
                break;
            }
            case ActionQueueStatus.cancelled: {
                break;
            }
        }
    }
}
