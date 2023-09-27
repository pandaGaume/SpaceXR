import { Nullable } from "../../types";
import { Observer } from "../../events/events.observable";
import { TileMapView, UpdateEventArgs } from "../../tiles/tiles.mapview";
import { ICartesian2, IRectangle } from "../../geometry/geometry.interfaces";
export interface ICanvasView {
    invalidateContent<V>(ctx: CanvasRenderingContext2D, rect: IRectangle, src: CanvasController<V>): void;
}
export declare class CanvasController<V> implements ICanvasView {
    _resizeObserver: ResizeObserver;
    _canvas: HTMLCanvasElement;
    _ui: ICanvasView;
    _view?: Nullable<TileMapView<V>>;
    _observer?: Nullable<Observer<UpdateEventArgs<V>>>;
    _lod: number;
    _scale: number;
    _center: ICartesian2;
    constructor(canvas: HTMLCanvasElement, ui?: ICanvasView);
    get view(): Nullable<TileMapView<V>> | undefined;
    get levelOfDetail(): number;
    attachView(view: TileMapView<V>): void;
    detachView(): void;
    protected onUpdate(args: UpdateEventArgs<V>): void;
    protected onUpdateView(args: UpdateEventArgs<V>): void;
    protected invalidateDisplay(rect?: IRectangle): void;
    protected invalidateCanvas(ctx: CanvasRenderingContext2D, rect: IRectangle): void;
    invalidateContent<V>(ctx: CanvasRenderingContext2D, rect: IRectangle, src: CanvasController<V>): void;
}
