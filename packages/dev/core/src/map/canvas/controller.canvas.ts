import { Nullable } from "../../types";
import { Observer } from "../../events/events.observable";
import { TileMapView, UpdateEventArgs, UpdateReason } from "../../tiles/tiles.mapview";
import { ICartesian2, IRectangle } from "../../geometry/geometry.interfaces";
import { Cartesian2 } from "../../geometry/geometry.cartesian";
import { Scalar } from "../../math/math";
import { Rectangle } from "../../geometry/geometry.rectangle";

export interface ICanvasView {
    invalidateContent<V>(ctx: CanvasRenderingContext2D, rect: IRectangle, src: CanvasController<V>): void;
}

export class CanvasController<V> implements ICanvasView {
    _resizeObserver: ResizeObserver;

    _canvas: HTMLCanvasElement;
    _ui: ICanvasView;
    _view?: Nullable<TileMapView<V>>; // the view logic
    _observer?: Nullable<Observer<UpdateEventArgs<V>>>;
    _lod: number = 0;
    _scale: number = 1;
    _center: ICartesian2 = Cartesian2.Zero();

    public constructor(canvas: HTMLCanvasElement, ui?: ICanvasView) {
        this._canvas = canvas;
        this._ui = ui || this;
        this._resizeObserver = new ResizeObserver(() => {
            this.invalidateDisplay();
        });
        this._resizeObserver.observe(canvas);
    }

    public get view(): Nullable<TileMapView<V>> | undefined {
        return this._view;
    }

    public get levelOfDetail(): number {
        return this._lod;
    }

    public attachView(view: TileMapView<V>) {
        this.detachView();
        this._view = view;
        this._observer = this._view.updateObservable.add((e: UpdateEventArgs<V>) => this.onUpdate(e));
    }

    public detachView() {
        if (this._view && this._observer) {
            this._view.updateObservable.remove(this._observer);
            this._view = null;
            this._observer = null;
        }
    }

    protected onUpdate(args: UpdateEventArgs<V>): void {
        if (!args) {
            return;
        }

        switch (args.reason) {
            case UpdateReason.viewChanged: {
                this.onUpdateView(args);
                break;
            }
        }
    }

    protected onUpdateView(args: UpdateEventArgs<V>): void {
        // update the view parameters
        this._lod = args.lod;
        this._scale = args.scale;
        this._center = args.center;

        // invalidate display
        this.invalidateDisplay();
    }

    protected invalidateDisplay(rect?: IRectangle) {
        if (this._canvas) {
            const ctx = this._canvas.getContext("2d");
            if (ctx) {
                const displayWidth = this._canvas.clientWidth;
                const displayHeight = this._canvas.clientHeight;
                rect = rect || new Rectangle(0, 0, displayWidth, displayHeight);
                ctx.clearRect(rect.x, rect.y, rect.width, rect.height);
                this.invalidateCanvas(ctx, rect);
            }
        }
    }

    protected invalidateCanvas(ctx: CanvasRenderingContext2D, rect: IRectangle) {
        if (ctx) {
            const scale = this._scale;
            ctx.save();
            ctx.translate(rect.width / 2, rect.height / 2);
            ctx.scale(scale, scale);
            const rotation = this._view?.azimuth;
            if (rotation) {
                const angle = rotation * Scalar.DEG2RAD;
                ctx.rotate(angle);
            }
            this._ui.invalidateContent(ctx, rect, this);
            ctx.restore();
        }
    }

    public invalidateContent<V>(ctx: CanvasRenderingContext2D, rect: IRectangle, src: CanvasController<V>): void {}
}
