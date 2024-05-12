import { AbstractMesh, Effect, MaterialDefines, PushMaterial, Scene, SubMesh } from "@babylonjs/core";
import { EventState } from "core/events";
import { IPipelineMessageType, ITargetBlock, ITile } from "core/tiles";
import { Range } from "core/math";
import { ClipIndex, ClipPlaneDefinition } from "./materials.clipPlane";
import { Map3dTileContentType } from "../map";
export declare class Map3dMaterialDefines extends MaterialDefines {
    constructor();
}
export declare class Map3dMaterial extends PushMaterial implements ITargetBlock<ITile<Map3dTileContentType>> {
    static ElevationKind: string;
    static NormalKind: string;
    static LayerKind: string;
    private _elevationSampler;
    private _normalSampler;
    private _layerSampler;
    private _elevationOffset;
    private _elevationRange;
    private _clipPlanes;
    constructor(name: string, scene: Scene);
    addClipPlane(...clipPlanes: ClipPlaneDefinition[]): void;
    removeClipPlane(...indices: ClipIndex[]): void;
    get elevationRange(): Range;
    get elevationOffset(): number;
    set elevationOffset(value: number);
    isReadyForSubMesh(mesh: AbstractMesh, subMesh: SubMesh, useInstances?: boolean): boolean;
    added(eventData: IPipelineMessageType<ITile<Map3dTileContentType>>, eventState: EventState): void;
    removed(eventData: IPipelineMessageType<ITile<Map3dTileContentType>>, eventState: EventState): void;
    updated(eventData: IPipelineMessageType<ITile<Map3dTileContentType>>, eventState: EventState): void;
    protected _buildSampler(kind: string, width: number, height: number, depth: number, generateMipMap: boolean, scene: Scene): void;
    protected _bindSamplers(effect: Effect): void;
}
