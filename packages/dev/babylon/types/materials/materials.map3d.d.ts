import { AbstractMesh, Effect, MaterialDefines, PushMaterial, Scene, SubMesh } from "@babylonjs/core";
import { EventState } from "core/events";
import { IPipelineMessageType, ITargetBlock, ITile, ImageLayer } from "core/tiles";
import { Range } from "core/math";
import { ClipIndex, ClipPlaneDefinition } from "./materials.clipPlane";
import { ElevationLayer, Map3dTileContentType } from "../map";
import { IDemInfos } from "core/dem";
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
    protected _demAdded(src: ElevationLayer, eventData: ITile<IDemInfos>): void;
    protected _demRemoved(src: ElevationLayer, eventData: ITile<IDemInfos>): void;
    protected _demUpdated(src: ElevationLayer, eventData: ITile<IDemInfos>): void;
    protected _imageAdded(src: ImageLayer, eventData: ITile<HTMLImageElement>): void;
    protected _imageRemoved(src: ImageLayer, eventData: ITile<HTMLImageElement>): void;
    protected _imageUpdated(src: ImageLayer, eventData: ITile<HTMLImageElement>): void;
    protected _buildSampler(kind: string, width: number, height: number, depth: number, generateMipMap: boolean, scene: Scene): void;
    protected _bindSamplers(effect: Effect): void;
}
