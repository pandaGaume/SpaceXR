/**
 * Dictionary object with extension-specific objects.
 */
export interface IExtension {
    [k: string]: {
        [k: string]: unknown;
    };
}
