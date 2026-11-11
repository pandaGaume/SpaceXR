import type { Scene } from "@babylonjs/core/scene.js";

import type { IBabylonTileResourceStatisticsProvider } from "../monitor/runtime-monitor";
import type { BabylonRasterPages } from "../raster/raster-pages";
import type { IEcefSpatialState, ITileActivationAdapter, ITilePresentationAdapter } from "@spacexr/3d-tiles-runtime";

import type { EdgeHeightPolicy, IGridElevationOptions } from "./mesh/geodesic-grid-pipeline";
import type { JunctionPolicy } from "./displayed-tiles";
import type { ITerrainTiling } from "./terrain-tiling";

/**
 * What every terrain engine receives. The terrain runtime, the DEM pyramid,
 * the imagery runtime and its pages are shared: only the way terrain tiles
 * become pixels changes from one engine to another.
 */
export interface ITerrainEngineInputs {
    scene: Scene;
    /** Layer of the debug labels placed over the tiles. */
    labelLayer: HTMLElement;
    /** Shaded grids when false, level-coloured wireframes when true. */
    wireframe: boolean;
    /** Geometry comes from the published runtime cut. The draped mode preserves existing integrations. */
    geometrySelection?: "runtime" | "draped";
    /** Uniform white ambient light, or terrain relief lighting. Defaults to terrain. */
    lighting?: "terrain" | "ambient";
    /** DEM heights; without them, tiles lie on the minimum of their region. */
    elevation?: IGridElevationOptions;
    /** Imagery pages presented by the imagery runtime, draped on shaded tiles. */
    imageryPages?: BabylonRasterPages;
    /** Optional Mapzen RGB provider normals. Mercator GPU uses them; CPU keeps its DEM-derived normals. */
    normalPages?: BabylonRasterPages;
    junctions: JunctionPolicy;
    edgeHeights: EdgeHeightPolicy;
    /** How tiles lie on the body. Defaults to Web Mercator on WGS84. */
    tiling?: ITerrainTiling;
}

/**
 * Renders the terrain tiles a runtime presents, with their draped imagery.
 *
 * Engines are interchangeable behind this interface: the mesh engine builds
 * one mesh per tile on the CPU, a GPU engine can instance one shared grid
 * displaced in its shader. The application only feeds the runtime ports and
 * calls the frame hooks.
 */
export interface ITerrainEngine<THandle = unknown>
    extends
        ITileActivationAdapter<IEcefSpatialState, THandle, never>,
        ITilePresentationAdapter<IEcefSpatialState, THandle, never>,
        IBabylonTileResourceStatisticsProvider {
    /** Name of the engine, as selected by the application. */
    readonly name: string;
    /** Work of the frame before `scene.render`, such as edge junctions and drape bindings. */
    beforeRender(): void;
    /** Work of the frame after `scene.render`, such as debug labels. */
    afterRender(): void;
    /** Multiplies DEM heights, from the next frames on. */
    setVerticalScale(scale: number): void;
    dispose(): void;
}
