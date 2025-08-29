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
                    this._addContents(t);
                }
            }
        }
    }

    public removed(eventData: IPipelineMessageType<ITile3d>, eventState: EventState): void {
        if (eventData && eventData.length) {
            for (const t of eventData) {
                if (t) {
                    this._removeContents(t);
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
        this._addContents(tile);
    }

    protected _addContents(tile: ITile3d): void {
        const contents = GetTile3dContents(tile);
        if (contents) {
            for (const c of contents) {
                const container = c?.container;
                if (container) {
                    if (c.isLoadedInScene) {
                        continue;
                    }
                    try {
                        for (const m of container.rootNodes) {
                            m.parent = this;
                        }
                        container.addAllToScene();
                    } finally {
                        c.isLoadedInScene = true;
                    }
                }
            }
        }
    }

    protected _removeContents(tile: ITile3d): void {
        const contents = GetTile3dContents(tile);
        if (contents) {
            for (const c of contents) {
                const container = c?.container;
                if (container) {
                    if (!c.isLoadedInScene) {
                        continue;
                    }
                    try {
                        for (const m of container.rootNodes) {
                            m.parent = null;
                        }
                        container.removeAllFromScene();
                    } finally {
                        c.isLoadedInScene = false;
                    }
                }
            }
        }
    }
}
