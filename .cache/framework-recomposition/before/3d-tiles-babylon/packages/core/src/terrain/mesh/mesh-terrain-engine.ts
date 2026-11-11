import type {
    IEcefSpatialState,
    ITileActivationContext,
    ITileDeactivationContext,
    ITilePresentationContext,
} from "@spacexr/3d-tiles-runtime";

import { MeshRasterDrape } from "../../draping/mesh/mesh-raster-drape";
import { BabylonGeodesicGridPipeline, type IBabylonGeodesicGridHandle } from "./geodesic-grid-pipeline";
import { TERRAIN_CONFIG } from "../terrain-config";
import type { ITerrainEngine, ITerrainEngineInputs } from "../terrain-engine";

export interface IMeshTerrainEngineOptions {
    /** Cells per grid side. Defaults to {@link TERRAIN_CONFIG}, like the GPU engine. */
    cells?: number;
    /** Deepest drape below each terrain tile: up to `4^maxDrapeDepth` imagery pages per tile. Defaults to {@link TERRAIN_CONFIG}. */
    maxDrapeDepth?: number;
    /** Main-thread time per frame for rebuilding grids whose neighbours changed, in milliseconds. Defaults to {@link TERRAIN_CONFIG}. */
    junctionBudgetMilliseconds?: number;
}

type Activation = ITileActivationContext<IEcefSpatialState, IBabylonGeodesicGridHandle, never>;
type Deactivation = ITileDeactivationContext<IEcefSpatialState, IBabylonGeodesicGridHandle, never>;
type Presentation = ITilePresentationContext<IEcefSpatialState, IBabylonGeodesicGridHandle, never>;

/**
 * The CPU terrain engine: one mesh per terrain tile, built from the DEM with
 * its edge junctions and surface normals, and draped with `4^k` imagery pages
 * chosen by the imagery cut.
 */
export class MeshTerrainEngine implements ITerrainEngine<IBabylonGeodesicGridHandle> {
    public readonly name = "mesh";
    /** Meshes of the terrain tiles. */
    public readonly grids: BabylonGeodesicGridPipeline;
    /** Imagery bindings of the meshes, on shaded grids with imagery. */
    public readonly drape: MeshRasterDrape | undefined;

    public constructor(inputs: ITerrainEngineInputs, options: IMeshTerrainEngineOptions = {}) {
        this.drape =
            inputs.imageryPages && !inputs.wireframe
                ? new MeshRasterDrape(inputs.scene, inputs.imageryPages, {
                      maxDepth: options.maxDrapeDepth ?? TERRAIN_CONFIG.imagery.maxDrapeDepth,
                  })
                : undefined;
        this.grids = new BabylonGeodesicGridPipeline(
            inputs.scene,
            inputs.labelLayer,
            {
                wireframe: inputs.wireframe,
                junctions: inputs.junctions,
                edgeHeights: inputs.edgeHeights,
                ...(inputs.geometrySelection ? { geometrySelection: inputs.geometrySelection } : {}),
                ...(inputs.tiling ? { tiling: inputs.tiling } : {}),
                ...(this.drape ? { drape: this.drape } : {}),
                ...(inputs.elevation ? { elevation: inputs.elevation } : {}),
                ...(options.junctionBudgetMilliseconds === undefined
                    ? {}
                    : {
                          junctionBudgetMilliseconds: options.junctionBudgetMilliseconds,
                      }),
            },
            options.cells,
        );
    }

    public activate(context: Activation): Promise<void> {
        return this.grids.activate(context);
    }

    public deactivate(context: Deactivation): void {
        this.grids.deactivate(context);
    }

    public present(context: Presentation): void {
        this.grids.present(context);
    }

    public hide(context: Presentation): void {
        this.grids.hide(context);
    }

    public release(context: Presentation): void {
        this.grids.release(context);
    }

    public getStatistics() {
        return this.grids.getStatistics();
    }

    public beforeRender(): void {
        this.grids.updateJunctions();
        this.drape?.update();
    }

    public afterRender(): void {
        this.grids.updateDebugLabels();
    }

    public setVerticalScale(scale: number): void {
        this.grids.setVerticalScale(scale);
    }

    public dispose(): void {
        this.drape?.dispose();
        this.grids.dispose();
    }
}
