import { Bounded } from "../geometry.bounds";
import { IBounds2 } from "../geometry.interfaces";
import { IShape, ShapeType } from "./geometry.shapes.interfaces";

export abstract class AbstractShape extends Bounded implements IShape {
    _type: ShapeType;

    public constructor(t: ShapeType) {
        super();
        this._type = t;
    }

    public get type(): ShapeType {
        return this._type;
    }

    protected abstract _buildBounds(): IBounds2 | undefined;
}
