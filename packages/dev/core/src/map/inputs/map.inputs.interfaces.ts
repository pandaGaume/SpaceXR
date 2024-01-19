export interface IWheelTarget<T> {
    onWheel(src: T, x: number, y: number): void;
}

export interface IPointerTarget<T> {
    onWheel(src: T, x: number, y: number): void;
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
