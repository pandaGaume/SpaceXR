import { IBounds2, ICartesian2, isClipable, IShape, ISize2 } from "../../geometry";
import { VectorTileFeature } from "./tiles.vector.feature";
import { IVectorTileFeature, VectorTileGeomType } from "./tiles.vector.interfaces";

export class VectorTileFeatureBuilder {
    private static AcceptableTypes: Array<Array<boolean>> = [
        [false, false, false, false, false, false], // UNKNOWN
        [false, true, false, false, false, false], // POINT
        [false, false, true, true, false, true], // LINESTRING
        [false, false, false, true, false, false],
    ]; // POLYGON

    _type: VectorTileGeomType;
    _bounds?: IBounds2;
    _shapes: Array<IShape> = [];
    _clip: boolean = false;
    _insets?: ISize2;
    _extent?: number;

    public constructor(type: VectorTileGeomType) {
        this._type = type;
    }

    public withClip(value: boolean, insets?: ISize2): VectorTileFeatureBuilder {
        this._clip = value;
        this._insets = insets;
        return this;
    }

    public withBounds(value: IBounds2): VectorTileFeatureBuilder {
        this._bounds = value;
        return this;
    }

    public withExtent(value: number): VectorTileFeatureBuilder {
        this._extent = value;
        return this;
    }

    public withGeometry(value: IShape): VectorTileFeatureBuilder {
        if (VectorTileFeatureBuilder.AcceptableTypes[this._type][value.type]) {
            this._shapes.push(value);
        }
        return this;
    }

    public withGeometries(...values: Array<IShape>): VectorTileFeatureBuilder {
        for (const value of values) {
            this.withGeometry(value);
        }
        return this;
    }

    public build(id?: number, extent?: number): IVectorTileFeature {
        const geometries: Array<IShape> = [];
        if (this._clip && this._bounds) {
            const insetx = this._insets?.width ?? 0;
            const insety = this._insets?.height ?? 0;
            const bounds = this._bounds.clone().inflateInPlace(insetx, insety);
            for (const shape of this._shapes) {
                if (isClipable(shape)) {
                    const clipped = shape.clip(bounds);
                    if (!clipped) {
                        continue;
                    }
                    if (Array.isArray(clipped)) {
                        geometries.push(...clipped);
                        continue;
                    }
                    geometries.push(clipped);
                }
            }
        }
        const points: Array<Array<ICartesian2>> = geometries.map((g) => Array.from(g));
        return new VectorTileFeature(id, this._type, ...points);
    }
}
