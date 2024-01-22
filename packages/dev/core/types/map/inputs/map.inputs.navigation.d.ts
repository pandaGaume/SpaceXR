import { ITileNavigationApi } from "../../tiles";
import { IPointerTarget, IWheelTarget, IDragTarget } from "./map.inputs.interfaces";
export declare class InputsNavigationTarget<T> implements IPointerTarget<T>, IWheelTarget<T>, IDragTarget<T> {
    static readonly DEFAULT_ZOOM_INCREMENT = 0.1;
    _target: ITileNavigationApi<unknown>;
    _zoomIncrement?: number;
    _offsetX: number;
    _offsetY: number;
    _startX: number;
    _startY: number;
    _isDragging: boolean;
    _button: number;
    constructor(target: ITileNavigationApi<unknown>, zoomIncrement?: number);
    get target(): ITileNavigationApi<unknown>;
    get zoomIncrement(): number | undefined;
    set zoomIncrement(value: number | undefined);
    onWheel(src: T, delta: number): void;
    onPointerMove(src: T, x: number, y: number): void;
    onPointerOut(src: T, x: number, y: number): void;
    onPointerDown(src: T, x: number, y: number, buttonIndex: number): void;
    onPointerUp(src: T, x: number, y: number, buttonIndex: number): void;
    onPointerClick(src: T, x: number, y: number, buttonIndex: number): void;
    onPointerEnter(src: T, x: number, y: number): void;
    onBeginDrag(src: T, dx: number, dy: number, buttonIndex: number): void;
    onDrag(src: T, dx: number, dy: number, buttonIndex: number): void;
    onEndDrag(src: T, dx: number, dy: number, buttonIndex: number): void;
}
