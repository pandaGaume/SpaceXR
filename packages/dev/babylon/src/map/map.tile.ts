import { ImageLayerContentType, IPipelineMessageType, ITargetBlock, ITile, ITileMetrics, Tile, TileContentType } from "core/tiles";
import { IHasElevation, ITileWithMesh } from "./map.interfaces";
import { Nullable } from "core/types";
import { AbstractMesh } from "@babylonjs/core";
import { IDemInfos } from "core/dem";
import { EventState } from "core/events";

export class TileWithElevation<T extends ImageLayerContentType> extends Tile<T> implements ITileWithMesh<T>, IHasElevation, ITargetBlock<ITile<IDemInfos>> {
    // 3D related
    _surface: Nullable<AbstractMesh>;
    _demInfos: Nullable<IDemInfos>;

    public constructor(x: number, y: number, levelOfDetail: number, data: TileContentType<T> = null, metrics?: ITileMetrics) {
        super(x, y, levelOfDetail, data, metrics);
        this._surface = null;
        this._demInfos = null;
    }

    public get elevationInfos(): Nullable<IDemInfos> {
        return this._demInfos;
    }

    public set elevationInfos(d: Nullable<IDemInfos>) {
        this._demInfos = d;
    }

    public get surface(): Nullable<AbstractMesh> {
        return this._surface;
    }

    public set surface(s: Nullable<AbstractMesh>) {
        this._surface = s;
    }

    public added(data: IPipelineMessageType<ITile<IDemInfos>>, state: EventState): void {}

    public removed(data: IPipelineMessageType<ITile<IDemInfos>>, state: EventState): void {}

    public updated(data: IPipelineMessageType<ITile<IDemInfos>>, state: EventState): void {}
}
