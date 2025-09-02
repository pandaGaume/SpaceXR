/// <summary>
/// Utility for handling UTM ↔ EPSG conversions.
/// Covers all WGS84 UTM zones (EPSG 32601–32660 for North,
/// EPSG 32701–32760 for South). Norway/Svalbard exceptions supported.
/// </summary>
export interface IUTMInfo {
    zone: number; // 1..60
    hemisphere: "N" | "S"; // Northern or Southern hemisphere
    epsg: number; // 326xx (N) or 327xx (S)
    centralMeridian: number; // degrees
}

export class UTM {
    /// <summary>
    /// Compute UTM zone and EPSG code from geographic coordinates.
    /// </summary>
    public static FromLatLon(latDeg: number, lonDeg: number, useExceptions: boolean = true): IUTMInfo {
        // Normalize longitude to [-180, 180)
        let lon = ((((lonDeg + 180) % 360) + 360) % 360) - 180;
        const lat = Math.max(Math.min(latDeg, 90), -90);

        // Base UTM zone
        let zone = Math.floor((lon + 180) / 6) + 1;
        zone = Math.max(1, Math.min(zone, 60));

        if (useExceptions) {
            // Norway exception: 56°N–64°N and 3°E–12°E → zone 32
            if (lat >= 56 && lat < 64 && lon >= 3 && lon < 12) {
                zone = 32;
            }

            // Svalbard exception: 72°N–84°N
            if (lat >= 72 && lat < 84) {
                if (lon >= 0 && lon < 9) zone = 31;
                else if (lon >= 9 && lon < 21) zone = 33;
                else if (lon >= 21 && lon < 33) zone = 35;
                else if (lon >= 33 && lon < 42) zone = 37;
            }
        }

        const hemisphere: "N" | "S" = lat >= 0 ? "N" : "S";
        const epsgBase = hemisphere === "N" ? 32600 : 32700;
        const epsg = epsgBase + zone;

        // Central meridian of the UTM zone
        const centralMeridian = -183 + 6 * zone;

        return { zone, hemisphere, epsg, centralMeridian };
    }

    /// <summary>
    /// Build an EPSG integer code from zone and hemisphere.
    /// </summary>
    public static ToEPSG(zone: number, hemisphere: "N" | "S"): number {
        const epsgBase = hemisphere === "N" ? 32600 : 32700;
        return epsgBase + zone;
    }

    /// <summary>
    /// Build an EPSG string like "EPSG:32631".
    /// </summary>
    public static ToEPSGString(zone: number, hemisphere: "N" | "S"): string {
        return `EPSG:${this.ToEPSG(zone, hemisphere)}`;
    }
}
