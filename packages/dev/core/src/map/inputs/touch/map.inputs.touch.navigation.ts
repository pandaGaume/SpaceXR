import { ITileNavigationApi } from "dev/core/src/tiles";
import { InputsNavigationTargetBase } from "../map.inputs.navigation";

export class InputsTouchNavigationTarget extends InputsNavigationTargetBase {
    public constructor(target: ITileNavigationApi, zoomIncrement?: number, invertY: boolean = true) {
        super(target, zoomIncrement, invertY);
    }
}
