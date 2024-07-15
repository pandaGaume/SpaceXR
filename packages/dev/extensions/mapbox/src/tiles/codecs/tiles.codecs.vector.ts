import { ITileCodec, IVectorTileContent, IVectorTileFeature, IVectorTileLayer } from "core/tiles";
import { FloatArray, Nullable } from "core/types";
import { ICartesian2, Polygon, Polyline } from "core/geometry";

import { VectorTile } from "@mapbox/vector-tile";
import Protobuf from "pbf";

enum VectorTileGeomType {
    UNKNOWN = 0,
    POINT = 1,
    LINESTRING = 2,
    POLYGON = 3,
}

export class VectorTileCodec implements ITileCodec<IVectorTileContent> {
    public static Shared = new VectorTileCodec();

    public async decodeAsync(r: void | Response): Promise<Awaited<Nullable<IVectorTileContent>>> {
        let content: Nullable<IVectorTileContent> = null;
        if (r instanceof Response) {
            const data = await r.blob();
            if (data) {
                // this is the place to read the PROTOBUF data
                const encoded = new Uint8Array(await data.arrayBuffer());
                const tile = new VectorTile(new Protobuf(encoded));
                content = new Map<string, IVectorTileLayer>();
                for (const [key, value] of Object.entries(tile.layers)) {
                    const features: Array<IVectorTileFeature> = [];
                    const layer = { extent: value.extent, features: features } as IVectorTileLayer;
                    content.set(key, layer);
                    for (let i = 0; i < value.length; i++) {
                        const f = value.feature(i);
                        const geom = f.loadGeometry();
                        let coordinates = this._toFloats(geom);
                        let shape: any = null;
                        switch (f.type) {
                            case VectorTileGeomType.POINT:
                                break;
                            case VectorTileGeomType.LINESTRING:
                                shape = Polyline.FromFloats(coordinates, 2);
                                features.push({ shape: shape });
                                break;
                            case VectorTileGeomType.POLYGON:
                                shape = Polygon.FromFloats(coordinates, 2);
                                features.push({ shape: shape });
                                break;
                        }
                    }
                }
            }
        }
        return content;
    }

    protected _toFloats(points: Array<Array<ICartesian2>>): Array<FloatArray> {
        const arrays = new Array(points.length);
        for (let i = 0; i < points.length; i++) {
            arrays[i] = this._toFloats0(points[i]);
        }
        return arrays;
    }

    protected _toFloats0(points: Array<ICartesian2>): FloatArray {
        const floats = new Float32Array(points.length * 2);
        let i = 0;
        for (const p of points) {
            floats[i++] = p.x;
            floats[i++] = p.y;
        }
        return floats;
    }
}
