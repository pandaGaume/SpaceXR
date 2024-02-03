import { ITileDisplay, ITileMapLayer, TileMapBase } from "core/tiles";

// we use type of float32 for elevation and rgb images for the texture.
export type ElevationTileContentType = Float32Array | HTMLImageElement ;

export class ElevationMap extends TileMapBase<ElevationTileContentType> {


    public constructor(name: string, display?: ITileDisplay) {
        super(name, display);
    }

    public get elevationLayer(): ITileMapLayer<Float32Array> {
        return this.getLayers((l)=>l instanceof Float32Layer).pop() as ITileMapLayer<Float32Array>;
    }

}
