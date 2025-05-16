import { ITileNavigationApi } from "../../tiles";
import { IInputSource, IPointerDragEvent } from "./map.inputs.interfaces";

export class InputsNavigationController {
    static readonly DEFAULT_ZOOM_INCREMENT = 0.1;

    _source: IInputSource;
    _target: ITileNavigationApi;
    _zoomIncrement?: number;
    _inverty?: boolean;

    public constructor(source: IInputSource, target: ITileNavigationApi, zoomIncrement?: number, invertY: boolean = true) {
        this._source = source;
        this._target = target;
        this._zoomIncrement = zoomIncrement ?? InputsNavigationController.DEFAULT_ZOOM_INCREMENT;
        this._inverty = invertY;
        this._attachSource(this._source);
    }

    protected _attachSource(source: IInputSource): void {
        source.onDragObservable.add(this._onDrag.bind(this));
        source.onWheelObservable.add(this._onWheel.bind(this));
    }

    protected _onDrag(event: IPointerDragEvent): void {
        switch (event.type) {
            case "drag": {
                switch (event.button) {
                    case 0: {
                        if (event.deltaX || event.deltaY) {
                            // translate the center of the map according the drag displacement
                            // then we have to negate the drag displacement.
                            this._target.translateUnitsMap(-event.deltaX, -event.deltaY);
                        }
                        break;
                    }
                    case 2: {
                        if (event.deltaX) {
                            // rotate the map according the drag displacement
                            this._target.rotateMap(event.deltaX);
                        }
                        break;
                    }
                }
                break;
            }
        }
    }

    public _onWheel(event: WheelEvent): void {
        // deltaY: vertical scroll (e.g., scroll wheel up/down or two-finger up/down)
        const delta = Math.sign(event.deltaY) * (this._zoomIncrement ?? Math.abs(event.deltaY));
        this._target.zoomMap(delta);
    }
}
