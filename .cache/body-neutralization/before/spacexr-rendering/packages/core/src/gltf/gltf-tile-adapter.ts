import type { AssetContainer } from "@babylonjs/core/assetContainer.js";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader.js";
import type { Matrix } from "@babylonjs/core/Maths/math.vector.js";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode.js";
import type { Scene } from "@babylonjs/core/scene.js";
import { TilesetJsonCodec } from "@spacexr/3d-tiles-core";
import {
    StandardUriResolver,
    type ContentLoadResult,
    type IEcefSpatialState,
    type IRuntimeUriResolver,
    type ITileActivationAdapter,
    type ITileActivationContext,
    type ITileDeactivationContext,
    type ITilePresentationAdapter,
    type ITilePresentationContext,
    verticalDisplacement,
    type IVerticalPlacement,
} from "@spacexr/3d-tiles-runtime";

import { createBabylonTileMatrix } from "../spatial/tile-matrix";
import type { CopyrightAttributions } from "./attributions";
import { detectTileContentFormat } from "./content-format";
import { extractGltfCopyrights } from "./copyrights";

/** Babylon resources of one glTF tile content. */
export interface IBabylonGltfTileHandle {
    readonly container: AssetContainer;
    /** Parent of the imported nodes, carrying the tile transform. */
    readonly root: TransformNode;
    /** Spatial state of the tile the content was loaded for. */
    readonly spatial: IEcefSpatialState;
    readonly copyrights: readonly string[];
    /** Contents currently presenting this handle. */
    readonly presentations: Set<string>;
    addedToScene: boolean;
    disposed: boolean;
}

export interface IBabylonGltfTileAdapterOptions {
    /** Computes the base URI of external tilesets. Defaults to `StandardUriResolver`. */
    resolver?: IRuntimeUriResolver;
    /** Defaults to the global `fetch`. */
    fetch?: typeof fetch;
    /** Merged over `credentials: "omit"` and an `Accept` header for glTF and JSON. */
    requestInit?: RequestInit;
    /** Builds the error of an unsuccessful response, for example to redact credentials from the URL. */
    createRequestError?: (response: Response, uri: string) => Error | Promise<Error>;
    /** Receives the glTF `asset.copyright` sources of presented content. */
    attributions?: CopyrightAttributions;
    /**
     * Moves the content with the vertical scale of the scene. The spatial metric of the runtime takes the same placement,
     * for the bounds, and the runtime the same scale.
     */
    vertical?: IVerticalPlacement;
}

const tilesetCodec = new TilesetJsonCodec();

function defaultRequestError(response: Response, uri: string): Error {
    return new Error(`Tile content request failed with HTTP ${response.status}: ${response.url || uri}`);
}

/**
 * Loads glTF 2.0 tile content (`.glb` or `.gltf`) and external tilesets into a Babylon scene, through the split
 * activation and presentation ports of the runtime.
 *
 * Formats are recognized from the payload bytes. Legacy `b3dm`, `i3dm`, `pnts` and `cmpt` content is reported as a
 * failure. The Babylon glTF loader must be registered by the application, for example with
 * `import "@babylonjs/loaders/glTF/2.0/index.js"`.
 */
export class BabylonGltfTileAdapter<TGlyphHandle = never>
    implements
        ITileActivationAdapter<IEcefSpatialState, IBabylonGltfTileHandle, TGlyphHandle>,
        ITilePresentationAdapter<IEcefSpatialState, IBabylonGltfTileHandle, TGlyphHandle>
{
    private readonly resolver: IRuntimeUriResolver;
    private readonly fetch: typeof fetch;
    private readonly requestInit: RequestInit;
    private readonly createRequestError: (response: Response, uri: string) => Error | Promise<Error>;
    private readonly attributions: CopyrightAttributions | undefined;
    private readonly vertical: IVerticalPlacement | undefined;
    private readonly handles = new Set<IBabylonGltfTileHandle>();
    private readonly stopVerticalScale: (() => void) | undefined;

    public constructor(
        private readonly scene: Scene,
        options: IBabylonGltfTileAdapterOptions = {},
    ) {
        this.resolver = options.resolver ?? new StandardUriResolver();
        this.fetch = options.fetch ?? ((input, init) => globalThis.fetch(input, init));
        const headers = new Headers(options.requestInit?.headers);
        if (!headers.has("Accept")) headers.set("Accept", "model/gltf-binary, model/gltf+json, application/json");
        this.requestInit = { credentials: "omit", ...options.requestInit, headers };
        this.createRequestError = options.createRequestError ?? defaultRequestError;
        this.attributions = options.attributions;
        this.vertical = options.vertical;
        this.stopVerticalScale = options.vertical?.scale.subscribe(() => {
            for (const handle of this.handles) handle.root.setPreTransformMatrix(this.tileMatrix(handle.spatial));
        });
    }

    public async activate(context: ITileActivationContext<IEcefSpatialState, IBabylonGltfTileHandle, TGlyphHandle>): Promise<void> {
        for (const content of context.pendingContents) {
            if (context.signal.aborted) {
                await context.readiness.cancelled(content.id);
                continue;
            }
            try {
                const result = await this.load(content.uri, content.id, context.tile.spatial, context.signal);
                const accepted = await context.readiness.ready(content.id, result);
                if (!accepted && result.kind === "renderable") this.disposeHandle(result.handle);
            } catch (error) {
                if (context.signal.aborted) await context.readiness.cancelled(content.id);
                else await context.readiness.failed(content.id, error);
            }
        }
    }

    public deactivate(_context: ITileDeactivationContext<IEcefSpatialState, IBabylonGltfTileHandle, TGlyphHandle>): void {
        // Selection and presentation stay separate: the runtime hides content once its replacement is ready.
    }

    public present(context: ITilePresentationContext<IEcefSpatialState, IBabylonGltfTileHandle, TGlyphHandle>): void {
        for (const { content, handle } of context.resources) {
            if (handle.disposed) continue;
            if (handle.presentations.size === 0) {
                if (!handle.addedToScene) {
                    handle.container.addAllToScene();
                    handle.addedToScene = true;
                }
                handle.root.setEnabled(true);
            }
            handle.presentations.add(content.id);
            this.attributions?.attach(content.id, handle.copyrights);
        }
    }

    public hide(context: ITilePresentationContext<IEcefSpatialState, IBabylonGltfTileHandle, TGlyphHandle>): void {
        for (const { content, handle } of context.resources) {
            handle.presentations.delete(content.id);
            this.attributions?.detach(content.id);
            if (handle.presentations.size === 0) handle.root.setEnabled(false);
        }
    }

    public release(context: ITilePresentationContext<IEcefSpatialState, IBabylonGltfTileHandle, TGlyphHandle>): void {
        for (const { handle } of context.resources) this.disposeHandle(handle);
    }

    /** Stops following the vertical scale. The content is released by the runtime. */
    public dispose(): void {
        this.stopVerticalScale?.();
    }

    private async load(
        uri: string,
        contentId: string,
        spatial: IEcefSpatialState,
        signal: AbortSignal,
    ): Promise<ContentLoadResult<IBabylonGltfTileHandle>> {
        const response = await this.fetch(uri, { ...this.requestInit, signal });
        if (!response.ok) throw await this.createRequestError(response, uri);
        const documentUri = response.url || uri;
        const buffer = await response.arrayBuffer();
        if (signal.aborted) throw signal.reason;

        const bytes = new Uint8Array(buffer);
        const format = detectTileContentFormat(bytes);
        if (format === "tileset") {
            return {
                kind: "external-tileset",
                tileset: tilesetCodec.decode(new TextDecoder().decode(bytes)),
                documentUri,
                baseUri: this.resolver.baseOf(documentUri),
            };
        }
        if (format !== "glb" && format !== "gltf") {
            throw new Error(`Unsupported tile content format "${format}": ${documentUri}`);
        }

        const container = await LoadAssetContainerAsync(bytes, this.scene, {
            pluginExtension: format === "glb" ? ".glb" : ".gltf",
            // External buffers and images of a .gltf asset are relative to its document.
            rootUrl: this.resolver.baseOf(documentUri),
            name: `tile-${contentId}`,
        });
        if (signal.aborted) {
            container.dispose();
            throw signal.reason;
        }
        const handle = this.createHandle(container, contentId, spatial, extractGltfCopyrights(buffer));
        return {
            kind: "renderable",
            handle,
            mediaType: response.headers.get("content-type") ?? (format === "glb" ? "model/gltf-binary" : "model/gltf+json"),
            cacheKey: documentUri,
            cost: {
                networkBytes: buffer.byteLength,
                cpuBytes: buffer.byteLength,
                gpuBytes: buffer.byteLength,
            },
        };
    }

    private createHandle(
        container: AssetContainer,
        contentId: string,
        spatial: IEcefSpatialState,
        copyrights: readonly string[],
    ): IBabylonGltfTileHandle {
        const importedRoots = [...container.rootNodes];
        const root = new TransformNode(`tile-root-${contentId}`, this.scene);
        root.setPreTransformMatrix(this.tileMatrix(spatial));
        root.setEnabled(false);
        for (const node of importedRoots) node.parent = root;
        // The root belongs to the container, so that addAllToScene and dispose include it.
        container.transformNodes.push(root);
        container.populateRootNodes();
        this.scene.removeTransformNode(root);
        const handle: IBabylonGltfTileHandle = {
            container,
            root,
            spatial,
            copyrights,
            presentations: new Set<string>(),
            addedToScene: false,
            disposed: false,
        };
        this.handles.add(handle);
        return handle;
    }

    private tileMatrix(spatial: IEcefSpatialState): Matrix {
        return createBabylonTileMatrix(spatial, this.vertical && verticalDisplacement(spatial.verticalAnchor, this.vertical));
    }

    private disposeHandle(handle: IBabylonGltfTileHandle): void {
        if (handle.disposed) return;
        handle.disposed = true;
        this.handles.delete(handle);
        for (const contentId of handle.presentations) this.attributions?.detach(contentId);
        handle.presentations.clear();
        handle.container.dispose();
    }
}
