import { Observable } from "../../events";
import { ICartesian2 } from "../../geometry";
export interface IWheelTarget<T> {
    onWheel(src: T, d: number): void;
}
export interface IPointerTarget<T> {
    onPointerMove(src: T, x: number, y: number): void;
    onPointerOut(src: T, x: number, y: number): void;
    onPointerDown(src: T, x: number, y: number, buttonIndex: number): void;
    onPointerUp(src: T, x: number, y: number, buttonIndex: number): void;
    onPointerClick(src: T, x: number, y: number, buttonIndex: number): void;
    onPointerEnter(src: T, x: number, y: number): void;
}
export interface IDragTarget<T> {
    onBeginDrag(src: T, dx: number, dy: number, buttonIndex: number): void;
    onDrag(src: T, dx: number, dy: number, buttonIndex: number): void;
    onEndDrag(src: T, dx: number, dy: number, buttonIndex: number): void;
}
export interface ICartesian2WithInfos extends ICartesian2 {
    buttonIndex: number;
}
export interface IPointerSource<T> {
    onPointerMoveObservable: Observable<ICartesian2>;
    onPointerOutObservable: Observable<T>;
    onPointerDownObservable: Observable<ICartesian2WithInfos>;
    onPointerUpObservable: Observable<ICartesian2WithInfos>;
    onPointerClickObservable: Observable<ICartesian2WithInfos>;
    onPointerEnterObservable: Observable<T>;
    onWheelObservable: Observable<number>;
}
