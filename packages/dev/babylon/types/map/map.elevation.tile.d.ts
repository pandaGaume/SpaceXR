import { AbstractMesh } from "@babylonjs/core";
import { IDemInfos } from "core/dem";
import { ISourceBlock, ITile, ITileMetrics, Tile } from "core/tiles";
import { Nullable } from "core/types";
import { CanvasTileSourceTargetContentType } from "core/map/canvas/map.canvas.source";
export interface IElevationMesh {
    infos: Nullable<IDemInfos>;
    surface: Nullable<AbstractMesh>;
    textureSource: Nullable<ISourceBlock<ITile<CanvasTileSourceTargetContentType>>>;
    tile: Nullable<ITile<ImageData>>;
    validate(): void;
}
export interface IElevationTile extends ITile<IElevationMesh> {
}
export declare class ElevationMesh implements IElevationMesh {
    _demInfos: Nullable<IDemInfos>;
    _surface: Nullable<AbstractMesh>;
    _tile: Nullable<ITile<ImageData>>;
    _texture: Nullable<ISourceBlock<ITile<CanvasTileSourceTargetContentType>>>;
    constructor(demInfos?: Nullable<IDemInfos>, texture?: Nullable<ISourceBlock<ITile<CanvasTileSourceTargetContentType>>>, tile?: Nullable<ITile<ImageData>>, surface?: Nullable<AbstractMesh>);
    get surface(): Nullable<AbstractMesh>;
    set surface(value: Nullable<AbstractMesh>);
    get tile(): Nullable<ITile<ImageData>>;
    set tile(value: Nullable<ITile<ImageData>>);
    get textureSource(): Nullable<ISourceBlock<ITile<CanvasTileSourceTargetContentType>>>;
    set textureSource(value: Nullable<ISourceBlock<ITile<CanvasTileSourceTargetContentType>>>);
    get infos(): Nullable<IDemInfos>;
    set infos(value: Nullable<IDemInfos>);
    validate(): void;
}
export declare class ElevationTile extends Tile<IElevationMesh> implements IElevationTile {
    constructor(x: number, y: number, lod: number, mesh: Nullable<IElevationMesh | IDemInfos>, metrics?: ITileMetrics);
}
