export interface IExampleConfig {
    latitudeDegrees: number;
    longitudeDegrees: number;
    heightMeters: number;
    cameraDistanceMeters: number;
}

function finiteNumber(value: string | undefined, fallback: number, name: string): number {
    if (value === undefined || value.trim().length === 0) return fallback;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) throw new Error(`${name} must be a finite number.`);
    return parsed;
}

export function loadExampleConfig(environment: ImportMetaEnv = import.meta.env): IExampleConfig {
    const cameraDistanceMeters = finiteNumber(environment.VITE_GOOGLE_3D_TILES_CAMERA_DISTANCE_METERS, 1800, "Camera distance");
    if (cameraDistanceMeters <= 0) throw new Error("Camera distance must be greater than zero.");
    return {
        latitudeDegrees: finiteNumber(environment.VITE_GOOGLE_3D_TILES_LATITUDE, 48.8566, "Latitude"),
        longitudeDegrees: finiteNumber(environment.VITE_GOOGLE_3D_TILES_LONGITUDE, 2.3522, "Longitude"),
        heightMeters: finiteNumber(environment.VITE_GOOGLE_3D_TILES_HEIGHT_METERS, 0, "Height"),
        cameraDistanceMeters,
    };
}
