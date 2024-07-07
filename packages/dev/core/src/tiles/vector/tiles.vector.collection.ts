import { GeoBoundedCollection, GeoShapeType, IEnvelope, IGeo2, IGeoCircle, IGeoLine, IGeoPolygon, IGeoPolyline, IGeoShape, isGeoShape } from "../../geography";
import { Cartesian3, IBounds2, ICartesian3 } from "../../geometry";
import { Polygon } from "../../geometry/shapes/geometry.polygon";
import { Polyline } from "../../geometry/shapes/geometry.polyline";
import { Line } from "../../geometry/shapes/geometry.line";
import { IShape, ShapeType } from "../../geometry/shapes/geometry.shapes.interfaces";
import { Nullable } from "../../types";
import { ITileMetrics, ITileMetricsProvider } from "../tiles.interfaces";
import { PolylineSimplifier } from "../../geometry/geometry.simplify";
import { Observable } from "../../events";
import { DecoratedShape, IShapeDrawOptions, isDecoratedShape } from "./tiles.vector.decorated";
import { ShapeLayerInputContentType } from "./tiles.vector.layer";
import { IShapeView } from "./tiles.vector.interfaces";

class ShapeView extends DecoratedShape<IShape> implements IShapeView {
    private _source: Nullable<IGeoShape | IShape>;
    private _lod: number;

    public constructor(shape: Nullable<IGeoShape | IShape>, view: IShape, lod: number, options: Nullable<IShapeDrawOptions>) {
        super(view, options);
        this._source = shape;
        this._lod = lod;
    }

    public get source(): Nullable<IGeoShape | IShape> {
        return this._source;
    }

    public get lod(): number {
        return this._lod;
    }

    public get bounds(): IBounds2 | undefined {
        return this.shape?.bounds;
    }

    public get geoBounds(): IEnvelope | undefined {
        return isGeoShape(this.source) ? this.source.geoBounds : undefined;
    }
}

// TODO : introduce ShapeFactory to allow extensions..
export class ShapeViewCollection implements ITileMetricsProvider {
    public static DefaultSimplifyTolerance: number = 2;
    public static DefaultSimplifyHighQuality: boolean = false;
    public static Epsilon = 1;

    _addedObservable?: Observable<Array<IShapeView>>;
    _removedObservable?: Observable<Array<IShapeView>>;

    private _shapes: Array<GeoBoundedCollection<ShapeView>>;
    private _metrics: ITileMetrics;
    private _simplifier: PolylineSimplifier<ICartesian3>;

    public constructor(metrics: ITileMetrics, simplifier?: PolylineSimplifier<ICartesian3>) {
        this._metrics = metrics;
        this._shapes = new Array<GeoBoundedCollection<ShapeView>>(metrics.maxLOD - metrics.minLOD + 1);
        this._simplifier = simplifier ?? new PolylineSimplifier<ICartesian3>(ShapeViewCollection.DefaultSimplifyTolerance, ShapeViewCollection.DefaultSimplifyHighQuality);
    }

    public get metrics(): ITileMetrics {
        return this._metrics;
    }

    public get addedObservable(): Observable<Array<IShapeView>> {
        if (this._addedObservable === undefined) {
            this._addedObservable = new Observable<Array<IShapeView>>();
        }
        return this._addedObservable;
    }

    public get removedObservable(): Observable<Array<IShapeView>> {
        if (this._removedObservable === undefined) {
            this._removedObservable = new Observable<Array<IShapeView>>();
        }
        return this._removedObservable;
    }

    public get(lod: number): Nullable<GeoBoundedCollection<ShapeView>> {
        if (lod < this._metrics.minLOD || lod > this._metrics.maxLOD) {
            return null;
        }
        return this._shapes[lod - this._metrics.minLOD];
    }

    public trySet(lod: number, ...shapes: Array<ShapeLayerInputContentType>): boolean {
        let collection = this.get(lod);
        const views = shapes.map((s) => this._buildView(s, lod, this.metrics)).filter((v) => v !== null) as ShapeView[];
        if (views.length === 0) {
            return false;
        }
        if (!collection) {
            collection = new GeoBoundedCollection<ShapeView>();
            this._shapes[lod - this._metrics.minLOD] = collection;
        }
        collection.push(...views);
        if (this._addedObservable !== undefined && this._addedObservable.hasObservers()) {
            this._addedObservable.notifyObservers(views, -1, this, this);
        }
        return true;
    }

    protected _buildView(decorated: ShapeLayerInputContentType, lod: number, metrics: ITileMetrics): Nullable<ShapeView> {
        if (isDecoratedShape(decorated)) {
            const s = this._buildShape(decorated.shape, lod, metrics);
            if (s) {
                return new ShapeView(decorated.shape, s, lod, decorated.options);
            }
        } else {
            const s = this._buildShape(decorated, lod, metrics);
            if (s) {
                return new ShapeView(decorated, s, lod, null);
            }
        }
        return null;
    }

    protected _buildShape(shape: IGeoShape | IShape, lod: number, metrics: ITileMetrics): Nullable<IShape> {
        switch (shape.type) {
            case GeoShapeType.Circle: {
                return this._buildCircle(shape as IGeoCircle, lod, metrics);
            }
            case GeoShapeType.Polygon: {
                return this._buildPolygon(shape as IGeoPolygon, lod, metrics);
            }
            case GeoShapeType.Line: {
                return this._buildLine(shape as IGeoLine, lod, metrics);
            }
            case GeoShapeType.Polyline: {
                return this._buildPolyline(shape as IGeoPolyline, lod, metrics);
            }
            case ShapeType.Circle:
            case ShapeType.Line:
            case ShapeType.Polyline:
            case ShapeType.Polygon:
            case ShapeType.Point: {
                return shape as IShape;
            }
            default: {
                return null;
            }
        }
    }

    protected _buildCircle(shape: IGeoCircle, lod: number, metrics: ITileMetrics): Nullable<IShape> {
        const p = shape.toPolygon(32);
        return this._buildPolygon(p, lod, metrics);
    }

    protected _buildPolygon(shape: IGeoPolygon, lod: number, metrics: ITileMetrics): Nullable<IShape> {
        const points = this._transform(shape.points, lod, metrics);
        return new Polygon(points);
    }

    protected _buildLine(shape: IGeoLine, lod: number, metrics: ITileMetrics): Nullable<IShape> {
        const a = Cartesian3.Zero();
        const b = Cartesian3.Zero();
        metrics.getLatLonToPointXYToRef(shape.start.lat, shape.start.lon, lod, a);
        metrics.getLatLonToPointXYToRef(shape.end.lat, shape.end.lon, lod, b);
        return this._filter(a, b) ? new Line(a, b) : null;
    }

    protected _buildPolyline(shape: IGeoPolyline, lod: number, metrics: ITileMetrics): Nullable<IShape> {
        const points = this._transform(shape.points, lod, metrics);
        return this._filter(...points) ? new Polyline(points) : null;
    }

    // transform geo points to cartesian points using tile metrics (web mercator projection within Level Of Detail)
    protected _transform(geo: Array<IGeo2>, lod: number, metrics: ITileMetrics): Array<ICartesian3> {
        const result = geo.map((p) => {
            const ref = Cartesian3.Zero();
            metrics.getLatLonToPointXYToRef(p.lat, p.lon, lod, ref);
            return ref;
        });
        if (result.length > 2 && this._simplifier) {
            return this._simplifier.simplify(result);
        }
        return result;
    }

    // filter out points that are nearly ONE point
    protected _filter(...args: Array<ICartesian3>): boolean {
        if (args.length < 2) return true;
        const p1 = args[0];
        const p2 = args[1];
        return Cartesian3.Equals(p1, p2, ShapeViewCollection.Epsilon) == false;
    }
}
