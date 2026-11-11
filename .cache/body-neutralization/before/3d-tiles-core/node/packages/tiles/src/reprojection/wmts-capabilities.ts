import type { ISourceTileMatrix } from "./source-tile-matrix";

/** A layer read from a WMTS capabilities document. */
export interface IWmtsLayer {
    identifier: string;
    /** `SupportedCRS` as written: Moon Trek polar layers write `EPSG::0`, so the projection must come from elsewhere. */
    crs: string | undefined;
    /** Media type of the tiles. An 8-bit format is for display: it holds no elevation. */
    format: string | undefined;
    style: string;
    tileMatrixSet: string;
    /** Coverage of the layer in map units, `[minX, minY, maxX, maxY]`. */
    boundingBox: readonly [number, number, number, number] | undefined;
    /** REST template, with `{Style}`, `{TileMatrixSet}`, `{TileMatrix}`, `{TileRow}` and `{TileCol}`. */
    resourceUrl: string | undefined;
    /** Levels from the coarsest. */
    matrices: readonly ISourceTileMatrix[];
}

/** Metres per pixel of a WMTS scale denominator: 0.28 mm per pixel on the sheet. */
const METRES_PER_SCALE = 0.00028;

function block(source: string, tag: string): string[] {
    return [...source.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "g"))].map((match) => match[1]!);
}

function text(source: string, tag: string): string | undefined {
    return new RegExp(`<${tag}(?:\\s[^>]*)?>\\s*([^<]*?)\\s*</${tag}>`).exec(source)?.[1];
}

function numbers(value: string | undefined): number[] {
    return (value ?? "").trim().split(/\s+/).filter(Boolean).map(Number);
}

function required(value: string | undefined, name: string): string {
    if (value === undefined || value === "") throw new RangeError(`The WMTS capabilities miss ${name}.`);
    return value;
}

/**
 * Reads a WMTS capabilities document, whose tiles are images, so in `area` registration, without any XML library, so that it also runs in a Cloudflare Worker, which has no
 * `DOMParser`. Comments are ignored: Moon Trek leaves old tile matrices in them.
 *
 * Pixel sizes come from the geometry of the matrix: the rows of a level span the origin symmetrically, so a pixel is
 * `2 * originY / (MatrixHeight * TileHeight)`, in degrees or in metres. `ScaleDenominator` is not reliable: it assumes
 * degrees on the Earth (about 111 195 m) on geographic layers, whatever the body, and is 0.64 % off on the polar layers of
 * Mars, whose tiles only line up with the pixel size above. It is only used when the origin is 0.
 *
 * @param xml - The document.
 * @param layerIdentifier - Layer to read. Defaults to the first one.
 * @throws RangeError When the document, the layer or a value it needs is missing or invalid.
 */
export function parseWmtsCapabilities(xml: string, layerIdentifier?: string): IWmtsLayer {
    const source = xml.replace(/<!--[\s\S]*?-->/g, "");
    const layers = block(source, "Layer");
    const layer = layerIdentifier === undefined ? layers[0] : layers.find((candidate) => text(candidate, "ows:Identifier") === layerIdentifier);
    if (layer === undefined) throw new RangeError(`The WMTS capabilities have no layer ${layerIdentifier ?? ""}.`.trim());
    const set = required(text(required(block(layer, "TileMatrixSetLink")[0], "TileMatrixSetLink"), "TileMatrixSet"), "TileMatrixSet");
    const definition = block(source, "TileMatrixSet").find((candidate) => text(candidate, "ows:Identifier") === set);
    if (definition === undefined) throw new RangeError(`The WMTS capabilities do not define the tile matrix set ${set}.`);

    const matrices = block(definition, "TileMatrix").map((matrix): ISourceTileMatrix => {
        const identifier = required(text(matrix, "ows:Identifier"), "a TileMatrix identifier");
        let corner = numbers(text(matrix, "TopLeftCorner"));
        // WMTS may write geographic corners latitude first.
        if (corner.length === 2 && Math.abs(corner[1]!) > 90 && Math.abs(corner[1]!) <= 180 && Math.abs(corner[0]!) <= 90) corner = [corner[1]!, corner[0]!];
        const [originX, originY] = corner;
        const scale = Number(text(matrix, "ScaleDenominator"));
        const tileWidth = Number(text(matrix, "TileWidth"));
        const tileHeight = Number(text(matrix, "TileHeight"));
        const matrixWidth = Number(text(matrix, "MatrixWidth"));
        const matrixHeight = Number(text(matrix, "MatrixHeight"));
        if (![originX, originY, tileWidth, tileHeight, matrixWidth, matrixHeight].every((value) => Number.isFinite(value)) || !(tileWidth > 0)) {
            throw new RangeError(`The tile matrix ${identifier} is invalid.`);
        }
        const pixelSize = originY !== 0 ? (2 * Math.abs(originY!)) / (matrixHeight * tileHeight) : scale * METRES_PER_SCALE;
        if (!(pixelSize > 0)) throw new RangeError(`The tile matrix ${identifier} has no pixel size.`);
        return { identifier, registration: "area", originX: originX!, originY: originY!, pixelSize, tileWidth, tileHeight, matrixWidth, matrixHeight };
    });
    if (matrices.length === 0) throw new RangeError(`The tile matrix set ${set} has no tile matrix.`);

    const box = block(layer, "ows:BoundingBox")[0];
    const lower = numbers(box && text(box, "ows:LowerCorner"));
    const upper = numbers(box && text(box, "ows:UpperCorner"));
    const style = block(layer, "Style")[0];
    return {
        identifier: required(text(layer, "ows:Identifier"), "a layer identifier"),
        crs: text(definition, "ows:SupportedCRS"),
        format: text(layer, "Format"),
        style: (style && text(style, "ows:Identifier")) ?? "default",
        tileMatrixSet: set,
        boundingBox: lower.length === 2 && upper.length === 2 ? [lower[0]!, lower[1]!, upper[0]!, upper[1]!] : undefined,
        resourceUrl: /<ResourceURL[^>]*\stemplate="([^"]+)"/.exec(layer)?.[1],
        matrices,
    };
}

/**
 * URL of a tile of a WMTS layer. Empty path segments are removed: Moon Trek templates hold `1.0.0//{Style}`.
 *
 * @throws RangeError When the layer has no REST template.
 */
export function wmtsTileUrl(layer: IWmtsLayer, matrix: ISourceTileMatrix, row: number, column: number): string {
    if (layer.resourceUrl === undefined) throw new RangeError(`The layer ${layer.identifier} has no REST template.`);
    const url = layer.resourceUrl
        .replaceAll("{Style}", layer.style)
        .replaceAll("{style}", layer.style)
        .replaceAll("{TileMatrixSet}", layer.tileMatrixSet)
        .replaceAll("{TileMatrix}", matrix.identifier)
        .replaceAll("{TileRow}", String(row))
        .replaceAll("{TileCol}", String(column));
    return url.replace(/([^:/])\/{2,}/g, "$1/");
}
