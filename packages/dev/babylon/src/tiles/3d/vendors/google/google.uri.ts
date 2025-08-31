import { IUriResolver } from "../../engine";

const __errorGoggle__: number[] = [64, 64, 64, 32, 32, 32, 16, 16, 16, 10];
export function GoogleTile3dErrorFn(depth: number): number {
    const i = Math.min(depth, __errorGoggle__.length - 1);
    return __errorGoggle__[i];
}

/**
 * GoogleTiles3dUriResolver
 *
 * This class ensures that all URIs used to fetch 3D Tiles from the Google Maps Tile API
 * include the required `key` and `session` query parameters.
 *
 * Why this is necessary:
 * - The Google Maps Tile API sometimes omits the `session` token in nested tile URIs,
 *   especially when loading sub-tilesets or content files (e.g., `.glb`, `.json`).
 * - Missing session tokens can lead to HTTP 403 or 400 errors, breaking tile loading.
 * - This resolver captures the session token from the first URI that includes it,
 *   and ensures it is consistently appended to all subsequent requests.
 * - It also replaces any existing `key` or `session` parameters to avoid duplication or conflicts.
 *
 * Usage:
 * - Instantiate with your API key.
 * - Optionally provide a session token, or let the resolver extract it from the first valid URI.
 * - Use `resolve(uri)` to safely rewrite tile URIs before loading.
 */
export class GoogleTiles3dUriResolver implements IUriResolver {
    constructor(public readonly apiKey: string, public sessionToken: string | null = null) {}

    resolve(uri: string): string {
        // Normalize HTML-encoded ampersands
        const normalizedUri = uri.replace(/&amp;amp;/g, "&").replace(/&amp;/g, "&");
        const url = new URL(normalizedUri);

        const incomingSession = url.searchParams.get("session");

        // If URI has a session and we don't yet have one, store it
        if (incomingSession && !this.sessionToken) {
            this.sessionToken = incomingSession;
        }

        // Always set or replace the session if we have one
        if (this.sessionToken) {
            url.searchParams.set("session", this.sessionToken);
        }

        // Always set or replace the API key
        url.searchParams.set("key", this.apiKey);

        return url.toString();
    }
}
