import {
    ICameraFetchEngine,
    ICameraFetchEngineOptions,
    IMap3dObjectNode,
    IMap3dObjectNodeRef,
    Map3dObjectNodeRefType,
    Map3dObjectRefineType,
    ScreenSpaceError,
} from "./map.object.interfaces";
import { SourceBlock } from "core/tiles/pipeline/tiles.pipeline.sourceblock";
import { ICameraState, ITargetBlock } from "core/tiles";
import { Cartesian3, ISize2 } from "core/geometry";
import { EventState } from "core/events";

export class CameraFetchEngine extends SourceBlock<IMap3dObjectNodeRef<Map3dObjectNodeRefType>> implements ITargetBlock<IMap3dObjectNode>, ICameraFetchEngine {
    // Default options
    private static DEFAULT_MAX_SCREEN_SPACE_ERROR = 16;
    private static DEFAULT_HYSTERESIS_PERCENT = 0.1;
    private static readonly DEFAULT_OPTIONS: ICameraFetchEngineOptions = {
        maxScreenSpaceError: CameraFetchEngine.DEFAULT_MAX_SCREEN_SPACE_ERROR,
        hysteresisPercent: CameraFetchEngine.DEFAULT_HYSTERESIS_PERCENT,
    };

    _activeNodes: Map<Map3dObjectNodeRefType, IMap3dObjectNode>;
    _options: ICameraFetchEngineOptions;

    public constructor(options: ICameraFetchEngineOptions) {
        super();
        // Merge: passed `options` overwrite the defaults
        this._options = {
            ...CameraFetchEngine.DEFAULT_OPTIONS,
            ...options,
        };
        this._activeNodes = new Map();
    }

    public onCameraStateChange(camState: ICameraState, displaySize: ISize2): void {
        const frustumPlanes = camState.getFrustumPlanes();
        const toAdd: Array<IMap3dObjectNodeRef<Map3dObjectNodeRefType>> = [];
        const toRemove: Array<IMap3dObjectNodeRef<Map3dObjectNodeRefType>> = [];
        let offset: number | undefined = undefined;

        for (var n of this._activeNodes.values()) {
            var bounds = n.getBoundingInfo ? n.getBoundingInfo() : null;
            if (bounds == null) {
                continue;
            }
            if (!bounds.isInFrustum(frustumPlanes)) {
                continue;
            }
            if (n.geometricError === undefined) {
                continue;
            }
            const fn = n.screenSpaceError ?? ScreenSpaceError;
            const distanceToCamera = Cartesian3.Distance(bounds.boundingSphere.center, camState.position);
            const sse = fn(n.geometricError, distanceToCamera, displaySize.height, camState.tanfov2);

            if (sse > this._options.maxScreenSpaceError) {
                // refine.
                if (n.refinements && n.refinements.length) {
                    toAdd.push(...n.refinements);
                    if (n.refine == Map3dObjectRefineType.replace) {
                        toRemove.push(n);
                    }
                }
            } else {
                offset =
                    offset ??
                    this._options.hysteresisOffset ??
                    this._options.maxScreenSpaceError * (this._options.hysteresisPercent ?? CameraFetchEngine.DEFAULT_HYSTERESIS_PERCENT);
                if (sse < this._options.maxScreenSpaceError - offset) {
                    // coarse
                    toRemove.push(n);
                    if (n.refinedFrom) {
                        if (!this._activeNodes.has(n.refinedFrom.address)) {
                            // only push is not already active (case of additive refinement)
                            toAdd.push(n.refinedFrom);
                        }
                    }
                }
            }
        }

        const singleRemove = Array.from(new Set(toRemove));
        if (singleRemove.length && this._removedObservable?.hasObservers()) {
            this._removedObservable.notifyObservers(singleRemove, -1, this, this);
        }

        const singleAdd = Array.from(new Set(toAdd));
        if (singleAdd.length && this._addedObservable?.hasObservers()) {
            this._addedObservable.notifyObservers(singleAdd, -1, this, this);
        }
    }

    // #region Target<IMap3dObjectNode>
    public added(eventData: Array<IMap3dObjectNode>, eventState: EventState): void {
        for (const n of eventData) {
            this._activeNodes.set(n.address, n);
        }
    }

    public removed(eventData: Array<IMap3dObjectNode>, eventState: EventState): void {
        for (const n of eventData) {
            this._activeNodes.delete(n.address);
        }
    }
    // #endregion
}
