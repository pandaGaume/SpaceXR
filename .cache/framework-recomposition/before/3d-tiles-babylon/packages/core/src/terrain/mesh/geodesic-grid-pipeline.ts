import { Color3 } from "@babylonjs/core/Maths/math.color.js";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer.js";
import { Mesh } from "@babylonjs/core/Meshes/mesh.js";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData.js";
import type { Scene } from "@babylonjs/core/scene.js";

import type { MeshRasterDrape } from "../../draping/mesh/mesh-raster-drape";
import type { IBabylonTileResourceStatistics, IBabylonTileResourceStatisticsProvider } from "../../monitor/runtime-monitor";
import {
    NO_METADATA,
    type IEcefSpatialState,
    type ITileActivationAdapter,
    type ITileActivationContext,
    type ITileDeactivationContext,
    type ITilePresentationAdapter,
    type ITilePresentationContext,
    type ITileAddress,
    type MetadataHandle,
    VerticalScale,
} from "@spacexr/3d-tiles-runtime";
import { JunctionGridTopologyCache, type IGridTopology, SAME_EDGE_LODS, edgeLodsKey, type GridEdgeLods } from "@spacexr/grid";
import { selectSurfaceLevels, type DemPyramid, type SurfaceLevelPolicy } from "@spacexr/dem";
import { TileNeighbor, tileAddressKey } from "@spacexr/tiles";
import { sampleRasterBilinear } from "@spacexr/raster";
import { DisplayedTiles, type JunctionPolicy } from "../displayed-tiles";
import { TERRAIN_CONFIG } from "../terrain-config";
import { regionWithHeights, tileIdentity, tileRegion } from "../terrain-tile";
import { webMercatorTiling, type ITerrainTiling } from "../terrain-tiling";
import { composeElevatedPositions, type IElevatedGridGeometry, projectElevatedGrid } from "./geodesic-grid-geometry";

const LOD_COLORS = ["#2f80ed", "#00c2ff", "#12b886", "#ffd43b", "#ff922b", "#fa5252", "#cc5de8", "#845ef7"] as const;

export interface IBabylonGeodesicGridHandle {
    mesh: Mesh;
    identity: ITileAddress;
    center: Vector3;
    label: HTMLSpanElement;
    presented: boolean;
    metadataHandle: MetadataHandle;
    estimatedCpuBytes: number;
    estimatedGpuBytes: number;
    /** Present when the grid carries DEM heights. */
    elevated: IElevatedGridGeometry | undefined;
    /** Unscaled heights of the tile, kept to rebuild the grid when its neighbours change. */
    heightAt: HeightSampler | undefined;
    /** Neighbour levels the current grid connects to. */
    lods: GridEdgeLods;
    /** Levels of detail displayed along the edges when the grid was built. */
    edgeLevels: string;
}

/** Elevation applied to grid vertices, one DEM tile per grid tile. */
export interface IGridElevationOptions {
    /** DEM surface, which also records the ranges prepared for child tiles. */
    pyramid: DemPyramid;
    /** Vertical scale applied to every height: its initial value, or the scale shared by the scene. Defaults to 1. */
    verticalScale?: number | VerticalScale;
}

/** The vertical scale of an engine: the scale shared by the scene, or its own from an initial value. */
export function sharedVerticalScale(value: number | VerticalScale | undefined): VerticalScale {
    return value instanceof VerticalScale ? value : new VerticalScale(value ?? 1);
}

export interface IBabylonGeodesicGridPipelineOptions {
    wireframe?: boolean;
    /** Displaces vertices with DEM heights. Without it, grids lie on the region minimum height. */
    elevation?: IGridElevationOptions;
    /** Tile adapting its edge between two levels of detail. Defaults to `fine`. */
    junctions?: JunctionPolicy;
    /** Heights of the edge vertices shared with other levels. Defaults to `coarsest`. */
    edgeHeights?: EdgeHeightPolicy;
    /** Drapes imagery pages on shaded grids. Wireframe grids keep their level colours. */
    drape?: MeshRasterDrape;
    /** How tiles lie on the body. Defaults to Web Mercator on WGS84. */
    tiling?: ITerrainTiling;
    /**
     * Main-thread time per frame for the grids rebuilt by
     * {@link BabylonGeodesicGridPipeline.updateJunctions}, in milliseconds.
     * The rest waits for the next frames. Defaults to {@link TERRAIN_CONFIG}.
     */
    junctionBudgetMilliseconds?: number;
    /**
     * With `runtime`, the published geometry cut is authoritative: hidden tiles do not remain edge neighbours,
     * and every changed junction is rebuilt before the next draw. Defaults to the existing draped behaviour.
     */
    geometrySelection?: "runtime" | "draped";
}

/**
 * Height of a tile edge vertex touched by tiles of several levels of detail.
 * Every tile touching the vertex computes the same height from the stitched
 * DEM of the levels the policy selects, so their edges meet.
 */
export type EdgeHeightPolicy = SurfaceLevelPolicy;

/** A grid to rebuild by `updateJunctions`, with its new edge levels. */
interface IJunctionRebuild {
    handle: IBabylonGeodesicGridHandle;
    lods: GridEdgeLods;
    edgeLevels: string;
    /** Squared distance from the camera to the tile centre. */
    distance: number;
}

/** Height in metres at normalized tile coordinates, `u` west to east and `v` north to south. */
type HeightSampler = (u: number, v: number) => number;

/** Shared levels sampled on N, E, S, W, NW, NE, SE and SW of a runtime-owned grid. */
type BoundarySurfaceLevels = readonly (readonly number[])[];

/** A regular vertex lattice kept while only its border topology changes. */
interface IRuntimeGridCache {
    elevated: IElevatedGridGeometry;
    positions: Float32Array;
    normals: Float32Array;
    orientation: Int8Array;
    boundaryVertices: number[];
    ownDem: string;
}

const BORDER_NEIGHBORS = [
    TileNeighbor.N,
    TileNeighbor.E,
    TileNeighbor.S,
    TileNeighbor.W,
    TileNeighbor.NW,
    TileNeighbor.NE,
    TileNeighbor.SE,
    TileNeighbor.SW,
] as const;

function lodColor(lod: number): string {
    return LOD_COLORS[lod % LOD_COLORS.length]!;
}

/**
 * Babylon implementation of the renderer-neutral runtime ports.
 *
 * The adapter shares only normalized grid topology. It computes unique
 * positions for each tile from the surface of its tiling.
 * A future shader implementation can reuse the same topology and move that
 * projection to the GPU, allowing instances without changing runtime ports.
 */
export class BabylonGeodesicGridPipeline
    implements
        IBabylonTileResourceStatisticsProvider,
        ITileActivationAdapter<IEcefSpatialState, IBabylonGeodesicGridHandle, never>,
        ITilePresentationAdapter<IEcefSpatialState, IBabylonGeodesicGridHandle, never>
{
    private readonly handles = new Set<IBabylonGeodesicGridHandle>();
    private readonly materialsByLod = new Map<number, StandardMaterial>();
    private readonly topologies: JunctionGridTopologyCache;
    // The DEM tiles of the known cut stay in memory: edge heights and normals read them across tiles.
    private readonly displayed: DisplayedTiles;
    private readonly tiling: ITerrainTiling;
    private readonly junctions: JunctionPolicy;
    private readonly edgeHeights: EdgeHeightPolicy;
    private readonly subdivisions: number;
    private junctionsDirty = false;
    private readonly junctionBudgetMilliseconds: number;
    private readonly runtimeGeometry: boolean;
    private readonly runtimeGrids = new Map<IBabylonGeodesicGridHandle, IRuntimeGridCache>();
    private readonly runtimeIndices = new Map<number, Uint32Array>();
    private readonly gridDependencyKeys = new Map<IBabylonGeodesicGridHandle, Set<string>>();
    private readonly gridsByDem = new Map<string, Set<IBabylonGeodesicGridHandle>>();
    private readonly stopObservingDem: (() => void) | undefined;
    private readonly labelLayer: HTMLElement;
    private readonly scene: Scene;
    private readonly wireframe: boolean;
    private readonly elevation: IGridElevationOptions | undefined;
    private readonly drape: MeshRasterDrape | undefined;
    private readonly verticalScale: VerticalScale;
    private readonly stopVerticalScale: () => void;
    private createdHandleCount = 0;
    private releasedHandleCount = 0;

    public constructor(
        scene: Scene,
        labelLayer: HTMLElement,
        options: IBabylonGeodesicGridPipelineOptions = {},
        subdivisions = TERRAIN_CONFIG.grid.cells,
    ) {
        this.scene = scene;
        this.tiling = options.tiling ?? webMercatorTiling();
        this.runtimeGeometry = options.geometrySelection === "runtime";
        this.displayed = new DisplayedTiles({
            topology: this.tiling.topology,
            onTrack: (address) => this.elevation?.pyramid.retain(address),
            onForget: (address) => this.elevation?.pyramid.release(address),
        });
        this.labelLayer = labelLayer;
        this.wireframe = options.wireframe ?? true;
        this.elevation = options.elevation;
        this.drape = options.wireframe === false ? options.drape : undefined;
        this.verticalScale = sharedVerticalScale(options.elevation?.verticalScale);
        this.stopVerticalScale = this.verticalScale.subscribe((scale) => this.applyVerticalScale(scale));
        this.junctions = options.junctions ?? "fine";
        this.edgeHeights = options.edgeHeights ?? "coarsest";
        this.junctionBudgetMilliseconds = options.junctionBudgetMilliseconds ?? TERRAIN_CONFIG.mesh.junctionBudgetMilliseconds;
        this.subdivisions = subdivisions;
        this.topologies = new JunctionGridTopologyCache(subdivisions);
        this.stopObservingDem = this.runtimeGeometry
            ? this.elevation?.pyramid.rasters.observeStitched((changed) => this.invalidateRuntimeGrids(changed))
            : undefined;
    }

    public async activate(context: ITileActivationContext<IEcefSpatialState, IBabylonGeodesicGridHandle, never>): Promise<void> {
        for (const content of context.pendingContents) {
            if (context.signal.aborted) {
                await context.readiness.cancelled(content.id);
                continue;
            }
            const pendingDem = this.runtimeGeometry && this.elevation ? tileIdentity(context) : undefined;
            if (pendingDem) this.elevation!.pyramid.retain(pendingDem);
            try {
                const heights = await this.elevation?.pyramid.tileHeights(tileIdentity(context), context.signal);
                if (this.runtimeGeometry && this.elevation && !heights)
                    throw new Error(`No DEM data serves terrain tile ${context.tile.id}.`);
                if (context.signal.aborted) {
                    await context.readiness.cancelled(content.id);
                    continue;
                }
                const handle = this.createHandle(context, content.id, heights?.sampler);
                const accepted = await context.readiness.ready(content.id, {
                    kind: "renderable",
                    handle,
                    cacheKey: content.uri,
                    cost: {
                        cpuBytes: handle.estimatedCpuBytes,
                        gpuBytes: handle.estimatedGpuBytes,
                        networkBytes: 0,
                    },
                    // The tile starts at 0/0; its DEM gives the measured height range.
                    ...(heights && !Number.isNaN(heights.range.minimum) && !Number.isNaN(heights.range.maximum)
                        ? {
                              tileBoundingVolume: () => ({
                                  region: regionWithHeights(tileRegion(context), heights.range, this.verticalScale.value),
                              }),
                          }
                        : {}),
                });
                if (!accepted) this.disposeHandle(handle);
            } catch (error) {
                if (context.signal.aborted) await context.readiness.cancelled(content.id);
                else await context.readiness.failed(content.id, error);
            } finally {
                if (pendingDem) this.elevation!.pyramid.release(pendingDem);
            }
        }
    }

    public deactivate(_context: ITileDeactivationContext<IEcefSpatialState, IBabylonGeodesicGridHandle, never>): void {
        // Selection and visual presentation intentionally remain separate.
    }

    public present(context: ITilePresentationContext<IEcefSpatialState, IBabylonGeodesicGridHandle, never>): void {
        for (const resource of context.resources) {
            const handle = resource.handle;
            handle.metadataHandle = resource.metadataHandle;
            if (handle.presented) continue;
            this.displayed.add(handle.identity);
            handle.presented = true;
            handle.mesh.isVisible = true;
            this.junctionsDirty = true;
            // A tile shown again after its DEM left the cache reloads it, then rebuilds its edges.
            const pyramid = this.elevation?.pyramid;
            if (pyramid && handle.heightAt && !pyramid.isResident(handle.identity))
                void pyramid.tileHeights(handle.identity).then(() => {
                    if (this.runtimeGeometry && !handle.presented) return;
                    handle.edgeLevels = "";
                    this.junctionsDirty = true;
                });
        }
    }

    public hide(context: ITilePresentationContext<IEcefSpatialState, IBabylonGeodesicGridHandle, never>): void {
        for (const resource of context.resources) {
            const handle = resource.handle;
            if (!handle.presented) continue;
            if (this.runtimeGeometry) this.displayed.delete(handle.identity);
            else this.displayed.hide(handle.identity);
            handle.presented = false;
            handle.mesh.isVisible = false;
            handle.label.style.display = "none";
            this.junctionsDirty = true;
        }
    }

    public release(context: ITilePresentationContext<IEcefSpatialState, IBabylonGeodesicGridHandle, never>): void {
        for (const resource of context.resources) this.disposeHandle(resource.handle);
    }

    /**
     * Reconnects the edges of the presented grids to the levels of detail
     * displayed next to them. Call once per frame, before rendering; it only
     * works after a presentation change, and only rebuilds the grids whose
     * neighbour levels changed, in their topology or in their edge heights.
     *
     * Rebuilds stop once they have taken the frame budget, and the rest wait
     * for the next frames, so that a wave of loaded tiles does not stall one
     * frame. Topology changes, which open cracks, go before edge heights, and
     * nearer grids before farther ones; one grid is rebuilt in every frame
     * whatever its cost, so that the backlog always shrinks. With runtime-owned geometry all changes finish before
     * drawing, since a delayed edge update would expose a cut whose junctions belong to an earlier frame.
     */
    public updateJunctions(): void {
        if (!this.junctionsDirty) return;
        this.junctionsDirty = false;
        // The budget counts the scan and the sort as well: with many tiles, they cost as much as a rebuild.
        const start = performance.now();
        const topologyChanges: IJunctionRebuild[] = [];
        const heightChanges: IJunctionRebuild[] = [];
        const eye = this.scene.activeCamera?.globalPosition ?? Vector3.Zero();
        for (const handle of this.handles) {
            if (!handle.presented) continue;
            const lods = this.displayed.edgeLods(handle.identity, this.junctions);
            const edgeLevels = handle.heightAt ? this.edgeLevelsSignature(handle.identity) : "";
            const rebuild = {
                handle,
                lods,
                edgeLevels,
                distance: Vector3.DistanceSquared(handle.center, eye),
            };
            if (edgeLodsKey(lods) !== edgeLodsKey(handle.lods)) topologyChanges.push(rebuild);
            else if (edgeLevels !== handle.edgeLevels) heightChanges.push(rebuild);
        }
        const nearestFirst = (left: IJunctionRebuild, right: IJunctionRebuild): number => left.distance - right.distance;
        const rebuilds = this.runtimeGeometry
            ? [...topologyChanges, ...heightChanges]
            : [...topologyChanges.sort(nearestFirst), ...heightChanges.sort(nearestFirst)];
        for (const [index, { handle, lods, edgeLevels }] of rebuilds.entries()) {
            if (!this.runtimeGeometry && index > 0 && performance.now() - start >= this.junctionBudgetMilliseconds) {
                this.junctionsDirty = true;
                return;
            }
            handle.edgeLevels = edgeLevels;
            this.applyGeometry(handle, lods);
        }
    }

    /** Projects labels for the current presentation cut into screen space. */
    public updateDebugLabels(): void {
        const camera = this.scene.activeCamera;
        if (!camera) return;

        const engine = this.scene.getEngine();
        const width = engine.getRenderWidth();
        const height = engine.getRenderHeight();
        const viewport = camera.viewport.toGlobal(width, height);
        const transform = this.scene.getTransformMatrix();
        const margin = 80;

        for (const handle of this.handles) {
            if (!handle.presented) {
                handle.label.style.display = "none";
                continue;
            }

            const projected = Vector3.Project(handle.center, Matrix.IdentityReadOnly, transform, viewport);
            const insideViewport =
                projected.z >= 0 &&
                projected.z <= 1 &&
                projected.x >= -margin &&
                projected.x <= width + margin &&
                projected.y >= -margin &&
                projected.y <= height + margin;
            if (!insideViewport) {
                handle.label.style.display = "none";
                continue;
            }

            handle.label.style.display = "block";
            handle.label.style.transform = `translate3d(${projected.x}px, ${projected.y}px, 0) translate(-50%, -50%)`;
        }
    }

    public dispose(): void {
        this.stopVerticalScale();
        this.stopObservingDem?.();
        for (const handle of [...this.handles]) this.disposeHandle(handle);
        for (const material of this.materialsByLod.values()) material.dispose();
        this.materialsByLod.clear();
    }

    /** Returns the resources that are actually retained by the Babylon adapter. */
    public getStatistics(): IBabylonTileResourceStatistics {
        let presented = 0;
        let cpuBytes = 0;
        let gpuBytes = 0;
        for (const handle of this.handles) {
            if (handle.presented) presented++;
            cpuBytes += handle.estimatedCpuBytes;
            gpuBytes += handle.estimatedGpuBytes;
        }
        return {
            handles: this.handles.size,
            presented,
            created: this.createdHandleCount,
            released: this.releasedHandleCount,
            cpuBytes,
            gpuBytes,
        };
    }

    /** Current vertical scale applied to DEM heights. */
    public get currentVerticalScale(): number {
        return this.verticalScale.value;
    }

    /**
     * Changes the vertical scale of every elevated grid in place. Tiles keep
     * the bounding volume reported with the scale they were loaded with, unless
     * their runtime was given the same `VerticalScale`; new tiles report volumes
     * for the new scale.
     */
    public setVerticalScale(scale: number): void {
        this.verticalScale.set(scale);
    }

    private applyVerticalScale(scale: number): void {
        for (const handle of this.handles) {
            if (!handle.elevated) continue;
            if (this.runtimeGeometry && this.junctions !== "coarse") {
                this.runtimeGrids.delete(handle);
                this.applyGeometry(handle, handle.lods);
                continue;
            }
            const positions = composeElevatedPositions(handle.elevated, scale);
            const normals = this.surfaceNormals(handle, this.topologies.get(handle.lods), handle.elevated, positions);
            handle.mesh.updateVerticesData(VertexBuffer.PositionKind, positions);
            handle.mesh.updateVerticesData(VertexBuffer.NormalKind, normals);
            handle.mesh.refreshBoundingInfo();
        }
    }

    private createHandle(
        context: ITileActivationContext<IEcefSpatialState, IBabylonGeodesicGridHandle, never>,
        contentId: string,
        heightAt?: HeightSampler,
    ): IBabylonGeodesicGridHandle {
        const identity = tileIdentity(context);
        const center = this.tiling.center(identity);
        const mesh = new Mesh(`geodesic-grid-${contentId}`, this.scene);
        mesh.material = this.materialForLod(identity.lod);
        mesh.isVisible = false;
        mesh.alwaysSelectAsActiveMesh = true;

        const label = this.labelLayer.ownerDocument.createElement("span");
        label.className = "tile-label";
        label.textContent = `X ${identity.x}  Y ${identity.y}  LOD ${identity.lod}`;
        label.style.setProperty("--tile-color", lodColor(identity.lod));
        this.labelLayer.append(label);

        const handle: IBabylonGeodesicGridHandle = {
            mesh,
            identity,
            center: new Vector3(center.x, center.y, center.z),
            label,
            presented: false,
            metadataHandle: NO_METADATA,
            estimatedCpuBytes: 0,
            estimatedGpuBytes: 0,
            elevated: undefined,
            heightAt,
            lods: SAME_EDGE_LODS,
            edgeLevels: "",
        };
        // Neighbours are unknown until presentation; updateJunctions adapts the edges then, if they differ.
        this.applyGeometry(handle, SAME_EDGE_LODS);
        handle.edgeLevels = heightAt ? this.edgeLevelsSignature(identity) : "";
        this.handles.add(handle);
        this.drape?.add(mesh, identity);
        // A cached ready ancestor must keep the DEM needed when it becomes the coverage fallback again.
        if (this.runtimeGeometry && heightAt) this.elevation!.pyramid.retain(identity);
        this.createdHandleCount++;
        return handle;
    }

    /**
     * Displayed levels whose DEM surface a vertex follows: the level of its tile
     * inside the tile; on its edges, the levels chosen by the edge height policy
     * among the tiles displayed at that point, so that every tile touching the
     * vertex agrees on its height and normal.
     */
    private surfaceLevels(tile: ITileAddress, u: number, v: number): number[] {
        if (u !== 0 && u !== 1 && v !== 0 && v !== 1) return [tile.lod];
        return [...selectSurfaceLevels(this.displayed.levelsAt(tile, u, v), this.edgeHeights)];
    }

    /**
     * Normals of the DEM surface rather than of the mesh: a vertex shared by
     * several tiles receives the same normal in each of them, which removes the
     * shading seams along tile edges. Vertices without DEM keep mesh normals.
     */
    private surfaceNormals(
        handle: IBabylonGeodesicGridHandle,
        topology: IGridTopology,
        elevated: IElevatedGridGeometry,
        positions: number[],
        levelsAt?: (u: number, v: number) => readonly number[],
        gradientAt?: (u: number, v: number) => readonly [number, number] | undefined,
    ): number[] {
        const normals: number[] = [];
        VertexData.ComputeNormals(positions, elevated.indices, normals);
        const { lod, x: column, y: row } = handle.identity;
        const count = 2 ** lod;
        const pyramid = this.elevation!.pyramid;
        for (let vertex = 0; vertex < topology.coordinates.length / 2; vertex++) {
            const u = topology.coordinates[vertex * 2]!;
            const v = topology.coordinates[vertex * 2 + 1]!;
            const x = (column + u) / count;
            const y = (row + v) / count;
            // One grid cell at the displayed level: the samples fall on the neighbouring vertices, so normals
            // describe the mesh surface rather than DEM detail the triangles cannot show.
            const gradient = gradientAt
                ? gradientAt(u, v)
                : pyramid.surfaceGradient(
                      x,
                      y,
                      levelsAt?.(u, v) ?? this.surfaceLevels(handle.identity, u, v),
                      this.subdivisions,
                      handle.identity.face ?? 0,
                  );
            if (!gradient) continue;
            const up = {
                x: elevated.up[vertex * 3]!,
                y: elevated.up[vertex * 3 + 1]!,
                z: elevated.up[vertex * 3 + 2]!,
            };
            const normal = this.tiling.surfaceNormal(handle.identity, u, v, up, gradient, this.verticalScale.value);
            // Keep the orientation Babylon gives the mesh: its winding convention decides which side is lit.
            const meshSide =
                normals[vertex * 3]! * normal.x + normals[vertex * 3 + 1]! * normal.y + normals[vertex * 3 + 2]! * normal.z < 0 ? -1 : 1;
            normals[vertex * 3] = normal.x * meshSide;
            normals[vertex * 3 + 1] = normal.y * meshSide;
            normals[vertex * 3 + 2] = normal.z * meshSide;
        }
        return normals;
    }

    /** Levels around a tile, to detect when its edge heights change: the levels at each edge vertex depend only on them. */
    private edgeLevelsSignature(tile: ITileAddress): string {
        if (this.runtimeGeometry)
            return this.boundarySurfaceLevels(tile)
                .map((levels) => levels.join("/"))
                .join(",");
        return this.displayed.boundarySignature(tile);
    }

    /** Builds the grid of a tile for the given neighbour levels and uploads it to its mesh. */
    private applyGeometry(handle: IBabylonGeodesicGridHandle, lods: GridEdgeLods): void {
        if (this.runtimeGeometry && this.junctions !== "coarse" && handle.heightAt) {
            this.applyRuntimeGeometry(handle, lods);
            return;
        }
        const topology = this.topologies.get(lods);
        const ownHeight = handle.heightAt;
        const { lod, x: column, y: row } = handle.identity;
        const count = 2 ** lod;
        const heightAt: HeightSampler | undefined = ownHeight
            ? (u, v) => {
                  const height = this.elevation!.pyramid.surfaceHeight(
                      (column + u) / count,
                      (row + v) / count,
                      this.surfaceLevels(handle.identity, u, v),
                      handle.identity.face ?? 0,
                  );
                  return Number.isNaN(height) ? ownHeight(u, v) : height;
              }
            : undefined;
        const elevated = projectElevatedGrid(topology, handle.identity, this.tiling.surface, heightAt ?? (() => 0));
        const geometry = {
            positions: composeElevatedPositions(elevated, this.verticalScale.value),
            uvs: elevated.uvs,
            indices: elevated.indices,
        };
        let normals: number[] = [];
        if (heightAt) normals = this.surfaceNormals(handle, topology, elevated, geometry.positions);
        else VertexData.ComputeNormals(geometry.positions, geometry.indices, normals);

        const vertexData = new VertexData();
        vertexData.positions = geometry.positions;
        vertexData.uvs = geometry.uvs;
        vertexData.indices = geometry.indices;
        vertexData.normals = normals;
        vertexData.applyToMesh(handle.mesh, heightAt !== undefined);

        handle.elevated = heightAt ? elevated : undefined;
        handle.lods = lods;
        handle.estimatedCpuBytes =
            (geometry.positions.length + normals.length) * Float64Array.BYTES_PER_ELEMENT +
            geometry.uvs.byteLength +
            geometry.indices.byteLength;
        handle.estimatedGpuBytes =
            (geometry.positions.length + normals.length) * Float32Array.BYTES_PER_ELEMENT +
            geometry.uvs.byteLength +
            geometry.indices.byteLength;
    }

    /** Effective sampled levels: an absent, same-level or finer neighbour is identical under `coarsest`. */
    private boundarySurfaceLevels(tile: ITileAddress): BoundarySurfaceLevels {
        const across = BORDER_NEIGHBORS.map((neighbor) => this.displayed.lodAcross(tile, neighbor));
        const choose = (...positions: number[]): readonly number[] => {
            const levels = new Set([tile.lod]);
            for (const position of positions) {
                const level = across[position];
                if (level !== undefined) levels.add(level);
            }
            return selectSurfaceLevels(
                [...levels].sort((left, right) => left - right),
                this.edgeHeights,
            );
        };
        return [choose(0), choose(1), choose(2), choose(3), choose(0, 3, 4), choose(0, 1, 5), choose(2, 1, 6), choose(2, 3, 7)];
    }

    private levelsOnBoundary(boundary: BoundarySurfaceLevels, u: number, v: number): readonly number[] {
        if (u === 0 && v === 0) return boundary[4]!;
        if (u === 1 && v === 0) return boundary[5]!;
        if (u === 1 && v === 1) return boundary[6]!;
        if (u === 0 && v === 1) return boundary[7]!;
        return boundary[v === 0 ? 0 : u === 1 ? 1 : v === 1 ? 2 : 3]!;
    }

    /** Coarser/Same variants keep one regular vertex buffer and only change its index list. */
    private runtimeTopologyIndices(lods: GridEdgeLods): Uint32Array {
        const key = edgeLodsKey(lods);
        const existing = this.runtimeIndices.get(key);
        if (existing) return existing;
        const topology = this.topologies.get(lods);
        const lattice = new Uint32Array(topology.coordinates.length / 2);
        for (let vertex = 0; vertex < lattice.length; vertex++) {
            const column = Math.round(topology.coordinates[vertex * 2]! * this.subdivisions);
            const row = Math.round(topology.coordinates[vertex * 2 + 1]! * this.subdivisions);
            lattice[vertex] = row * (this.subdivisions + 1) + column;
        }
        const indices = Uint32Array.from(topology.indices, (vertex) => lattice[vertex]!);
        this.runtimeIndices.set(key, indices);
        return indices;
    }

    private createRuntimeGrid(handle: IBabylonGeodesicGridHandle): IRuntimeGridCache {
        const topology = this.topologies.get(SAME_EDGE_LODS);
        const { lod } = handle.identity;
        const ownLevels = [lod];
        const pyramid = this.elevation!.pyramid;
        const area = pyramid.rasters.areaOf(handle.identity);
        const grid = pyramid.rasters.stitchedGrid(area.ancestor);
        // The own DEM is retained while this handle is ready. Sample its sub-area directly: interior stencils
        // never leave it and must not use the coarser surface selected for an edge.
        const heightAt: HeightSampler = grid
            ? (u, v) => sampleRasterBilinear(grid, area.west + u * area.size, area.north + v * area.size, 0, "point")
            : handle.heightAt!;
        const elevated = projectElevatedGrid(topology, handle.identity, this.tiling.surface, heightAt);
        const positions = composeElevatedPositions(elevated, this.verticalScale.value);
        const step = 1 / this.subdivisions;
        const inverseWorldStep = this.subdivisions * 2 ** lod;
        const gradientAt = (u: number, v: number): readonly [number, number] | undefined => {
            // Boundaries are evaluated once below, from the shared pyramid surface.
            if (u === 0 || u === 1 || v === 0 || v === 1) return undefined;
            const difference = (before: number, after: number): number | undefined => {
                if (!Number.isNaN(before) && !Number.isNaN(after)) return (after - before) * 0.5 * inverseWorldStep;
                const center = heightAt(u, v);
                if (!Number.isNaN(after) && !Number.isNaN(center)) return (after - center) * inverseWorldStep;
                if (!Number.isNaN(before) && !Number.isNaN(center)) return (center - before) * inverseWorldStep;
                return undefined;
            };
            const east = difference(heightAt(u - step, v), heightAt(u + step, v));
            const south = difference(heightAt(u, v - step), heightAt(u, v + step));
            return east === undefined || south === undefined ? undefined : [east, south];
        };
        const normals = this.surfaceNormals(handle, topology, elevated, positions, () => ownLevels, gradientAt);
        const boundaryVertices: number[] = [];
        const orientation = new Int8Array(elevated.heights.length);
        for (let vertex = 0; vertex < elevated.heights.length; vertex++) {
            const u = topology.coordinates[vertex * 2]!;
            const v = topology.coordinates[vertex * 2 + 1]!;
            if (u === 0 || u === 1 || v === 0 || v === 1) boundaryVertices.push(vertex);
            const offset = vertex * 3;
            orientation[vertex] =
                normals[offset]! * elevated.up[offset]! +
                    normals[offset + 1]! * elevated.up[offset + 1]! +
                    normals[offset + 2]! * elevated.up[offset + 2]! <
                0
                    ? -1
                    : 1;
        }
        return {
            elevated,
            positions: Float32Array.from(positions),
            normals: Float32Array.from(normals),
            orientation,
            boundaryVertices,
            ownDem: tileAddressKey(pyramid.rasters.areaOf(handle.identity).ancestor),
        };
    }

    /** Re-evaluates the perimeter; the positions and normals of interior vertices remain cached. */
    private applyRuntimeGeometry(handle: IBabylonGeodesicGridHandle, lods: GridEdgeLods): void {
        let cache = this.runtimeGrids.get(handle);
        const fresh = cache === undefined;
        if (!cache) {
            cache = this.createRuntimeGrid(handle);
            this.runtimeGrids.set(handle, cache);
        }
        const topology = this.topologies.get(SAME_EDGE_LODS);
        const boundary = this.boundarySurfaceLevels(handle.identity);
        const { lod, x: column, y: row } = handle.identity;
        const count = 2 ** lod;
        const pyramid = this.elevation!.pyramid;
        const scale = this.verticalScale.value;
        for (const vertex of cache.boundaryVertices) {
            const u = topology.coordinates[vertex * 2]!;
            const v = topology.coordinates[vertex * 2 + 1]!;
            const levels = this.levelsOnBoundary(boundary, u, v);
            const x = (column + u) / count;
            const y = (row + v) / count;
            const sampled = pyramid.surfaceHeight(x, y, levels, handle.identity.face ?? 0);
            const height = Number.isNaN(sampled) ? handle.heightAt!(u, v) : sampled;
            cache.elevated.heights[vertex] = height;
            const offset = vertex * 3;
            for (let axis = 0; axis < 3; axis++)
                cache.positions[offset + axis] =
                    cache.elevated.base[offset + axis]! + cache.elevated.up[offset + axis]! * cache.elevated.heights[vertex]! * scale;
            const gradient = pyramid.surfaceGradient(x, y, levels, this.subdivisions, handle.identity.face ?? 0);
            if (gradient) {
                const up = { x: cache.elevated.up[offset]!, y: cache.elevated.up[offset + 1]!, z: cache.elevated.up[offset + 2]! };
                const normal = this.tiling.surfaceNormal(handle.identity, u, v, up, gradient, scale);
                const side = cache.orientation[vertex]!;
                cache.normals[offset] = normal.x * side;
                cache.normals[offset + 1] = normal.y * side;
                cache.normals[offset + 2] = normal.z * side;
            }
        }
        const indices = this.runtimeTopologyIndices(lods);
        cache.elevated = { ...cache.elevated, indices };
        if (fresh) {
            const data = new VertexData();
            data.positions = cache.positions;
            data.normals = cache.normals;
            data.uvs = cache.elevated.uvs;
            data.indices = indices;
            data.applyToMesh(handle.mesh, true);
        } else {
            handle.mesh.updateVerticesData(VertexBuffer.PositionKind, cache.positions);
            handle.mesh.updateVerticesData(VertexBuffer.NormalKind, cache.normals);
            if (edgeLodsKey(lods) !== edgeLodsKey(handle.lods)) handle.mesh.setIndices(indices);
            handle.mesh.refreshBoundingInfo();
        }
        handle.elevated = cache.elevated;
        handle.lods = lods;
        handle.estimatedCpuBytes =
            (cache.positions.length + cache.normals.length) * Float64Array.BYTES_PER_ELEMENT +
            cache.elevated.uvs.byteLength +
            indices.byteLength;
        handle.estimatedGpuBytes =
            (cache.positions.length + cache.normals.length) * Float32Array.BYTES_PER_ELEMENT +
            cache.elevated.uvs.byteLength +
            indices.byteLength;
        this.trackRuntimeDependencies(handle, cache, boundary);
    }

    /** Reverse data dependencies distinguish changed interior samples from neighbouring height/normal updates. */
    private trackRuntimeDependencies(handle: IBabylonGeodesicGridHandle, cache: IRuntimeGridCache, boundary: BoundarySurfaceLevels): void {
        this.forgetRuntimeDependencies(handle);
        const pyramid = this.elevation!.pyramid;
        const keys = new Set([cache.ownDem]);
        const levels = new Set([handle.identity.lod, ...boundary.flat()]);
        for (const level of levels) {
            const scale = 2 ** (level - handle.identity.lod);
            const firstX = Math.floor(handle.identity.x * scale);
            const firstY = Math.floor(handle.identity.y * scale);
            const lastX = Math.max(firstX, Math.ceil((handle.identity.x + 1) * scale) - 1);
            const lastY = Math.max(firstY, Math.ceil((handle.identity.y + 1) * scale) - 1);
            for (let y = firstY; y <= lastY; y++)
                for (let x = firstX; x <= lastX; x++) {
                    const address = { ...handle.identity, lod: level, x, y };
                    keys.add(tileAddressKey(pyramid.rasters.areaOf(address).ancestor));
                    for (const position of BORDER_NEIGHBORS) {
                        const neighbor = this.tiling.topology.neighbor(address, position)?.address;
                        if (neighbor) keys.add(tileAddressKey(pyramid.rasters.areaOf(neighbor).ancestor));
                    }
                }
        }
        this.gridDependencyKeys.set(handle, keys);
        for (const key of keys) {
            let handles = this.gridsByDem.get(key);
            if (!handles) this.gridsByDem.set(key, (handles = new Set()));
            handles.add(handle);
        }
    }

    private forgetRuntimeDependencies(handle: IBabylonGeodesicGridHandle): void {
        for (const key of this.gridDependencyKeys.get(handle) ?? []) {
            const handles = this.gridsByDem.get(key);
            handles?.delete(handle);
            if (handles?.size === 0) this.gridsByDem.delete(key);
        }
        this.gridDependencyKeys.delete(handle);
    }

    private invalidateRuntimeGrids(changed: readonly ITileAddress[]): void {
        const keys = new Set(changed.map(tileAddressKey));
        const affected = new Set<IBabylonGeodesicGridHandle>();
        for (const key of keys) for (const handle of this.gridsByDem.get(key) ?? []) affected.add(handle);
        for (const handle of affected) {
            const cache = this.runtimeGrids.get(handle);
            if (cache && keys.has(cache.ownDem)) this.runtimeGrids.delete(handle);
            handle.edgeLevels = "";
            if (handle.presented) this.junctionsDirty = true;
        }
    }

    private materialForLod(lod: number): StandardMaterial {
        const existing = this.materialsByLod.get(lod);
        if (existing) return existing;

        const color = Color3.FromHexString(lodColor(lod));
        // GLSL on WebGL, WGSL on WebGPU: the drape plugin is written in both.
        const material = new StandardMaterial(`geodesic-grid-material-lod-${lod}`, this.scene);
        material.specularColor = Color3.Black();
        if (this.wireframe) {
            material.diffuseColor = color.scale(0.55);
            material.emissiveColor = color;
            material.disableLighting = true;
        } else if (this.drape) {
            // Imagery replaces the level colour, which only shows where no page has arrived yet.
            material.diffuseColor = color.scale(0.9);
            material.emissiveColor = Color3.Black();
            material.twoSidedLighting = true;
            this.drape.attach(material);
        } else {
            // Shaded relief: the scene lights reveal slopes; a faint emissive keeps the LOD tint in shadows.
            material.diffuseColor = color.scale(0.9);
            material.emissiveColor = color.scale(0.08);
            material.twoSidedLighting = true;
        }
        material.wireframe = this.wireframe;
        material.backFaceCulling = false;
        material.useLogarithmicDepth = true;
        this.materialsByLod.set(lod, material);
        return material;
    }

    private disposeHandle(handle: IBabylonGeodesicGridHandle): void {
        if (!this.handles.delete(handle)) return;
        this.runtimeGrids.delete(handle);
        this.forgetRuntimeDependencies(handle);
        // A ghost leaves with its resource as well.
        if (handle.presented || this.displayed.isGhost(handle.identity)) {
            this.displayed.delete(handle.identity);
            this.junctionsDirty = true;
        }
        if (this.runtimeGeometry && handle.heightAt) this.elevation!.pyramid.release(handle.identity);
        this.releasedHandleCount++;
        handle.label.remove();
        this.drape?.remove(handle.mesh);
        handle.mesh.dispose(false, false);
    }
}
