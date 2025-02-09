import { Cartesian3, ICartesian3, ISize3 } from "../geometry";
import { ITileMetrics } from "../tiles";

export class MapScale {
    ///<summary>
    /// Get the scale, according fixing level of detail and current physical map metrics
    ///</summary>
    public static GetScale(
        displaySize: number, // The physical size of the display in meters
        resolution: number, // The number of pixels on the display (width or height in pixels)
        metrics: ITileMetrics,
        lat: number,
        LOD: number // Level of detail (zoom level)
    ): number {
        const worldSize = resolution * metrics.groundResolution(lat, LOD);
        return displaySize / worldSize;
    }

    ///<summary>
    /// Get the X,Y,Z scales, according fixing level of detail and current physical map metrics
    ///</summary>
    public static GetScale3(
        displaySize: ISize3, // The physical size of the display in meters
        resolution: ISize3, // The number of pixels on the display (width or height in pixels)
        metrics: ITileMetrics,
        lat: number, // Latitude
        LOD: number // Level of detail (zoom level)
    ): ICartesian3 {
        const groundRes = metrics.groundResolution(lat, LOD);
        const x = displaySize.width / (resolution.width * groundRes);
        const y = displaySize.height / (resolution.height * groundRes);
        let z = groundRes;
        if (displaySize.depth) {
            z = (displaySize.depth / resolution.depth) * groundRes;
        }
        return new Cartesian3(x, y, z);
    }

    ///<summary>
    /// Get the level of detail, according fixing scale and current physical map metrics
    ///</summary>
    public static GetLOD(
        scale: number, // The scale value
        displaySize: number, // The physical size of the display in meters
        resolution: number, // The number of pixels on the display (width or height in pixels)
        lat: number, // Latitude (in radians)
        ellipsoidSemiMajorAxis: number, // The semi-major axis of the ellipsoid (meters)
        tileSize: number // The size of a tile (pixels)
    ): number {
        // Compute the LOD based on the reverse calculation
        const constantFactor = (resolution * Math.cos(lat) * 2 * Math.PI * ellipsoidSemiMajorAxis) / (displaySize * tileSize);
        const LOD = Math.log2(scale * constantFactor);
        return LOD;
    }
}
