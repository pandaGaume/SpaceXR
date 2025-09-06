import * as BABYLON from "@babylonjs/core";

import { IPipelineMessageType, ITargetBlock, SourceBlock } from "core/tiles";
import { IContent, ITile3d } from "../interfaces";
import { EventState } from "core/events";
import { PathUtils } from "core/utils";
import { IUriResolver, TileContentStatus } from "../engine";
import { ActionQueueStatus, ConcurrentActionQueue, IActionQueueSettledEvent } from "core/collections/concurrentQueue";

/** Augmentation for the engine */
declare module "../interfaces/content" {
    interface IContent {
        container?: BABYLON.AssetContainer;
        error?: any;
        isLoadedInScene?: boolean; // flag to let the engine know that the container has been added to the scene.
    }
}

export class Tile3dContentLoader extends SourceBlock<ITile3d> implements ITargetBlock<ITile3d> {
    private static DefaultExtensions = [".gltf", ".glb"];
    private _scene: BABYLON.Scene;
    private _extensions: Array<string>;
    private _resolver?: IUriResolver;
    private _loader: ConcurrentActionQueue<ITile3d, ITile3d>;

    public constructor(scene: BABYLON.Scene, resolver?: IUriResolver, extensions?: Array<string>) {
        super();
        this._scene = scene;
        this._resolver = resolver;
        this._extensions = extensions ?? Tile3dContentLoader.DefaultExtensions;
        this._loader = new ConcurrentActionQueue<ITile3d, ITile3d>(this._loadTile3dAsync.bind(this), 4);
        this._resolver = resolver;
    }

    protected async _loadTile3dAsync(tile: ITile3d, signal: AbortSignal): Promise<ITile3d> {
        const contents = tile.contents ?? [tile.content];
        const toload = contents.filter((c): c is IContent => !!(c && c.uri && PathUtils.EndsWith(c.uri, ...this._extensions)));
        if (toload.length) {
            for (const c of toload) {
                /// Here we need the resolver because we want to avoid exposing the credentials whenever possible.
                /// The resolver is typically used for credential injection.
                const targetUri: string = this._resolver?.resolve(c.uri) ?? c.uri;
                const { rootUrl, fileName } = PathUtils.SplitRootAndFile(targetUri);
                const currentContent = c;
                tile.status = TileContentStatus.loading;
                currentContent.container = await BABYLON.SceneLoader.LoadAssetContainerAsync(rootUrl, fileName, this._scene, undefined);
            }
        }
        return tile;
    }

    public added(eventData: IPipelineMessageType<ITile3d>, eventState: EventState): void {
        if (eventData) {
            // first forward the event
            this.notifyAdded(eventData, eventState.mask ?? -1, eventState.target, this, eventState.userInfo);
            for (const tile of eventData) {
                if (tile.status == TileContentStatus.idle && !tile.hasExternal) {
                    tile.status = TileContentStatus.pending;
                    this._loader.enqueue(tile, { priority: tile.priority, onSettled: this._onSettled.bind(this) });
                }
            }
        }
    }

    public removed(eventData: IPipelineMessageType<ITile3d>, eventState: EventState): void {
        const toForward = [];
        for (const tile of eventData) {
            if (tile.status == TileContentStatus.pending) {
                this._loader.cancelPending(tile);
                tile.status = TileContentStatus.idle;
                continue;
            }
            toForward.push(tile);
        }
        this.notifyRemoved(toForward, -1, this, this);
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
                break;
            }
            case ActionQueueStatus.cancelled: {
                break;
            }
        }
    }
}
