import { assertValidTileAddress, tileAddressToQuadkey, toTmsY, type ITileAddress } from "../addressing";

/** Options used to expand a tile URL template. */
export interface ITileUrlTemplateOptions {
    /** Values substituted for `{s}`. Required when the template contains `{s}`. */
    subdomains?: readonly string[];
    /**
     * Application variables, for example `{format}` or `{accessToken}`.
     * Values are URI-encoded. Built-in variable names cannot be redefined.
     */
    variables?: Readonly<Record<string, string | number>>;
}

/** Raised when a template contains an unknown variable or misses a required option. */
export class TileUrlTemplateError extends Error {
    public constructor(message: string) {
        super(message);
        this.name = "TileUrlTemplateError";
    }
}

/**
 * Variables provided for every tile.
 *
 * - `{z}`, `{lod}`, `{level}`: level of detail.
 * - `{x}`: column, growing eastward.
 * - `{y}`: XYZ row, growing southward.
 * - `{-y}`: TMS row, growing northward.
 * - `{quadkey}`: Bing Maps quadkey, within the face.
 * - `{face}`: face of the cube index, 0 for single-root pyramids.
 * - `{s}`: subdomain, chosen as `subdomains[(x + y) % subdomains.length]` so a tile always maps to the same host.
 */
export const BUILT_IN_TILE_URL_VARIABLES: readonly string[] = ["z", "lod", "level", "x", "y", "-y", "quadkey", "face", "s"];

const VARIABLE_PATTERN = /\{(-?[A-Za-z_][A-Za-z0-9_]*)\}/g;

/** Lists the variable names of a template, without braces, in order of appearance. */
export function tileUrlTemplateVariables(template: string): string[] {
    return [...template.matchAll(VARIABLE_PATTERN)].map((match) => match[1]!);
}

/**
 * Checks that every variable of a template can be expanded with the given options.
 *
 * @throws TileUrlTemplateError When a variable is unknown, when `{s}` has no subdomains, or when an
 * application variable redefines a built-in variable.
 */
export function validateTileUrlTemplate(template: string, options: ITileUrlTemplateOptions = {}): void {
    const variables = options.variables ?? {};
    for (const name of Object.keys(variables)) {
        if (BUILT_IN_TILE_URL_VARIABLES.includes(name)) throw new TileUrlTemplateError(`Variable {${name}} is built in and cannot be redefined.`);
    }
    for (const name of tileUrlTemplateVariables(template)) {
        if (name === "s") {
            if (!options.subdomains || options.subdomains.length === 0) throw new TileUrlTemplateError(`Template "${template}" uses {s} but no subdomains were supplied.`);
        } else if (!BUILT_IN_TILE_URL_VARIABLES.includes(name) && !Object.hasOwn(variables, name)) {
            throw new TileUrlTemplateError(`Template "${template}" uses unknown variable {${name}}.`);
        }
    }
}

/**
 * Expands a tile URL template for an XYZ address.
 *
 * @throws TileUrlTemplateError See {@link validateTileUrlTemplate}.
 * @throws RangeError When the address lies outside its pyramid level.
 */
export function expandTileUrlTemplate(template: string, address: ITileAddress, options: ITileUrlTemplateOptions = {}): string {
    validateTileUrlTemplate(template, options);
    assertValidTileAddress(address);
    const variables = options.variables ?? {};
    return template.replace(VARIABLE_PATTERN, (_match, name: string) => {
        switch (name) {
            case "z":
            case "lod":
            case "level":
                return String(address.lod);
            case "x":
                return String(address.x);
            case "y":
                return String(address.y);
            case "-y":
                return String(toTmsY(address.y, address.lod));
            case "quadkey":
                return tileAddressToQuadkey(address);
            case "face":
                return String(address.face ?? 0);
            case "s": {
                const subdomains = options.subdomains!;
                return subdomains[(address.x + address.y) % subdomains.length]!;
            }
            default:
                return encodeURIComponent(String(variables[name]));
        }
    });
}
