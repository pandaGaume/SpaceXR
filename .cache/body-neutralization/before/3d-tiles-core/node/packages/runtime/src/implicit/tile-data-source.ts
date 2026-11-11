import type { IBoundingVolume, IContent, IMetadataEntity, ITileset } from "@spacexr/3d-tiles-core";

import type {
    IImplicitCoordinates,
    IImplicitTileAddressContext,
    IImplicitTileResolveContext,
    IImplicitTileResolver,
    IImplicitTileOverride,
} from "./types";
import type { ITileMetrics } from "./metrics";

export interface ITileAddress {
    /** Root of the address on a pyramid of several roots, such as the cube index; omitted for face 0. */
    face?: number;
    lod: number;
    x: number;
    y: number;
    z?: number;
}

export interface ITileDataSourceTile {
    address: ITileAddress;
    boundingVolume: IBoundingVolume;
    geometricError: number;
    contents: readonly IContent[];
    metadata?: IMetadataEntity;
}

/**
 * Owns the physical pyramid definition consumed by a tileset decorator.
 *
 * Metrics, addressing and URL templates belong to the data source. The 3D
 * Tiles implicit representation is only one possible view over this source.
 */
export interface ITileDataSource {
    readonly id: string;
    readonly metrics: Pick<ITileMetrics, "minLOD" | "maxLOD">;
    readonly rootAddress: ITileAddress;
    readonly urlTemplates: readonly string[];
    addressOf(coordinates: IImplicitCoordinates): ITileAddress;
    resolve(coordinates: IImplicitCoordinates, computedContents?: readonly IContent[]): ITileDataSourceTile;
}

export interface IImplicitTilesetDecoratorOptions {
    subtreeLevels?: number;
    refine?: "ADD" | "REPLACE";
}

function implicitTemplate(template: string): string {
    return template.replaceAll("{z}", "{level}").replaceAll("{lod}", "{level}");
}

/**
 * Presents an `ITileDataSource` as a standard implicit 3D Tiles tileset.
 *
 * The decorator owns no pyramid metric or URL policy. `availableLevels` is
 * derived from the source metrics and resolution delegates back to the source.
 */
export class ImplicitTilesetDecorator implements IImplicitTileResolver {
    public readonly tileset: ITileset;

    public constructor(
        public readonly dataSource: ITileDataSource,
        options: IImplicitTilesetDecoratorOptions = {},
    ) {
        const { metrics, rootAddress } = dataSource;
        if (rootAddress.lod !== metrics.minLOD)
            throw new RangeError(`The source root LOD ${rootAddress.lod} must equal metrics.minLOD ${metrics.minLOD}.`);
        if (dataSource.urlTemplates.length === 0) throw new RangeError("A tile data source must expose at least one URL template.");
        const subtreeLevels = options.subtreeLevels ?? 4;
        if (!Number.isInteger(subtreeLevels) || subtreeLevels < 1)
            throw new RangeError("Implicit subtreeLevels must be a positive integer.");

        const root = dataSource.resolve({ level: 0, x: 0, y: 0 });
        const templates = dataSource.urlTemplates.map((template, index) => ({
            ...(root.contents[index] ?? root.contents[0] ?? {}),
            uri: implicitTemplate(template),
        }));
        const contentShape =
            templates.length === 1
                ? { content: templates[0]! }
                : {
                      contents: templates as [IContent, ...IContent[]],
                  };
        this.tileset = {
            asset: { version: "1.1" },
            geometricError: root.geometricError,
            root: {
                boundingVolume: root.boundingVolume,
                geometricError: root.geometricError,
                refine: options.refine ?? "REPLACE",
                ...(root.metadata ? { metadata: root.metadata } : {}),
                ...contentShape,
                implicitTiling: {
                    subdivisionScheme: "QUADTREE",
                    subtreeLevels,
                    availableLevels: metrics.maxLOD - metrics.minLOD + 1,
                    subtrees: {
                        uri: "virtual-subtrees/{level}/{x}/{y}.subtree",
                    },
                },
            },
        };
    }

    /** Address of the tile in the source pyramid, shared by every decorator of the same pyramid. */
    public addressOf(context: IImplicitTileAddressContext): ITileAddress {
        return this.dataSource.addressOf(context.coordinates);
    }

    public resolve(context: IImplicitTileResolveContext): IImplicitTileOverride {
        const tile = this.dataSource.resolve(context.coordinates, context.computedContents);
        return {
            boundingVolume: tile.boundingVolume,
            geometricError: tile.geometricError,
            contents: tile.contents,
            ...(tile.metadata ? { metadata: tile.metadata } : {}),
        };
    }
}
