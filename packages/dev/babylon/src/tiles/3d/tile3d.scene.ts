import * as BABYLON from "@babylonjs/core";

import { ITargetBlock, IPipelineMessageType } from "core/tiles";
import { EventState } from "core/events";

import { GetTile3dContents, ITile3d } from "core/tiles/3d/interfaces";
import { IDENTITY44, Mat44MultToRef, Mat44Type } from "core/tiles/3d/interfaces/math/math";

/** Scene-side augmentation: per-content anchor node carrying the ECEF placement. */
declare module "core/tiles/3d/interfaces/content" {
    interface IContent {
        anchorNode?: BABYLON.TransformNode;
    }
}

/**
 * glTF content is y-up; tile space is z-up ECEF. The 3D Tiles specification
 * mandates rotating glTF content by +90 deg about X: (x, y, z) -> (x, -z, y).
 * Column-major storage.
 */
const Y_UP_TO_Z_UP: Mat44Type = new Float64Array([1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1]);

/**
 * Renders the active cut of a 3D Tiles stream: adds / removes loaded
 * AssetContainers and places each one at its ECEF position.
 *
 * PLACEMENT. The scene embeds RAW ECEF: Babylon world coordinates are ECEF
 * meters (planet centre at origin), matching GeodeticCamera. Each content's
 * root nodes are parented under a per-content anchor whose transform is
 *
 *     anchor = worldTransform * Y_UP_TO_Z_UP * rootFix^-1
 *
 * where `rootFix` is whatever transform the Babylon glTF importer put on the
 * container's root node (handedness / forward-axis compensation): cancelling
 * it makes the placement exact regardless of importer conventions. Correct
 * triangle winding requires `scene.useRightHandedSystem = true` (the importer
 * compensates left-handed scenes with a negative-determinant root transform
 * plus material side-orientation overrides, which anchoring would undo).
 *
 * GATING. A tile is presented only when its content is loaded AND its
 * `renderable` gate is open (the engine keeps the gate closed while a REPLACE
 * sibling set is still loading, making refinement hole-free and atomic).
 */
export class Tile3dScene extends BABYLON.TransformNode implements ITargetBlock<ITile3d> {
    public constructor(name: string, scene: BABYLON.Scene) {
        super(name, scene);
    }

    public getClassName(): string {
        return "Tile3dScene";
    }

    public added(eventData: IPipelineMessageType<ITile3d>, _eventState: EventState): void {
        if (eventData && eventData.length) {
            for (const t of eventData) {
                if (t) {
                    this._updateContents(t);
                }
            }
        }
    }

    public removed(eventData: IPipelineMessageType<ITile3d>, _eventState: EventState): void {
        if (eventData && eventData.length) {
            for (const t of eventData) {
                if (t) {
                    this._removeAllFromScene(t);
                }
            }
        }
    }

    public updated(eventData: IPipelineMessageType<ITile3d>, _eventState: EventState): void {
        if (eventData && eventData.length) {
            for (const t of eventData) {
                if (t) {
                    this._updateContents(t);
                }
            }
        }
    }

    protected _updateContents(tile: ITile3d): void {
        // `visible` is set by the deprecated engine, `renderable` by the
        // stream source; both default to presentable when undefined.
        if (tile.visible === false || tile.renderable === false) {
            this._removeAllFromScene(tile);
        } else {
            this._addAllToScene(tile);
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
                        if (l === 0) {
                            this._initializeContainer(tile, container);
                        }
                        // AssetContainer.addAllToScene validates that no node
                        // has a parent outside the container, so the roots must
                        // hang free while it runs; anchoring happens right after.
                        this._detachRoots(container);
                        container.addAllToScene();
                        this._anchorContainer(tile, c, container);
                    } finally {
                        c.loadedInSceneCount = l + 1;
                    }
                }
            }
        }
    }

    /** Unparents the container's root nodes so its hierarchy is self-contained. */
    protected _detachRoots(container: BABYLON.AssetContainer): void {
        for (const n of container.rootNodes) {
            if (n instanceof BABYLON.TransformNode && n.parent) {
                n.parent = null;
            }
        }
    }

    protected _initializeContainer(tile: ITile3d, container: BABYLON.AssetContainer): void {
        for (const m of container.getNodes().filter((n) => n.parent === null)) {
            m.name = `tile ${tile.depth}`;
        }

        for (const mat of container.materials) {
            // this is a trick to keep precision into the z-buffer along large dimension.
            // instead of that, we might want to scale the scene at reasonable size...
            mat.useLogarithmicDepth = true;
            //mat.wireframe = true;
        }
    }

    /**
     * Parents the container's root nodes under a per-content anchor that
     * carries the tile's ECEF placement (see class doc for the derivation).
     */
    protected _anchorContainer(tile: ITile3d, content: { anchorNode?: BABYLON.TransformNode }, container: BABYLON.AssetContainer): void {
        const roots = container.rootNodes.filter((n): n is BABYLON.TransformNode => n instanceof BABYLON.TransformNode);
        if (!roots.length) return;

        // The placement is computed once, from the roots' pristine (detached)
        // world matrix. Later adds only re-parent, since by then the roots'
        // world matrix already includes the anchor.
        let anchor = content.anchorNode;
        if (!anchor) {
            // M = worldTransform * Y_UP_TO_Z_UP (Float64 all the way).
            const m = new Float64Array(16);
            Mat44MultToRef(tile.worldTransform ?? IDENTITY44, Y_UP_TO_Z_UP, m);

            // Cancel the importer's root compensation (single __root__ for glTF;
            // when several roots exist the first one's transform is used for all).
            const first = roots[0];
            first.computeWorldMatrix(true);
            const fixInv = first.getWorldMatrix().clone();
            fixInv.invert();

            const p = new Float64Array(16);
            Mat44MultToRef(m, fixInv.m as unknown as Mat44Type, p);

            anchor = new BABYLON.TransformNode(`anchor ${tile.uid ?? tile.depth}`, this.getScene());
            content.anchorNode = anchor;

            // Keep the ECEF-magnitude translation in float64 by assigning it
            // straight to position; decompose only rotation + scale.
            const rotationScale = BABYLON.Matrix.FromArray(p);
            rotationScale.setTranslationFromFloats(0, 0, 0);
            const scaling = new BABYLON.Vector3();
            const rotation = new BABYLON.Quaternion();
            rotationScale.decompose(scaling, rotation, undefined);
            anchor.scaling = scaling;
            anchor.rotationQuaternion = rotation;
            anchor.position.set(p[12], p[13], p[14]);
        }
        anchor.parent = this;

        for (const root of roots) {
            root.parent = anchor;
        }
    }

    protected _removeAllFromScene(tile: ITile3d): void {
        const contents = GetTile3dContents(tile);
        if (contents) {
            for (const c of contents) {
                const container = c?.container;
                if (container && container instanceof BABYLON.AssetContainer) {
                    // Detach first for the same hierarchy-validation reason as
                    // the add path.
                    this._detachRoots(container);
                    container.removeAllFromScene();
                }
            }
        }
    }
}
