import { Observable } from "../../events";
import { ICartesian4 } from "../../geometry";

export interface IWheelTarget<T> {
    onWheel(src: T, d: number): void;
}

export interface IPointerTarget<T> {
    onPointerMove(src: T, x: number, y: number, z: number): void;
    onPointerOut(src: T, x: number, y: number, z: number): void;
    onPointerDown(src: T, x: number, y: number, z: number, buttonIndex: number): void;
    onPointerUp(src: T, x: number, y: number, z: number, buttonIndex: number): void;
    onPointerClick(src: T, x: number, y: number, z: number, buttonIndex: number): void;
    onPointerEnter(src: T, x: number, y: number, z: number): void;
}

export interface IDragTarget<T> {
    onBeginDrag(src: T, dx: number, dy: number, z: number, buttonIndex: number): void;
    onDrag(src: T, dx: number, dy: number, z: number, buttonIndex: number): void;
    onEndDrag(src: T, dx: number, dy: number, z: number, buttonIndex: number): void;
}

export interface IPointerSource<T> {
    onPointerMoveObservable: Observable<ICartesian4>;
    onPointerOutObservable: Observable<T>;
    onPointerDownObservable: Observable<ICartesian4>;
    onPointerUpObservable: Observable<ICartesian4>;
    onPointerClickObservable: Observable<ICartesian4>;
    onPointerEnterObservable: Observable<T>;
    onWheelObservable: Observable<ICartesian4>;
}
