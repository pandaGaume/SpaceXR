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

export class InputsNavigationPointerTarget<T> extends InputsNavigationTargetBase {
    _offsetX: number;
    _offsetY: number;

    _startX: number;
    _startY: number;

    _isDragging: boolean;
    _button: number;

    public constructor(target: ITileNavigationApi, zoomIncrement?: number, invertY: boolean = true) {
        super(target, zoomIncrement, invertY);
        this._offsetX = 0;
        this._offsetY = 0;

        this._startX = 0;
        this._startY = 0;

        this._button = 0;
        this._isDragging = false;
    }

    public onPointerOver(src: T, x: number, y: number, id?: number): void {}

    public onPointerLeave(src: T, x: number, y: number, id?: number): void {}

    public onPointerCancel(src: T, x: number, y: number, id?: number): void {}

    public onPointerGotCapture(src: T, x: number, y: number, id?: number): void {}

    public onPointerLostCapture(src: T, x: number, y: number, id?: number): void {}

    public get target(): ITileNavigationApi {
        return this._target;
    }

    public get zoomIncrement(): number | undefined {
        return this._zoomIncrement;
    }

    public set zoomIncrement(value: number | undefined) {
        this._zoomIncrement = value;
    }

    public onWheel(src: T, delta: number): void {
        // replace delta by zoomIncrement if defined
        delta = this._zoomIncrement ? (delta < 0 ? this._zoomIncrement : -this._zoomIncrement) : delta;
        this._target.zoomMap(delta);
    }

    public onPointerMove(src: T, x: number, y: number, id?: number): void {
        if (this._isDragging) {
            // compute the offset
            const dx = x - this._offsetX;
            const dy = y - this._offsetY;

            // mettre à jour les variables de décalage
            this._offsetX += dx;
            this._offsetY += dy;
            this.onDrag(src, dx, this._inverty ? dy : -dy, this._button);
        }
    }

    public onPointerOut(src: T, x: number, y: number, id?: number): void {
        // we let the drag continue.
    }

    public onPointerDown(src: T, x: number, y: number, buttonIndex: number, id?: number): void {
        // regisyter start
        this._offsetX = this._startX = x;
        this._offsetY = this._startY = y;
        this._button = buttonIndex;
        this._isDragging = true;
        this.onBeginDrag(src, this._offsetX, this._offsetY, this._button);
    }

    public onPointerUp(src: T, x: number, y: number, buttonIndex: number, id?: number): void {
        this._isDragging = false;
        // compute the offset
        const dx = x - this._offsetX;
        const dy = y - this._offsetY;
        this.onEndDrag(src, dx, dy, this._button);
    }

    public onPointerClick(src: T, x: number, y: number, buttonIndex: number, id?: number): void {}

    public onPointerEnter(src: T, x: number, y: number, id?: number): void {}

    public onBeginDrag(src: T, dx: number, dy: number, buttonIndex: number, id?: number): void {}

    public onDrag(src: T, dx: number, dy: number, buttonIndex: number, id?: number): void {
        switch (buttonIndex) {
            case 0: {
                if (dx || dy) {
                    // translate the center of the map according the drag displacement
                    // then we have to negate the drag displacement.
                    this._target.translateUnitsMap(-dx, -dy);
                }
                break;
            }
            case 2: {
                if (dx) {
                    // rotate the map according the drag displacement
                    this._target.rotateMap(dx);
                }
                break;
            }
        }
    }
    public onEndDrag(src: T, dx: number, dy: number, buttonIndex: number, id?: number): void {}
}
