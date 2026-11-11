import type { IBoundingVolume, IContent, ITile } from "@spacexr/3d-tiles-core";

import type { IRuntimeImplicitTile } from "../implicit/types";
import type { IRuntimeFeatureMetadata, IMetadataSnapshot } from "../metadata/types";
import type { IRuntimeResourceCost } from "../runtime/cache";
import type { IRuntimeTilesetDocument } from "../runtime/contracts";
import {
    NO_METADATA,
    TileContentKind,
    TilePresentationState,
    TileReadinessState,
    type MetadataHandle,
    type TileMetadataState,
    type TileRefinementMode,
    type TileSelectionState,
} from "./states";

const SELECTION_SHIFT = 0;
const SELECTION_MASK = 0b0000_0001;
const READINESS_SHIFT = 1;
const READINESS_MASK = 0b0000_1110;
const PRESENTATION_SHIFT = 4;
const PRESENTATION_MASK = 0b0011_0000;
const METADATA_SHIFT = 6;
const METADATA_MASK = 0b1100_0000;

export class Tile3DContent<TRenderHandle> {
    public status = TileReadinessState.Idle;
    public kind = TileContentKind.Unknown;
    public attempts = 0;
    public attached = false;
    public lastTouchedFrame: number;
    public readyFrame = -1;
    public handle?: TRenderHandle;
    public featureMetadata?: readonly IRuntimeFeatureMetadata[];
    public cacheKey?: string;
    public cost?: IRuntimeResourceCost;
    public error?: unknown;
    public metadataHandle: MetadataHandle = NO_METADATA;
    public featureMetadataHandle: MetadataHandle = NO_METADATA;

    public constructor(
        public readonly id: string,
        public readonly descriptor: IContent,
        public readonly uri: string,
        frame: number,
    ) {
        this.lastTouchedFrame = frame;
    }

    public get ready(): boolean {
        return this.kind === TileContentKind.Renderable && this.status === TileReadinessState.Ready && this.handle !== undefined;
    }
}

export interface ITile3DInitialization<TSpatial, TRenderHandle, TGlyphHandle> {
    id: string;
    source: ITile;
    document: IRuntimeTilesetDocument;
    parent?: Tile3D<TSpatial, TRenderHandle, TGlyphHandle>;
    implicit?: IRuntimeImplicitTile;
    depth: number;
    refinementMode: TileRefinementMode;
    spatial: TSpatial;
    contents: Array<Tile3DContent<TRenderHandle>>;
    frame: number;
}

/** Renderer-neutral runtime tile with compact numeric pipeline state. */
export class Tile3D<TSpatial, TRenderHandle = unknown, TGlyphHandle = unknown> {
    public readonly id: string;
    public readonly source: ITile;
    public readonly document: IRuntimeTilesetDocument;
    public readonly parent: Tile3D<TSpatial, TRenderHandle, TGlyphHandle> | undefined;
    public readonly implicit: IRuntimeImplicitTile | undefined;
    public children: Array<Tile3D<TSpatial, TRenderHandle, TGlyphHandle>> = [];
    public readonly depth: number;
    public readonly refinementMode: TileRefinementMode;
    /** Derived spatial state. Replaced when loaded content reports a tighter tile bounding volume. */
    public spatial: TSpatial;
    /** True once the tile own content reported its measured bounding volume; parent refreshes no longer apply. */
    public contentBoundsRefined = false;
    /** The volume measured on the content, when it reported one. */
    public contentBounds: (() => IBoundingVolume) | undefined = undefined;
    /** Heights measured on the content, kept with its bounding volume. */
    public contentHeights: (() => readonly [number, number]) | undefined = undefined;
    public readonly contents: Array<Tile3DContent<TRenderHandle>>;
    /** In the view of the camera. A visible tile is always active. */
    public visible = false;
    /** Kept by the selection: visible, in the periphery of the view, or a neighbour of a visible tile. */
    public active = false;
    public screenSpaceError = 0;
    public priority = 0;
    public activationId = 0;
    public glyphHandles: Array<TGlyphHandle> = [];
    public metadataSnapshots: readonly IMetadataSnapshot[] = [];
    public metadataHandle: MetadataHandle = NO_METADATA;
    public lastTouchedFrame: number;

    private stateBits = 0;

    public constructor(initialization: ITile3DInitialization<TSpatial, TRenderHandle, TGlyphHandle>) {
        this.id = initialization.id;
        this.source = initialization.source;
        this.document = initialization.document;
        this.parent = initialization.parent;
        this.implicit = initialization.implicit;
        this.depth = initialization.depth;
        this.refinementMode = initialization.refinementMode;
        this.spatial = initialization.spatial;
        this.contents = initialization.contents;
        this.lastTouchedFrame = initialization.frame;
    }

    public get selectionState(): TileSelectionState {
        return ((this.stateBits & SELECTION_MASK) >> SELECTION_SHIFT) as TileSelectionState;
    }

    public set selectionState(state: TileSelectionState) {
        this.stateBits = (this.stateBits & ~SELECTION_MASK) | (state << SELECTION_SHIFT);
    }

    public get readinessState(): TileReadinessState {
        return ((this.stateBits & READINESS_MASK) >> READINESS_SHIFT) as TileReadinessState;
    }

    public set readinessState(state: TileReadinessState) {
        this.stateBits = (this.stateBits & ~READINESS_MASK) | (state << READINESS_SHIFT);
    }

    public get presentationState(): TilePresentationState {
        return ((this.stateBits & PRESENTATION_MASK) >> PRESENTATION_SHIFT) as TilePresentationState;
    }

    public set presentationState(state: TilePresentationState) {
        this.stateBits = (this.stateBits & ~PRESENTATION_MASK) | (state << PRESENTATION_SHIFT);
    }

    public get metadataState(): TileMetadataState {
        return ((this.stateBits & METADATA_MASK) >> METADATA_SHIFT) as TileMetadataState;
    }

    public set metadataState(state: TileMetadataState) {
        this.stateBits = (this.stateBits & ~METADATA_MASK) | (state << METADATA_SHIFT);
    }

    /** Compatibility view for the currently presented cut. */
    public get selected(): boolean {
        return this.presentationState === TilePresentationState.Visible;
    }

    public set selected(selected: boolean) {
        this.presentationState = selected ? TilePresentationState.Visible : TilePresentationState.Hidden;
    }

    public get readyToRender(): boolean {
        const renderable = this.contents.filter((content) => content.kind === TileContentKind.Renderable);
        return renderable.length > 0 && renderable.every((content) => content.ready);
    }
}
