import type { Camera } from "@babylonjs/core/Cameras/camera.js";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight.js";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight.js";
import { ShaderLanguage } from "@babylonjs/core/Materials/shaderLanguage.js";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial.js";
import { Color3 } from "@babylonjs/core/Maths/math.color.js";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode.js";
import type { Observer } from "@babylonjs/core/Misc/observable.js";
import type { Scene } from "@babylonjs/core/scene.js";
import type {
    IEcefSpatialState,
    ITileActivationContext,
    ITileAddress,
    ITileDeactivationContext,
    ITilePresentationContext,
} from "@spacexr/3d-tiles-runtime";
import type { VerticalScale } from "@spacexr/3d-tiles-runtime";
import { DrapeInstanceCut, type IDrapeInstance } from "@spacexr/raster";
import { tileAddressKey as key } from "@spacexr/tiles";

import type { IBabylonTileResourceStatistics } from "../../monitor/runtime-monitor";
import type { BabylonRasterPages } from "../../raster/raster-pages";
import { TERRAIN_CONFIG } from "../terrain-config";
import type { ITerrainEngine, ITerrainEngineInputs } from "../terrain-engine";
import { sharedVerticalScale } from "../mesh/geodesic-grid-pipeline";
import { regionWithHeights, tileIdentity, tileRegion } from "../terrain-tile";
import { webMercatorTiling, type ITerrainTiling } from "../terrain-tiling";
import { ElevationPages } from "./elevation-pages";
import { GridShapes } from "./grid-shapes";
import {
    InstancedGrid,
    INSTANCE_ATTRIBUTES,
    RUNTIME_INSTANCE_ATTRIBUTES,
    refinedGridTopology,
    runtimeGridTopology,
    type InstanceAttribute,
} from "./instanced-grid";
import { GpuRasterDrape } from "./gpu-raster-drape";
import { GpuTerrainNormals } from "./gpu-terrain-normals";
import { instancedGridPixelShader } from "./shaders/instancedGrid.fragment";
import { instancedGridVertexShader } from "./shaders/instancedGrid.vertex";
import { instancedGridPixelShaderWGSL } from "./shaders/wgsl/instancedGrid.fragment";
import { instancedGridVertexShaderWGSL } from "./shaders/wgsl/instancedGrid.vertex";
import { PickSurface } from "./pick-surface";
import { terrainBodyFrame } from "./body-frame";

export interface IGpuTerrainEngineOptions {
    /** Optional rigid body-fixed to scene transform. Selection and DEM addresses stay body-fixed. */
    root?: TransformNode;
    /** Cells per grid side. Defaults to {@link TERRAIN_CONFIG}, like the mesh engine. */
    cells?: number;
    /** Legacy draped cut only: deepest instance below its terrain tile. Defaults to {@link TERRAIN_CONFIG}. */
    maxInstanceDepth?: number;
    /** Legacy draped cut only: time a coarsened imagery level stays in the instance cut. Defaults to {@link TERRAIN_CONFIG}. */
    holdMilliseconds?: number;
    /** Heights per elevation page side: the DEM tile size plus one. Defaults to {@link TERRAIN_CONFIG}. */
    elevationPageSize?: number;
    /** Cells per side of the grids the camera picks, one per terrain tile. Defaults to {@link TERRAIN_CONFIG}. */
    pickCells?: number;
}

/** Terrain tile known to the GPU engine. */
export interface IGpuTerrainHandle {
    readonly identity: ITileAddress;
    presented: boolean;
    /** A ready runtime tile keeps its height source resident while it can be used as a fallback. */
    demRetained?: boolean;
}

type Activation = ITileActivationContext<IEcefSpatialState, IGpuTerrainHandle, never>;
type Deactivation = ITileDeactivationContext<IEcefSpatialState, IGpuTerrainHandle, never>;
type Presentation = ITilePresentationContext<IEcefSpatialState, IGpuTerrainHandle, never>;

/** Elevation attributes of an instance: its interior, then its edges N, E, S, W and its corners NW, NE, SE, SW. */
const ELEVATION_ATTRIBUTES: readonly InstanceAttribute[] = [
    "instElevation",
    "instEdgeN",
    "instEdgeE",
    "instEdgeS",
    "instEdgeW",
    "instCornerNW",
    "instCornerNE",
    "instCornerSE",
    "instCornerSW",
];

/** Instance of the cut with its centre in double precision and the DEM tiles whose pages it acquired. */
interface IPlacedInstance {
    instance: IDrapeInstance;
    center: { x: number; y: number; z: number };
    demTiles: ITileAddress[];
    grid: InstancedGrid;
    gridIndex: number;
}

/**
 * GPU terrain adapter. Runtime-selected Web Mercator draws one instance per presented terrain tile, grouped by
 * shared fine-side junction index topologies. It computes ellipsoid offsets analytically from compact parameters
 * and reads only heights from the DEM; imagery pages use fragment-level indirection without subdividing terrain.
 *
 * The legacy draped path, retained for the deferred cube adaptation, still combines the terrain and imagery cuts,
 * balances its instances, and reads their reference-surface shapes from texture arrays. Both paths use the same
 * activation and presentation ports and keep elevation sources independent of geometric tile addresses.
 *
 * Its shaders are written twice, in GLSL for WebGL and in WGSL for WebGPU, and compute the same values.
 */
export class GpuTerrainEngine implements ITerrainEngine<IGpuTerrainHandle> {
    public readonly name = "gpu";
    public readonly material: ShaderMaterial;
    public readonly shapes: GridShapes | undefined;
    public readonly elevations: ElevationPages;
    public readonly grid: InstancedGrid;
    /** Shared topology groups; their total count is the geometry count, independent of imagery depth. */
    public readonly grids = new Map<number, InstancedGrid>();
    public readonly pickSurface: PickSurface;
    private readonly scene: Scene;
    private readonly root: TransformNode | undefined;
    private readonly tiling: ITerrainTiling;
    private readonly cells: number;
    private readonly elevation: ITerrainEngineInputs["elevation"];
    private readonly imageryPages: BabylonRasterPages | undefined;
    private readonly cut: DrapeInstanceCut;
    private readonly runtimeSelection: boolean;
    private readonly ambientLighting: boolean;
    private readonly drape: GpuRasterDrape | undefined;
    private readonly normals: GpuTerrainNormals | undefined;
    private readonly normalObserver: Observer<ITileAddress> | undefined;
    private normalsDirty = false;
    private readonly presented = new Map<string, IGpuTerrainHandle>();
    private readonly handles = new Set<IGpuTerrainHandle>();
    private readonly pageObserver: Observer<ITileAddress> | undefined;
    private readonly cameraObserver: Observer<Camera>;
    private placed: IPlacedInstance[] = [];
    private readonly verticalScale: VerticalScale;
    private readonly stopVerticalScale: () => void;
    /** DEM tiles of the cover being loaded. */
    private dirty = true;
    private created = 0;
    private released = 0;

    public constructor(inputs: ITerrainEngineInputs, options: IGpuTerrainEngineOptions = {}) {
        this.scene = inputs.scene;
        this.root = options.root;
        this.tiling = inputs.tiling ?? webMercatorTiling();
        this.cells = options.cells ?? TERRAIN_CONFIG.grid.cells;
        this.elevation = inputs.elevation;
        this.imageryPages = inputs.wireframe ? undefined : inputs.imageryPages;
        this.runtimeSelection = inputs.geometrySelection === "runtime";
        this.ambientLighting = inputs.lighting === "ambient";
        this.normals =
            this.runtimeSelection && inputs.normalPages && !this.ambientLighting ? new GpuTerrainNormals(inputs.normalPages) : undefined;
        this.normalObserver = this.normals?.pages.changed.add(() => (this.normalsDirty = true));
        this.drape =
            this.runtimeSelection && this.imageryPages
                ? new GpuRasterDrape(this.scene, this.imageryPages, TERRAIN_CONFIG.imagery.maxDrapeDepth)
                : undefined;
        this.verticalScale = sharedVerticalScale(inputs.elevation?.verticalScale);
        this.stopVerticalScale = this.verticalScale.subscribe((scale) => {
            this.material.setFloat("verticalScale", scale);
            this.pickSurface.setVerticalScale(scale);
        });
        this.cut = new DrapeInstanceCut({
            topology: this.tiling.topology,
            // Elevation may be deeper in places: both sides of an edge read the coarser data.
            ...(this.runtimeSelection && inputs.elevation
                ? { terrainDataLevel: (terrain: ITileAddress) => inputs.elevation!.pyramid.rasters.areaOf(terrain).ancestor.lod }
                : {}),
            maxDepth: options.maxInstanceDepth ?? TERRAIN_CONFIG.gpu.maxInstanceDepth,
            holdMilliseconds: options.holdMilliseconds ?? TERRAIN_CONFIG.gpu.holdMilliseconds,
        });
        // Shapes hold the half-cell lattice: the grid vertices and the edge midpoints.
        this.shapes = this.runtimeSelection ? undefined : new GridShapes(this.scene, 2 * this.cells, this.tiling);
        this.elevations = new ElevationPages(
            this.scene,
            inputs.elevation?.pyramid,
            options.elevationPageSize ?? TERRAIN_CONFIG.dem.tileCells + 1,
            this.tiling,
        );
        this.pickSurface = new PickSurface(
            this.scene,
            inputs.elevation?.pyramid,
            this.verticalScale.value,
            options.pickCells ?? TERRAIN_CONFIG.gpu.pickCells,
            this.tiling,
            this.root,
        );

        const wgsl = this.scene.getEngine().isWebGPU;
        this.material = new ShaderMaterial(
            "gpu-terrain",
            this.scene,
            wgsl
                ? { vertexSource: instancedGridVertexShaderWGSL.shader, fragmentSource: instancedGridPixelShaderWGSL.shader }
                : { vertexSource: instancedGridVertexShader.shader, fragmentSource: instancedGridPixelShader.shader },
            {
                shaderLanguage: wgsl ? ShaderLanguage.WGSL : ShaderLanguage.GLSL,
                attributes: ["position", ...(this.runtimeSelection ? RUNTIME_INSTANCE_ATTRIBUTES : INSTANCE_ATTRIBUTES)],
                uniforms: [
                    "viewProjection",
                    "bodyRotation",
                    "cells",
                    "verticalScale",
                    "baseColor",
                    "sunDirection",
                    "sunColor",
                    "skyDirection",
                    "skyColor",
                    "groundColor",
                    "imagerySize",
                    "normalSize",
                    "inverseRadiiSquared",
                    "semiMajorAxis",
                    "eccentricitySquared",
                ],
                samplers: ["shapes", "elevations", "imagery", "imageryTables", "normalTextures"],
                defines: [
                    ...(this.imageryPages ? ["#define IMAGERY"] : []),
                    ...(this.runtimeSelection ? ["#define RUNTIME_SELECTION"] : []),
                    ...(this.ambientLighting ? ["#define AMBIENT_ONLY"] : []),
                    ...(this.normals ? ["#define PROVIDER_NORMALS"] : []),
                ],
            },
        );
        this.material.backFaceCulling = false;
        this.material.setMatrix("bodyRotation", Matrix.Identity());
        this.material.wireframe = inputs.wireframe;
        this.material.setFloat("cells", this.cells);
        this.material.setFloat("verticalScale", this.verticalScale.value);
        // The shaded colour of the mesh engine where no imagery is draped.
        this.material.setColor3("baseColor", new Color3(0.47, 0.5, 0.45));
        if (this.shapes) this.material.setTexture("shapes", this.shapes.pool);
        this.material.setTexture("elevations", this.elevations.pool);
        const radii = this.tiling.referenceRadii;
        if (radii) {
            this.material.setVector3("inverseRadiiSquared", new Vector3(1 / radii[0] ** 2, 1 / radii[1] ** 2, 1 / radii[2] ** 2));
            this.material.setFloat("semiMajorAxis", radii[0]);
            this.material.setFloat("eccentricitySquared", 1 - (radii[2] / radii[0]) ** 2);
        }
        if (this.runtimeSelection && !radii) throw new RangeError("Runtime-selected Web Mercator requires the reference ellipsoid radii.");
        if (this.drape) this.material.setTexture("imageryTables", this.drape.tables);
        if (this.normals) {
            this.material.setTexture("normalTextures", this.normals.pages.pool);
            this.material.setFloat("normalSize", this.normals.pages.size);
        }
        if (this.imageryPages) {
            this.material.setTexture("imagery", this.imageryPages.pool);
            this.material.setFloat("imagerySize", this.imageryPages.size);
        }
        this.updateLights();
        this.grid = new InstancedGrid(
            this.scene,
            "gpu-terrain",
            this.runtimeSelection ? runtimeGridTopology(this.cells, 0) : refinedGridTopology(this.cells),
            this.material,
            this.runtimeSelection ? RUNTIME_INSTANCE_ATTRIBUTES : INSTANCE_ATTRIBUTES,
        );
        this.grids.set(0, this.grid);

        this.pageObserver = this.runtimeSelection ? undefined : this.imageryPages?.changed.add(() => (this.dirty = true));
        // The camera position is known once the scene computed its matrices: place the instances then.
        this.cameraObserver = this.scene.onBeforeCameraRenderObservable.add(() => this.place());
    }

    public async activate(context: Activation): Promise<void> {
        for (const content of context.pendingContents) {
            if (context.signal.aborted) {
                await context.readiness.cancelled(content.id);
                continue;
            }
            try {
                const identity = tileIdentity(context);
                const heights = await this.elevation?.pyramid.tileHeights(identity, context.signal);
                if (context.signal.aborted) {
                    await context.readiness.cancelled(content.id);
                    continue;
                }
                if (this.runtimeSelection && this.elevation && !heights)
                    throw new Error(`No DEM or ancestor is available for terrain tile ${key(identity)}.`);
                const handle: IGpuTerrainHandle = { identity, presented: false };
                if (this.runtimeSelection && this.elevation) {
                    this.elevation.pyramid.retain(identity);
                    handle.demRetained = true;
                }
                this.handles.add(handle);
                this.created++;
                const accepted = await context.readiness.ready(content.id, {
                    kind: "renderable",
                    handle,
                    cacheKey: content.uri,
                    cost: { cpuBytes: 0, gpuBytes: 0, networkBytes: 0 },
                    // The tile starts at 0/0; its DEM gives the measured height range.
                    ...(heights && !Number.isNaN(heights.range.minimum) && !Number.isNaN(heights.range.maximum)
                        ? {
                              tileBoundingVolume: () => ({
                                  region: regionWithHeights(tileRegion(context), heights.range, this.verticalScale.value),
                              }),
                          }
                        : {}),
                });
                if (!accepted) this.forget(handle);
            } catch (error) {
                if (context.signal.aborted) await context.readiness.cancelled(content.id);
                else await context.readiness.failed(content.id, error);
            }
        }
    }

    public deactivate(_context: Deactivation): void {
        // Selection and visual presentation remain separate.
    }

    public present(context: Presentation): void {
        for (const { handle } of context.resources) {
            if (handle.presented) continue;
            handle.presented = true;
            this.presented.set(key(handle.identity), handle);
            const pyramid = this.elevation?.pyramid;
            pyramid?.retain(handle.identity);
            // A tile shown again after its DEM left the cache reloads it, then reads it again.
            if (pyramid && !pyramid.isResident(handle.identity))
                void pyramid.tileHeights(handle.identity).then(() => {
                    if (!handle.presented) return;
                    this.pickSurface.refresh(handle.identity);
                    this.dirty = true;
                });
            this.dirty = true;
        }
    }

    public hide(context: Presentation): void {
        for (const { handle } of context.resources) if (this.unpresent(handle)) this.dirty = true;
    }

    public release(context: Presentation): void {
        for (const { handle } of context.resources) if (this.forget(handle)) this.dirty = true;
    }

    public getStatistics(): IBabylonTileResourceStatistics {
        return {
            handles: this.handles.size,
            presented: this.presented.size,
            created: this.created,
            released: this.released,
            cpuBytes: 0,
            gpuBytes:
                (this.shapes?.pool.gpuBytes ?? 0) +
                this.elevations.pool.gpuBytes +
                (this.normals?.pages.pool.gpuBytes ?? 0) +
                [...this.grids.values()].reduce((sum, grid) => sum + grid.gpuBytes, 0) +
                (this.drape?.tables.gpuBytes ?? 0),
        };
    }

    public beforeRender(): void {
        const now = performance.now();
        const expiresAt = this.cut.expiresAt;
        if (this.dirty || (!this.runtimeSelection && expiresAt !== undefined && now >= expiresAt)) this.rebuild(now);
        else if (this.drape?.update()) this.updateDrapeBindings();
        this.normals?.update();
        if (this.normalsDirty) this.updateNormalBindings();
    }

    public afterRender(): void {
        // No per-tile work after rendering.
    }

    public setVerticalScale(scale: number): void {
        this.verticalScale.set(scale);
    }

    public dispose(): void {
        this.stopVerticalScale();
        if (this.normalObserver) this.normals?.pages.changed.remove(this.normalObserver);
        this.normals?.dispose();
        this.scene.onBeforeCameraRenderObservable.remove(this.cameraObserver);
        if (this.pageObserver) this.imageryPages?.changed.remove(this.pageObserver);
        this.releaseResources(this.placed);
        this.placed = [];
        for (const handle of this.presented.values()) this.elevation?.pyramid.release(handle.identity);
        this.presented.clear();
        for (const handle of this.handles)
            if (handle.demRetained) {
                this.elevation?.pyramid.release(handle.identity);
                handle.demRetained = false;
            }
        this.handles.clear();
        for (const grid of this.grids.values()) grid.dispose();
        this.grids.clear();
        this.drape?.dispose();
        this.pickSurface.dispose();
        this.material.dispose();
        this.shapes?.dispose();
        this.elevations.dispose();
    }

    /** @returns Whether the tile was presented. */
    private unpresent(handle: IGpuTerrainHandle): boolean {
        if (!handle.presented) return false;
        handle.presented = false;
        this.presented.delete(key(handle.identity));
        this.elevation?.pyramid.release(handle.identity);
        return true;
    }

    /** @returns Whether the tile was presented. */
    private forget(handle: IGpuTerrainHandle): boolean {
        const wasPresented = this.unpresent(handle);
        if (this.handles.delete(handle)) {
            if (handle.demRetained) {
                this.elevation?.pyramid.release(handle.identity);
                handle.demRetained = false;
            }
            this.released++;
        }
        return wasPresented;
    }

    /** Addresses actually drawn, so the two backends can be checked against the published runtime cut. */
    public get geometryTiles(): readonly ITileAddress[] {
        return this.placed.map(({ instance }) => instance.address);
    }

    public get instanceCount(): number {
        return this.placed.length;
    }

    /** Computes connections and bindings; only the legacy path changes the selected geometry. */
    private rebuild(now: number): void {
        this.dirty = false;
        const terrain = [...this.presented.values()].map((handle) => handle.identity);
        const imagery = this.imageryPages ? this.imageryPages.presented.addresses() : [];
        const instances = this.runtimeSelection ? this.cut.connectTerrain(terrain) : this.cut.update(terrain, imagery, now);
        this.pickSurface.update(terrain);
        this.drape?.sync(terrain);
        this.normals?.sync(terrain);

        const previous = this.runtimeSelection ? this.releaseObsoleteElevationPages(this.placed, instances) : this.placed;
        const groups = new Map<number, IDrapeInstance[]>();
        for (const instance of instances) {
            const mask = this.runtimeSelection ? instance.coarserEdges : 0;
            const group = groups.get(mask) ?? [];
            group.push(instance);
            groups.set(mask, group);
        }
        this.placed = [];
        for (const grid of this.grids.values()) grid.resize(0);
        for (const [mask, group] of groups) {
            let grid = this.grids.get(mask);
            if (!grid) {
                grid = new InstancedGrid(
                    this.scene,
                    `gpu-terrain-${mask}`,
                    runtimeGridTopology(this.cells, mask),
                    this.material,
                    RUNTIME_INSTANCE_ATTRIBUTES,
                );
                this.grids.set(mask, grid);
            }
            grid.resize(group.length);
            const place = grid.attribute("instPlace");
            const rotation = grid.attribute("instRotation");
            const surface = this.runtimeSelection ? grid.attribute("instSurface") : undefined;
            const normalAreas = this.runtimeSelection ? grid.attribute("instNormal") : undefined;
            const imageryAreas = grid.attribute("instImagery");
            const elevationAreas = ELEVATION_ATTRIBUTES.map((name) => grid!.attribute(name));
            group.forEach((instance, index) => {
                const { address } = instance;
                const offset = index * 4;
                const demTiles: ITileAddress[] = [];
                normalAreas?.set(this.normalArea(address), offset);
                place[offset + 3] = this.shapes?.acquire(address) ?? 0;
                const center = this.tiling.center(address);
                const longitude = this.tiling.rotation(address);
                const span = (2 * Math.PI) / 2 ** address.lod;
                rotation.set([Math.cos(longitude), Math.sin(longitude), span, instance.finerEdges], offset);
                if (this.runtimeSelection) {
                    const q = Math.PI * (1 - (2 * (address.y + 0.5)) / 2 ** address.lod);
                    const latitude = Math.atan(Math.sinh(q));
                    const sine = Math.sin(latitude),
                        cosine = Math.cos(latitude);
                    const radii = this.tiling.referenceRadii!;
                    const e2 = 1 - (radii[2] / radii[0]) ** 2;
                    const normalRadius = radii[0] / Math.sqrt(1 - e2 * sine * sine);
                    surface!.set([q, sine, cosine, normalRadius], offset);
                }
                if (this.drape) {
                    const binding = this.drape.binding(address);
                    imageryAreas.set([binding?.depth ?? 0, binding?.tableLayer ?? -1, 0, 0], offset);
                } else {
                    const cover = this.imageryPages?.resident.cover(address);
                    imageryAreas.set(cover ? [cover.west, cover.north, cover.size, cover.value] : [0, 0, 1, -1], offset);
                }
                const own = this.elevationArea(address, instance.terrain, demTiles);
                const sources = [instance.terrain, ...instance.edgeTerrain, ...instance.cornerTerrain];
                sources.forEach((terrainTile, slot) => {
                    const area = slot === 0 ? own : (this.elevationArea(address, terrainTile, demTiles) ?? own);
                    elevationAreas[slot]!.set(area ?? [0, 0, 1, -1], offset);
                });
                this.placed.push({ instance, center, demTiles, grid: grid!, gridIndex: index });
            });
            grid.upload(
                "instRotation",
                ...(this.runtimeSelection ? (["instSurface", "instNormal"] as const) : []),
                "instImagery",
                ...ELEVATION_ATTRIBUTES,
            );
        }
        this.releaseResources(previous);
        this.place();
    }

    private normalArea(address: ITileAddress): [number, number, number, number] {
        const layer = this.normals?.layer(address);
        if (layer === undefined || !this.normals) return [0, 0, 1, -1];
        const source = this.normals.pages.pyramid.areaOf(address).ancestor;
        const area = this.tiling.demArea(address, source);
        return [area.west, area.north, area.size, layer];
    }

    private updateNormalBindings(): void {
        this.normalsDirty = false;
        for (const { instance, grid, gridIndex } of this.placed)
            grid.attribute("instNormal").set(this.normalArea(instance.address), gridIndex * 4);
        for (const grid of this.grids.values()) if (grid.count > 0) grid.upload("instNormal");
    }

    private updateDrapeBindings(): void {
        if (!this.drape) return;
        for (const { instance, grid, gridIndex } of this.placed) {
            const binding = this.drape.binding(instance.address);
            grid.attribute("instImagery").set([binding?.depth ?? 0, binding?.tableLayer ?? -1, 0, 0], gridIndex * 4);
        }
        for (const grid of this.grids.values()) if (grid.count > 0) grid.upload("instImagery");
    }

    /**
     * Area of a tile in the DEM tile serving a terrain tile and the layer of its page, acquiring the page.
     *
     * @returns `undefined` when there is no elevation or the DEM tile is not in memory.
     */
    private elevationArea(
        address: ITileAddress,
        terrain: ITileAddress,
        demTiles: ITileAddress[],
    ): [number, number, number, number] | undefined {
        if (!this.elevation) return undefined;
        const demTile = this.elevation.pyramid.rasters.areaOf(terrain).ancestor;
        const layer = this.elevations.acquire(demTile);
        if (layer === undefined) return undefined;
        demTiles.push(demTile);
        // The tile is never coarser than the DEM tile; it may lie outside it, on its edge, for a neighbour's DEM, turned
        // across a cube face. The fraction of the layer holds the quarter turns.
        const area = this.tiling.demArea(address, demTile);
        return [area.west, area.north, area.size, layer + area.turns / 4];
    }

    /** Frees only obsolete DEM pages before acquiring new ones, keeping shared pages and their GPU texels intact. */
    private releaseObsoleteElevationPages(previous: readonly IPlacedInstance[], instances: readonly IDrapeInstance[]): IPlacedInstance[] {
        const pyramid = this.elevation?.pyramid;
        const needed = new Set<string>();
        if (pyramid)
            for (const instance of instances) {
                for (const terrain of [instance.terrain, ...instance.edgeTerrain, ...instance.cornerTerrain])
                    needed.add(key(pyramid.rasters.areaOf(terrain).ancestor));
            }
        return previous.map((placed) => ({
            ...placed,
            demTiles: placed.demTiles.filter((address) => {
                if (needed.has(key(address))) return true;
                this.elevations.release(address);
                return false;
            }),
        }));
    }

    /** Releases the shapes and elevation pages acquired for instances. */
    private releaseResources(instances: readonly IPlacedInstance[]): void {
        for (const { instance, demTiles } of instances) {
            this.shapes?.release(instance.address);
            for (const demTile of demTiles) this.elevations.release(demTile);
        }
    }

    /** Writes the tile centres relative to the camera, in double precision, and the light uniforms. */
    private place(): void {
        const { eye, rotation } = terrainBodyFrame(this.scene.floatingOriginOffset, this.root);
        this.material.setMatrix("bodyRotation", rotation);
        for (const { center, grid, gridIndex } of this.placed) {
            const place = grid.attribute("instPlace");
            place[gridIndex * 4] = center.x - eye.x;
            place[gridIndex * 4 + 1] = center.y - eye.y;
            place[gridIndex * 4 + 2] = center.z - eye.z;
        }
        for (const grid of this.grids.values()) if (grid.count > 0) grid.upload("instPlace");
        this.updateLights();
    }

    /** Passes the first directional and hemispheric lights of the scene, as the standard material sees them. */
    private updateLights(): void {
        if (this.ambientLighting) return;
        const sun = this.scene.lights.find(
            (light): light is DirectionalLight =>
                light instanceof DirectionalLight &&
                light.isEnabled() &&
                (!this.root ||
                    light.includedOnlyMeshes.length === 0 ||
                    [...this.grids.values()].some((grid) => light.includedOnlyMeshes.includes(grid.mesh))),
        );
        const sky = this.scene.lights.find((light): light is HemisphericLight => light instanceof HemisphericLight && light.isEnabled());
        const inverse = this.root ? Matrix.Invert(this.root.computeWorldMatrix(true)) : Matrix.IdentityReadOnly;
        this.material.setVector3(
            "sunDirection",
            Vector3.TransformNormal(sun ? sun.direction.negate().normalize() : Vector3.Up(), inverse).normalize(),
        );
        this.material.setColor3("sunColor", sun ? sun.diffuse.scale(sun.intensity) : Color3.White());
        this.material.setVector3(
            "skyDirection",
            Vector3.TransformNormal(sky ? sky.direction.normalizeToNew() : Vector3.Up(), inverse).normalize(),
        );
        this.material.setColor3("skyColor", sky ? sky.diffuse.scale(sky.intensity) : Color3.Black());
        this.material.setColor3("groundColor", sky ? sky.groundColor.scale(sky.intensity) : Color3.Black());
    }
}
