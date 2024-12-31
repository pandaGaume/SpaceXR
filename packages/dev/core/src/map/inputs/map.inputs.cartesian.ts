import { Cartesian2, ICartesian2 } from "../../geometry";
import { ICartesian2WithInfos } from "./map.inputs.interfaces";

export class Cartesian2WithInfos extends Cartesian2 implements ICartesian2WithInfos {
    /** defines the current mouse button index */
    _buttonIndex: number;
    _pointerId?: number;
    _textureCoordinates?: ICartesian2;

    public constructor(public x: number, public y: number, buttonIndex?: number, pointerId?: number) {
        super(x, y);
        this._buttonIndex = buttonIndex ?? -1;
        this._pointerId = pointerId;
    }

    public get buttonIndex() {
        return this._buttonIndex;
    }

    public get pointerId(): number | undefined {
        return this._pointerId;
    }

    public get textureCoordinates(): ICartesian2 | undefined {
        return this._textureCoordinates;
    }

    public set textureCoordinates(v: ICartesian2 | undefined) {
        this._textureCoordinates = v;
    }
}
