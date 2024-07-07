import { IGeoBounded, IGeoShape } from "../../geography";
import { IBounded, IShape } from "../../geometry";
import { Nullable } from "../../types";
import { IDrawableTileMapLayer, ITileMapLayer } from "../map";
import { IDecoratedShape } from "./tiles.vector.decorated";

export interface IShapeView extends IDecoratedShape<IShape>, IGeoBounded, IBounded {
    source: Nullable<IGeoShape | IShape>;
    lod: number;
}

export type ShapeLayerOutputContentType = IShapeView; //IShape | IDecoratedShape<IShape>;

export interface IShapeLayer extends ITileMapLayer<Array<ShapeLayerOutputContentType>>, IDrawableTileMapLayer<Array<ShapeLayerOutputContentType>> {}
