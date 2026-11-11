import type { IContent, IMetadataEntity, ITileset } from "@spacexr/3d-tiles-core";
import { expandTileUrlTemplate, toTmsY, validateTileUrlTemplate, type ITileUrlTemplateOptions } from "@spacexr/tiles";

import {
    ImplicitTilesetDecorator,
    type IImplicitTilesetDecoratorOptions,
    type ITileAddress,
    type ITileDataSource,
    type ITileDataSourceTile,
} from "./tile-data-source";
import { WebMercatorTileMetrics, type ITileMetrics } from "./metrics";
import type { IImplicitCoordinates } from "./types";

/**
 * Row convention of the data source addresses and of the `{y}` template variable.
 * Prefer `XYZ` with the `{-y}` variable for TMS servers.
 */
export type WebMapScheme = "XYZ" | "TMS";

/** URL templates accept the variables of `@spacexr/tiles`: `{z}`, `{x}`, `{y}`, `{-y}`, `{quadkey}`, `{s}` and application variables. */
export interface IWebMapTileDataSourceOptions extends ITileUrlTemplateOptions {
    id?: string;
    urlTemplates: string | readonly string[];
    metrics: ITileMetrics;
    rootAddress?: ITileAddress;
    scheme?: WebMapScheme;
    minimumHeight?: number;
    maximumHeight?: number;
    geometricError?: (address: ITileAddress) => number;
    tileMetadata?: (address: ITileAddress) => IMetadataEntity | undefined;
    contentMetadata?: (address: ITileAddress, contentIndex: number) => IMetadataEntity | undefined;
}

export interface IWebMapImplicitSourceOptions extends IImplicitTilesetDecoratorOptions, ITileUrlTemplateOptions {
    id?: string;
    urlTemplates: string | readonly string[];
    metrics?: ITileMetrics;
    rootAddress?: ITileAddress;
    scheme?: WebMapScheme;
    minimumHeight?: number;
    maximumHeight?: number;
    geometricError?: (address: ITileAddress) => number;
    tileMetadata?: (address: ITileAddress) => IMetadataEntity | undefined;
    contentMetadata?: (address: ITileAddress, contentIndex: number) => IMetadataEntity | undefined;
    /** @deprecated Supply `metrics.minLOD` and `rootAddress` instead. */
    rootZoom?: number;
    /** @deprecated Supply `rootAddress.x` instead. */
    rootX?: number;
    /** @deprecated Supply `rootAddress.y` instead. */
    rootY?: number;
    /** @deprecated Supply `metrics.maxLOD` instead. */
    maximumZoom?: number;
    /** @deprecated Supply `metrics.tileSize` instead. */
    tileSize?: number;
}

export interface IWebMapImplicitSource {
    dataSource: WebMapTileDataSource;
    decorator: ImplicitTilesetDecorator;
    tileset: ITileset;
    resolver: ImplicitTilesetDecorator;
}

function assertSafeCoordinate(value: number, name: string): void {
    if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`${name} must be a non-negative safe integer.`);
}

/** XYZ or TMS pyramid whose metric and URL policy are source-owned. */
export class WebMapTileDataSource implements ITileDataSource {
    public readonly id: string;
    public readonly metrics: ITileMetrics;
    public readonly rootAddress: ITileAddress;
    public readonly urlTemplates: readonly string[];

    private readonly scheme: WebMapScheme;
    private readonly minimumHeight: number;
    private readonly maximumHeight: number;
    private readonly geometricErrorOverride: ((address: ITileAddress) => number) | undefined;
    private readonly tileMetadata: ((address: ITileAddress) => IMetadataEntity | undefined) | undefined;
    private readonly contentMetadata: ((address: ITileAddress, contentIndex: number) => IMetadataEntity | undefined) | undefined;
    private readonly templateOptions: ITileUrlTemplateOptions;

    public constructor(options: IWebMapTileDataSourceOptions) {
        this.id = options.id ?? "web-map";
        this.metrics = options.metrics;
        this.rootAddress = options.rootAddress ?? {
            lod: options.metrics.minLOD,
            x: 0,
            y: 0,
        };
        this.urlTemplates = typeof options.urlTemplates === "string" ? [options.urlTemplates] : [...options.urlTemplates];
        this.scheme = options.scheme ?? "XYZ";
        this.minimumHeight = options.minimumHeight ?? 0;
        this.maximumHeight = options.maximumHeight ?? 0;
        this.geometricErrorOverride = options.geometricError;
        this.tileMetadata = options.tileMetadata;
        this.contentMetadata = options.contentMetadata;
        this.templateOptions = {
            ...(options.subdomains ? { subdomains: [...options.subdomains] } : {}),
            ...(options.variables ? { variables: { ...options.variables } } : {}),
        };
        for (const template of this.urlTemplates) validateTileUrlTemplate(template, this.templateOptions);

        assertSafeCoordinate(this.rootAddress.lod, "Root LOD");
        assertSafeCoordinate(this.rootAddress.x, "Root X");
        assertSafeCoordinate(this.rootAddress.y, "Root Y");
        if (this.rootAddress.lod !== this.metrics.minLOD)
            throw new RangeError(`Root LOD ${this.rootAddress.lod} must equal metrics.minLOD ${this.metrics.minLOD}.`);
        if (this.maximumHeight < this.minimumHeight) throw new RangeError("maximumHeight must be greater than or equal to minimumHeight.");
    }

    public addressOf(coordinates: IImplicitCoordinates): ITileAddress {
        assertSafeCoordinate(coordinates.level, "Implicit level");
        assertSafeCoordinate(coordinates.x, "Implicit X");
        assertSafeCoordinate(coordinates.y, "Implicit Y");
        const scale = 2 ** coordinates.level;
        if (!Number.isSafeInteger(scale)) throw new RangeError(`Implicit level ${coordinates.level} exceeds the safe coordinate range.`);
        const lod = this.rootAddress.lod + coordinates.level;
        if (lod > this.metrics.maxLOD) throw new RangeError(`LOD ${lod} exceeds data source maxLOD ${this.metrics.maxLOD}.`);
        const x = this.rootAddress.x * scale + coordinates.x;
        const y =
            this.scheme === "XYZ" ? this.rootAddress.y * scale + (scale - 1 - coordinates.y) : this.rootAddress.y * scale + coordinates.y;
        const coordinateCount = 2 ** lod;
        if (x >= coordinateCount || y >= coordinateCount)
            throw new RangeError(`Tile ${lod}/${x}/${y} lies outside its addressable pyramid.`);
        return { lod, x, y };
    }

    /** Expands a template for an address in the data source convention. `{y}` follows the scheme; other variables use XYZ rows. */
    private urlOf(template: string, address: ITileAddress): string {
        if (this.scheme === "XYZ") return expandTileUrlTemplate(template, address, this.templateOptions);
        const xyzAddress = { lod: address.lod, x: address.x, y: toTmsY(address.y, address.lod) };
        return expandTileUrlTemplate(template.replaceAll("{y}", "{-y}"), xyzAddress, this.templateOptions);
    }

    public resolve(coordinates: IImplicitCoordinates, computedContents: readonly IContent[] = []): ITileDataSourceTile {
        const address = this.addressOf(coordinates);
        const xyzY = this.scheme === "XYZ" ? address.y : 2 ** address.lod - 1 - address.y;
        const northWest = this.metrics.getTileXYToLatLon(address.x, xyzY, address.lod);
        const southEast = this.metrics.getTileXYToLatLon(address.x + 1, xyzY + 1, address.lod);
        const contents = this.urlTemplates.map((template, index) => {
            const metadata = this.contentMetadata?.(address, index);
            return {
                ...(computedContents[index] ?? computedContents[0] ?? {}),
                uri: this.urlOf(template, address),
                ...(metadata ? { metadata } : {}),
            };
        });
        // The ground size of its largest cell: the projection stretches a tile towards the poles.
        const nearestToEquator =
            northWest.latitude >= 0 && southEast.latitude <= 0 ? 0 : Math.min(Math.abs(northWest.latitude), Math.abs(southEast.latitude));
        const geometricError = this.geometricErrorOverride?.(address) ?? this.metrics.groundResolution(nearestToEquator, address.lod);
        const metadata = this.tileMetadata?.(address);
        return {
            address,
            boundingVolume: {
                region: [
                    (northWest.longitude * Math.PI) / 180,
                    (southEast.latitude * Math.PI) / 180,
                    (southEast.longitude * Math.PI) / 180,
                    (northWest.latitude * Math.PI) / 180,
                    this.minimumHeight,
                    this.maximumHeight,
                ],
            },
            geometricError,
            contents,
            ...(metadata ? { metadata } : {}),
        };
    }
}

/** Compatibility factory that creates a source, then decorates it as 3D Tiles. */
export function createWebMapImplicitSource(options: IWebMapImplicitSourceOptions): IWebMapImplicitSource {
    const legacyMinLOD = options.rootZoom ?? 0;
    const legacyMaxLOD = options.maximumZoom;
    const metrics =
        options.metrics ??
        new WebMercatorTileMetrics({
            minLOD: legacyMinLOD,
            maxLOD:
                legacyMaxLOD ??
                (() => {
                    throw new RangeError("A Web Map source requires metrics or maximumZoom.");
                })(),
            ...(options.tileSize !== undefined ? { tileSize: options.tileSize } : {}),
        });
    if (options.maximumZoom !== undefined && options.maximumZoom !== metrics.maxLOD)
        throw new RangeError("maximumZoom conflicts with metrics.maxLOD. Metrics are authoritative.");
    if (options.tileSize !== undefined && options.tileSize !== metrics.tileSize)
        throw new RangeError("tileSize conflicts with metrics.tileSize. Metrics are authoritative.");

    const dataSource = new WebMapTileDataSource({
        ...(options.id !== undefined ? { id: options.id } : {}),
        urlTemplates: options.urlTemplates,
        metrics,
        ...(options.subdomains !== undefined ? { subdomains: options.subdomains } : {}),
        ...(options.variables !== undefined ? { variables: options.variables } : {}),
        rootAddress: options.rootAddress ?? {
            lod: options.rootZoom ?? metrics.minLOD,
            x: options.rootX ?? 0,
            y: options.rootY ?? 0,
        },
        ...(options.scheme !== undefined ? { scheme: options.scheme } : {}),
        ...(options.minimumHeight !== undefined ? { minimumHeight: options.minimumHeight } : {}),
        ...(options.maximumHeight !== undefined ? { maximumHeight: options.maximumHeight } : {}),
        ...(options.geometricError !== undefined ? { geometricError: options.geometricError } : {}),
        ...(options.tileMetadata !== undefined ? { tileMetadata: options.tileMetadata } : {}),
        ...(options.contentMetadata !== undefined ? { contentMetadata: options.contentMetadata } : {}),
    });
    const decorator = new ImplicitTilesetDecorator(dataSource, {
        ...(options.subtreeLevels !== undefined ? { subtreeLevels: options.subtreeLevels } : {}),
        ...(options.refine !== undefined ? { refine: options.refine } : {}),
    });
    return {
        dataSource,
        decorator,
        tileset: decorator.tileset,
        resolver: decorator,
    };
}
