import { ICameraState } from "../../navigation";
import { IDisplay } from "../../map";
import { IStreamingTile, IStreamingTileset } from "./tile3d.streaming.interfaces";
import { SourceBlock } from "../../pipeline/tiles.pipeline.sourceblock";
import { ICodec } from "../../codecs";
import { Nullable } from "../../../types";
import { WebClient } from "../../../io/webClient";
import { TextUtils } from "../../../utils/text";

export class TilesetCodec implements ICodec<IStreamingTileset> {
    public async decodeAsync(r: void | Response): Promise<Nullable<IStreamingTileset>> {
        return r instanceof Response ? ((await r.json()) as IStreamingTileset) : null;
    }
}

export class Tile3dStreamingEngineOptions {
    static readonly Default: Tile3dStreamingEngineOptions = {
        tilesetExtension: "json",
    };

    tilesetExtension?: string;
}

export class TileNode {
    tile: IStreamingTile;
    parent: Nullable<TileNode>;
    children: Array<TileNode>;
    tilesetUri: string; // The URI of the tileset it belongs to

    constructor(tile: IStreamingTile, tilesetUri: string, parent: TileNode | null = null) {
        this.tile = tile;
        this.parent = parent;
        this.children = [];
        this.tilesetUri = tilesetUri;
    }

    addChild(child: TileNode) {
        this.children.push(child);
    }
}

export class TilesetCache {
    private cache: Map<string, IStreamingTileset>; // Tileset URI -> Tileset

    constructor() {
        this.cache = new Map();
    }

    get(tilesetUri: string): IStreamingTileset | null {
        return this.cache.get(tilesetUri) || null;
    }

    set(tilesetUri: string, tileset: IStreamingTileset): void {
        this.cache.set(tilesetUri, tileset);
    }

    has(tilesetUri: string): boolean {
        return this.cache.has(tilesetUri);
    }
}

export class Tile3dStreamingEngine extends SourceBlock<TileNode> {
    _uri: string;
    _cache: TilesetCache;
    _root: Nullable<TileNode>;
    _client: WebClient<string, IStreamingTileset>;
    _options: Tile3dStreamingEngineOptions;

    public constructor(uri: string, options?: Tile3dStreamingEngineOptions) {
        super();
        this._uri = uri;
        this._root = null;
        this._cache = new TilesetCache();
        this._client = new WebClient<string, IStreamingTileset>(uri, new TilesetCodec());
        this._options = { ...Tile3dStreamingEngineOptions.Default, ...options };
    }

    public setContext(state: Nullable<ICameraState>, display: Nullable<IDisplay>): void {
        if (!state || !display) {
            this._doClearContext();
            return;
        }
        this._doValidateContext(state, display);
    }

    protected _doClearContext(): void {}

    protected _doValidateContext(state: Nullable<ICameraState>, display: Nullable<IDisplay>): void {
        if (!state || !display) {
            this._doClearContext();
            return;
        }

        if (this._root === null) {
            // Fetch root tileset asynchronously, then retry validation
            this._doFetchTilesetAsync(this._uri).then((tileset) => {
                if (tileset) {
                    this._root = new TileNode(tileset.root, this._uri, null);
                    this._doValidateContext(state, display);
                }
            });
            return;
        }
        // Start browsing the hierarchy from the root tile
        this._browseTilesetHierarchy(this._root.tile, state, display, this._uri);
    }

    protected async _browseTilesetHierarchy(tile: Nullable<IStreamingTile>, state: ICameraState, display: IDisplay, baseUrl: string): Promise<void> {
        if (!tile) return;

        // Check if the tile is visible
        if (!this._isTileVisible(tile, state, display)) {
            return;
        }

        // Fetch missing content
        const uri = tile.content?.uri;
        const ext = uri ? TextUtils.GetUriExtension(uri)?.toLowerCase() : null;
        if (uri && ext && ext === (this._options.tilesetExtension?.toLowerCase() ?? "json")) {
            const contentUrl = new URL(uri, baseUrl).toString();
            // console.log(`Fetching tile content: ${contentUrl}`);
            const tileset = await this._doFetchTilesetAsync(contentUrl);
            if (tileset && tileset.root) {
                // console.log(`Tileset loaded: ${contentUrl}`);
                // Process its children recursively
                await this._browseTilesetHierarchy(tileset.root, state, display, contentUrl);
            }
        }

        // Recursively process children
        if (tile.children) {
            for (const child of tile.children) {
                await this._browseTilesetHierarchy(child, state, display, baseUrl);
            }
        }
    }

    protected _isTileVisible(tile: IStreamingTile, state: ICameraState, display: IDisplay): boolean {
        return true; // Placeholder (Replace with real visibility logic)
    }

    protected async _doFetchTilesetAsync(uri: string): Promise<Nullable<IStreamingTileset>> {
        const result = await this._client.fetchAsync(this._uri);
        return result.content;
    }
}
