import { ITileNavigationApi } from "../../tiles";

export class InputsNavigationTargetBase {
    static readonly DEFAULT_ZOOM_INCREMENT = 0.1;

    _target: ITileNavigationApi;
    _zoomIncrement?: number;
    _inverty?: boolean;

    public constructor(target: ITileNavigationApi, zoomIncrement?: number, invertY: boolean = true) {
        this._target = target;
        this._zoomIncrement = zoomIncrement ?? InputsNavigationTargetBase.DEFAULT_ZOOM_INCREMENT;
        this._inverty = invertY;
    }
}
