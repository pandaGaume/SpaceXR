import { ICartesian2 } from "../../geometry";
import { IVectorTileFeature, VectorTileGeomType } from "./tiles.vector.interfaces";

export class VectorTileFeature implements IVectorTileFeature {
    private _id?: number;
    private _type: VectorTileGeomType;
    private _properties: { [name: string]: any } | null;
    private _geometry: Array<Array<ICartesian2>>;

    public constructor(id: number | undefined, type: VectorTileGeomType, ...geometries: Array<Array<ICartesian2>>) {
        this._id = id;
        this._type = type;
        this._geometry = geometries;
        this._properties = {};
    }

    public get id(): number | undefined {
        return this._id;
    }

    public get type(): VectorTileGeomType {
        return this._type;
    }

    public get properties(): { [name: string]: any } | null {
        return this._properties;
    }

    public loadGeometry(): Array<Array<ICartesian2>> {
        return this._geometry;
    }
}
