import { Bounded } from "../geometry.bounds";
import { IBounds, ICartesian3 } from "../geometry.interfaces";
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

    public [Symbol.iterator](): Iterator<ICartesian3> {
        let index = 0;
        let points = this._getPoints();

        return {
            next(): IteratorResult<ICartesian3> {
                if (index < points.length) {
                    return { value: points[index++], done: false };
                } else {
                    return { value: null, done: true };
                }
            },
        };
    }

    protected abstract _buildBounds(): IBounds | undefined;
    protected abstract _getPoints(): Array<ICartesian3>;
}
