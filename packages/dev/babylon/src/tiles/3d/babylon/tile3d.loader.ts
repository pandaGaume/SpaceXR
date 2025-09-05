import * as BABYLON from "@babylonjs/core";

import { IPipelineMessageType, ITargetBlock, SourceBlock } from "core/tiles";
import { IContent, ITile3d } from "../interfaces";
import { EventState } from "core/events";
import { PathUtils } from "core/utils";
import { ITile3dStreamEngine, TileStatus } from "../engine";

/** Augmentation for the engine */
declare module "../interfaces/content" {
    interface IContent {
        container?: BABYLON.AssetContainer;
        isLoadedInScene?: boolean; // flag to let the engine know that the container has been added to the scene.
    }
}

export class Tile3dContentLoader extends SourceBlock<ITile3d> implements ITargetBlock<ITile3d> {
    private static DefaultExtensions = [".gltf", ".glb"];
    private _scene: BABYLON.Scene;
    private _extensions: Array<string>;

    public constructor(scene: BABYLON.Scene, ...extensions: Array<string>) {
        super();
        this._scene = scene;
        this._extensions = extensions.length > 0 ? extensions : Tile3dContentLoader.DefaultExtensions;
    }

    public added(eventData: IPipelineMessageType<ITile3d>, eventState: EventState): void {
        if (eventData) {
            // first forward the event
            this.notifyAdded(eventData, eventState.mask ?? -1, eventState.target, this, eventState.userInfo);

            // the try to load the content -> forward updated event when loaded.
            const pending: Promise<{ tile: ITile3d; content: IContent; container: BABYLON.AssetContainer } | { tile: ITile3d; content: IContent; error: unknown }>[] = [];
            const engine = eventState.currentTarget as ITile3dStreamEngine;
            const resolver = engine?.contentOptions?.uriResolver;

            for (const tile of eventData) {
                if (tile.status == TileStatus.loading || tile.status == TileStatus.ready) {
                    continue;
                }

                const contents = tile.contents ?? [tile.content];
                if (!contents || !contents.length) {
                    continue;
                }

                const toload = contents.filter((c): c is IContent => !!(c && c.uri && PathUtils.EndsWith(c.uri, ...this._extensions)));
                for (const c of toload) {
                    if (c.container) {
                        // container already loaded.
                        continue;
                    }
                    /// Here we need the resolver because we want to avoid exposing the credentials whenever possible.
                    /// The resolver is typically used for credential injection.
                    const targetUri: string = resolver?.resolve(c.uri) ?? c.uri;
                    const { rootUrl, fileName } = PathUtils.SplitRootAndFile(targetUri);
                    const currentTile = tile; // capture
                    const currentContent = c;
                    tile.status = TileStatus.loading;
                    const p = BABYLON.SceneLoader.LoadAssetContainerAsync(rootUrl, fileName, this._scene, undefined)
                        .then((container) => {
                            this._onContainerLoaded(currentTile, currentContent, container);
                            return { tile: currentTile, content: currentContent, container };
                        })
                        .catch((error) => {
                            this._onContainerFailed(currentTile, currentContent, error);
                            return { tile: currentTile, content: currentContent, error };
                        });
                    pending.push(p);
                }
                if (pending.length) {
                    Promise.allSettled(pending).then((settled) => {
                        // normalize results for the global callback
                        const results = settled.map((s) => {
                            if (s.status === "fulfilled") {
                                const v = s.value as { tile: ITile3d; content: IContent; container?: BABYLON.AssetContainer; error?: unknown };
                                if (v.container) {
                                    tile.status = TileStatus.ready;
                                    return { tile: v.tile, content: v.content, status: "fulfilled" as const, value: v.container };
                                } else {
                                    tile.status = TileStatus.error;
                                    return { tile: v.tile, content: v.content, status: "rejected" as const, reason: v.error };
                                }
                            } else {
                                // Should be rare because we catch above, but keep it robust
                                tile.status = TileStatus.error;
                                return { tile: undefined as unknown as ITile3d, content: undefined as unknown as IContent, status: "rejected" as const, reason: s.reason };
                            }
                        });
                        // global “all done” event
                        this._onAllContainersSettled(results);
                    });
                }
            }
        }
    }

    public removed(eventData: IPipelineMessageType<ITile3d>, eventState: EventState): void {
        this.notifyRemoved(eventData, eventState.mask ?? -1, eventState.target, this, eventState.userInfo);
    }

    protected _onContainerLoaded(tile: ITile3d, content: IContent, container: BABYLON.AssetContainer): void {
        content.container = container;
        this.notifyUpdated([tile], -1, this, this);
    }

    protected _onContainerFailed(tile: ITile3d, content: IContent, error: unknown): void {
        // this is where we need to deploy a strategy depending policy.
        console.log(`failed to load ${content.uri} cause of ${error}`);
    }

    protected _onAllContainersSettled(
        results: Array<{ tile: ITile3d; content: IContent; status: "fulfilled" | "rejected"; value?: BABYLON.AssetContainer; reason?: unknown }>
    ): void {}
}
