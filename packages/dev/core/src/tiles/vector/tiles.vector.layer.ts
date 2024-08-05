import { IVectorTileFeature, IVectorTileLayer } from "./tiles.vector.interfaces";

export class VectorTileLayer implements IVectorTileLayer {
    public static CurrentVersion: number = 2.1;
    public static LatestVersion: number = 2.1;
    public static DefaultExtent: number = 4096;

    private _name: string;
    private _extent: number;
    private _version: number;

    private _features: Array<IVectorTileFeature>;

    public constructor(name: string, extent?: number, version?: number, ...features: Array<IVectorTileFeature>) {
        this._name = name;
        this._extent = extent ?? VectorTileLayer.DefaultExtent;
        this._version = version ?? VectorTileLayer.CurrentVersion;
        this._features = features ?? [];
    }

    public get name(): string {
        return this._name;
    }

    public get extent(): number {
        return this._extent;
    }

    public get version(): number {
        return this._version;
    }

    public feature(i: number): IVectorTileFeature | undefined {
        if (i >= 0 || i < this._features.length) {
            return this._features[i];
        }
        return undefined;
    }

    public get length(): number {
        return this._features.length;
    }
}
