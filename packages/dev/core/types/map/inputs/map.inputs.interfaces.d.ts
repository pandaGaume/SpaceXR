import { Observable } from "../../events";
import { ICartesian2 } from "../../geometry";
export interface IWheelTarget<T> {
    onWheel(src: T, d: number): void;
}
export interface IPointerTarget<T> {
    onPointerMove(src: T, x: number, y: number, id?: number): void;
    onPointerExit(src: T, x: number, y: number, id?: number): void;
    onPointerDown(src: T, x: number, y: number, buttonIndex: number, id?: number): void;
    onPointerUp(src: T, x: number, y: number, buttonIndex: number, id?: number): void;
    onPointerClick(src: T, x: number, y: number, buttonIndex: number, id?: number): void;
    onPointerEnter(src: T, x: number, y: number, id?: number): void;
}
export interface IDragTarget<T> {
    onBeginDrag(src: T, dx: number, dy: number, buttonIndex: number, id?: number): void;
    onDrag(src: T, dx: number, dy: number, buttonIndex: number, id?: number): void;
    onEndDrag(src: T, dx: number, dy: number, buttonIndex: number, id?: number): void;
}
export interface ICartesian2WithInfos extends ICartesian2 {
    buttonIndex: number;
}
export interface IPointerSource {
    onPointerMoveObservable: Observable<ICartesian2>;
    onPointerOutObservable: Observable<IPointerSource>;
    onPointerDownObservable: Observable<ICartesian2WithInfos>;
    onPointerUpObservable: Observable<ICartesian2WithInfos>;
    onPointerClickObservable: Observable<ICartesian2WithInfos>;
    onPointerEnterObservable: Observable<IPointerSource>;
    onWheelObservable: Observable<number>;
}
