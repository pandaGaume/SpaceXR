import { ITileNavigationApi } from "../../tiles";
export declare class InputsNavigationTargetBase {
    static readonly DEFAULT_ZOOM_INCREMENT = 0.1;
    _target: ITileNavigationApi;
    _zoomIncrement?: number;
    _inverty?: boolean;
    constructor(target: ITileNavigationApi, zoomIncrement?: number, invertY?: boolean);
}
