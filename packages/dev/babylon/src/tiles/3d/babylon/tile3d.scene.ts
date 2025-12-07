import * as BABYLON from "@babylonjs/core";

import { ITargetBlock, IPipelineMessageType } from "core/tiles";
import { EventState } from "core/events";

import { GetTile3dContents, ITile3d } from "../interfaces";

export class Tile3dScene extends BABYLON.TransformNode implements ITargetBlock<ITile3d> {
    public constructor(name: string, scene: BABYLON.Scene) {
        super(name, scene);
    }

    public getClassName(): string {
        return "Tile3dScene";
    }

    public added(eventData: IPipelineMessageType<ITile3d>, eventState: EventState): void {
        if (eventData && eventData.length) {
            for (const t of eventData) {
                if (t) {
                    this._addAllToScene(t);
                }
            }
        }
    }

    public removed(eventData: IPipelineMessageType<ITile3d>, eventState: EventState): void {
        if (eventData && eventData.length) {
            for (const t of eventData) {
                if (t) {
                    this._removeAllFromScene(t);
                }
            }
        }
    }

    public updated(eventData: IPipelineMessageType<ITile3d>, eventState: EventState): void {
        if (eventData && eventData.length) {
            for (const t of eventData) {
                if (t) {
                    this._updateContents(t);
                }
            }
        }
    }

    protected _updateContents(tile: ITile3d): void {
        if (tile.visible) {
            this._addAllToScene(tile);
        } else {
            this._removeAllFromScene(tile);
        }
    }

    protected _addAllToScene(tile: ITile3d): void {
        const contents = GetTile3dContents(tile);
        if (contents) {
            for (const c of contents) {
                const container = c?.container;
                if (container && container instanceof BABYLON.AssetContainer) {
                    const l = c.loadedInSceneCount ?? 0;
                    try {
                        if (l == 0) {
                            this._initializeContainer(tile, container);
                        }
                        // there is an internal flag it check if the container is already added to the scene.
                        container.addAllToScene();
                    } finally {
                        c.loadedInSceneCount = l + 1;
                    }
                }
            }
        }
    }

    protected _initializeContainer(tile: ITile3d, container: BABYLON.AssetContainer): void {
        for (const m of container.getNodes().filter((n) => n.parent == null)) {
            m.name = `tile ${tile.depth}`;
        }

        for (const mat of container.materials) {
            // this is a trick to keep precision into the z-buffer along large dimension.
            // instead of that, we might want to scale the scene at reasonable size...
            mat.useLogarithmicDepth = true;
            //mat.wireframe = true;
        }
    }
    protected _removeAllFromScene(tile: ITile3d): void {
        const contents = GetTile3dContents(tile);
        if (contents) {
            for (const c of contents) {
                const container = c?.container;
                if (container && container instanceof BABYLON.AssetContainer) {
                    container.removeAllFromScene();
                }
            }
        }
    }
}
