import { ImageLayerContentType, IPipelineMessageType, ITargetBlock, ITile, ITileMetrics, Tile, TileContentType } from "core/tiles";
import { IHasGridElevation, ITileWithGridElevation } from "./map.interfaces";
import { Nullable } from "core/types";
import { AbstractMesh } from "@babylonjs/core";
import { DemInfos, ElevationHelpers, IDemInfos } from "core/dem";
import { EventState, Observable } from "core/events";
import { ISize2 } from "core/geometry";

export class TileWithElevation<T extends ImageLayerContentType> extends Tile<T> implements ITileWithGridElevation<T>, ITargetBlock<ITile<IDemInfos>> {
    // 3D related
    _surface: Nullable<AbstractMesh>;
    _demInfos: Nullable<IDemInfos>;
    _gridSize: Nullable<ISize2>;
    _elevationUpdateObservable?: Observable<IHasGridElevation>;

    public constructor(x: number, y: number, levelOfDetail: number, data: TileContentType<T> = null, metrics?: ITileMetrics) {
        super(x, y, levelOfDetail, data, metrics);
        this._surface = null;
        this._demInfos = null;
        this._gridSize = null;
    }

    public get elevationUpdateObservable(): Observable<IHasGridElevation> {
        if (!this._elevationUpdateObservable) {
            this._elevationUpdateObservable = new Observable<IHasGridElevation>();
        }
        return this._elevationUpdateObservable;
    }

    public get elevationInfos(): Nullable<IDemInfos> {
        return this._demInfos;
    }

    public set elevationInfos(v: Nullable<IDemInfos>) {
        this._demInfos = v;
    }

    public get gridSize(): Nullable<ISize2> {
        return this._gridSize;
    }

    public set gridSize(v: Nullable<ISize2>) {
        this._gridSize = v;
    }

    public get surface(): Nullable<AbstractMesh> {
        return this._surface;
    }

    public set surface(s: Nullable<AbstractMesh>) {
        this._surface = s;
    }

    public added(data: IPipelineMessageType<ITile<IDemInfos>>, state: EventState): void {
        if (this._isHasNecessaryElevationInfos()) {
            for (const t of data) {
                if (this.address.quadkey.startsWith(t.address.quadkey)) {
                    if (t.address.quadkey.length === this.address.quadkey.length) {
                        this._addElevation(t, state);
                        return;
                    }
                    // we have parent data
                    this._addParentElevation(t, state);
                    return;
                }

                if (t.address.quadkey.startsWith(this.address.quadkey)) {
                    // we have child data
                    this._addChildElevation(t, state);
                    return;
                }
            }
        }
    }

    public removed(data: IPipelineMessageType<ITile<IDemInfos>>, state: EventState): void {
        if (this._isHasNecessaryElevationInfos()) {
            for (const t of data) {
                if (this.address.quadkey.startsWith(t.address.quadkey)) {
                    if (t.address.quadkey.length === this.address.quadkey.length) {
                        this._removeElevation(t, state);
                        return;
                    }
                    // we have parent data
                    this._removeParentElevation(t, state);
                    return;
                }

                if (t.address.quadkey.startsWith(this.address.quadkey)) {
                    // we have child data
                    this._removeChildElevation(t, state);
                    return;
                }
            }
        }
    }

    public updated(data: IPipelineMessageType<ITile<IDemInfos>>, state: EventState): void {
        if (this._isHasNecessaryElevationInfos()) {
            for (const t of data) {
                if (this.address.quadkey.startsWith(t.address.quadkey)) {
                    if (t.address.quadkey.length === this.address.quadkey.length) {
                        this._updateElevation(t, state);
                        return;
                    }
                    // we have parent data
                    this._updateParentElevation(t, state);
                    return;
                }

                if (t.address.quadkey.startsWith(this.address.quadkey)) {
                    // we have child data
                    this._updateChildElevation(t, state);
                    return;
                }
            }
        }
    }

    protected _addParentElevation(data: ITile<IDemInfos>, state: EventState): void {
        this._updateParentElevation(data, state);
    }
    protected _addElevation(data: ITile<IDemInfos>, state: EventState): void {}
    protected _addChildElevation(data: ITile<IDemInfos>, state: EventState): void {}

    protected _removeParentElevation(data: ITile<IDemInfos>, state: EventState): void {}
    protected _removeElevation(data: ITile<IDemInfos>, state: EventState): void {}
    protected _removeChildElevation(data: ITile<IDemInfos>, state: EventState): void {}

    protected _updateParentElevation(data: ITile<IDemInfos>, state: EventState): void {
        if (data.content?.elevations) {
            const tileSize = state.currentTarget.metrics.tileSize;
            const b0 = data.geoBounds!;
            const b1 = this.geoBounds!;
            var tx = (b1.west - b0.west) / (b0.east - b0.west);
            var ty = 1 - (b1.north - b0.south) / (b0.north - b0.south);

            const elevationBuffer = ElevationHelpers.GetArea(
                data.content.elevations,
                tileSize,
                tileSize,
                tx * tileSize,
                ty * tileSize,
                this.gridSize!.width,
                this.gridSize!.height
            );
            this._demInfos = new DemInfos(elevationBuffer);
            this._elevationUpdateObservable?.notifyObservers(this, -1, this, this);
        }
    }
    protected _updateElevation(data: ITile<IDemInfos>, state: EventState): void {}
    protected _updateChildElevation(data: ITile<IDemInfos>, state: EventState): void {}

    protected _isHasNecessaryElevationInfos(): boolean {
        return this._gridSize !== null && this._gridSize.width > 0 && this._gridSize.height > 0;
    }
}
