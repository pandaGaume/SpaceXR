import * as BABYLON from "@babylonjs/core";

import { ITargetBlock, IPipelineMessageType } from "core/tiles";
import { EventState } from "core/events";
import { Ellipsoid, GeodeticSystem } from "core/geodesy";
import { GetTile3dContents, ITile3d } from "core/tiles/3d/interfaces";

export interface IEllipsoidTilePatchSceneOptions {
    /** Grid resolution per patch edge (>= 1). Higher = smoother curve. Default 8. */
    tessellation?: number;
    /** Draw the patch outline to make refine/coarsen visible. Default false. */
    wireframe?: boolean;
}

/**
 * Renders the active cut of an implicit surface tileset as curved imagery
 * patches sitting on the ellipsoid, in RAW ECEF (matching GeodeticCamera).
 *
 * This is the minimal surface counterpart of Tile3dScene: it validates the
 * implicit traversal visually (tiles refine/coarsen as you navigate the globe)
 * without the DEM displacement shader. Each tile's `boundingVolume.region` is
 * tessellated into a grid, projected to ECEF via the ellipsoid, and textured
 * with the tile's imagery. Gated exactly like Tile3dScene: a tile shows only
 * when `renderable` is open and its texture has loaded.
 */
export class EllipsoidTilePatchScene extends BABYLON.TransformNode implements ITargetBlock<ITile3d> {
    private readonly _system: GeodeticSystem;
    private readonly _tessellation: number;
    private _wireframe: boolean;
    private readonly _patches: Map<string, BABYLON.Mesh> = new Map();

    public constructor(name: string, scene: BABYLON.Scene, ellipsoid: Ellipsoid = Ellipsoid.WGS84, options?: IEllipsoidTilePatchSceneOptions) {
        super(name, scene);
        this._system = new GeodeticSystem(ellipsoid);
        this._tessellation = Math.max(1, options?.tessellation ?? 8);
        this._wireframe = options?.wireframe ?? false;
    }

    public getClassName(): string {
        return "EllipsoidTilePatchScene";
    }

    /** Tile outlines. Applies to existing patches and every patch built after. */
    public get wireframe(): boolean {
        return this._wireframe;
    }

    public set wireframe(value: boolean) {
        this._wireframe = value;
        for (const m of this._patches.values()) {
            if (m.material) m.material.wireframe = value;
        }
    }

    public added(eventData: IPipelineMessageType<ITile3d>, _eventState: EventState): void {
        for (const t of eventData) if (t) this._update(t);
    }

    public updated(eventData: IPipelineMessageType<ITile3d>, _eventState: EventState): void {
        for (const t of eventData) if (t) this._update(t);
    }

    public removed(eventData: IPipelineMessageType<ITile3d>, _eventState: EventState): void {
        for (const t of eventData) if (t) this._remove(t);
    }

    public override dispose(doNotRecurse?: boolean, disposeMaterialAndTextures?: boolean): void {
        for (const m of this._patches.values()) this._disposePatch(m);
        this._patches.clear();
        super.dispose(doNotRecurse, disposeMaterialAndTextures);
    }

    private _update(tile: ITile3d): void {
        // Present only when the engine's render gate is open and the imagery is in.
        if (tile.renderable === false) {
            this._remove(tile);
            return;
        }
        const texture = GetTile3dContents(tile)?.find((c) => c.texture)?.texture;
        if (!texture) return;
        const id = tile.uid ?? "";
        if (this._patches.has(id)) return; // already built
        this._patches.set(id, this._buildPatch(tile, texture));
    }

    private _remove(tile: ITile3d): void {
        const id = tile.uid ?? "";
        const mesh = this._patches.get(id);
        if (mesh) {
            this._disposePatch(mesh);
            this._patches.delete(id);
        }
    }

    /**
     * Frees a patch's own resources: its unique geometry and material. The
     * texture is NOT disposed here, it belongs to the tile content and is
     * evicted by the loader (EllipsoidImageryTileLoader.cancel), so this
     * material must be disposed WITHOUT its textures.
     */
    private _disposePatch(mesh: BABYLON.Mesh): void {
        mesh.material?.dispose(true, false);
        mesh.dispose(false, false);
    }

    /** Tessellated ellipsoidal patch spanning the tile's geographic region. */
    private _buildPatch(tile: ITile3d, texture: BABYLON.Texture): BABYLON.Mesh {
        const region = tile.boundingVolume.region!;
        const RAD2DEG = 180 / Math.PI;
        const west = region[0] * RAD2DEG;
        const south = region[1] * RAD2DEG;
        const east = region[2] * RAD2DEG;
        const north = region[3] * RAD2DEG;

        const n = this._tessellation;
        const positions: number[] = [];
        const uvs: number[] = [];
        const indices: number[] = [];
        const scratch = { x: 0, y: 0, z: 0 };

        for (let j = 0; j <= n; j++) {
            const fy = j / n; // 0 = north edge, 1 = south edge
            const lat = north + (south - north) * fy;
            for (let i = 0; i <= n; i++) {
                const fx = i / n; // 0 = west edge, 1 = east edge
                const lon = west + (east - west) * fx;
                this._system.geodeticFloatToCartesianToRef(lat, lon, 0, scratch);
                positions.push(scratch.x, scratch.y, scratch.z);
                uvs.push(fx, 1 - fy); // texture origin top-left (north-west)
            }
        }
        const row = n + 1;
        for (let j = 0; j < n; j++) {
            for (let i = 0; i < n; i++) {
                const a = j * row + i;
                const b = a + 1;
                const c = a + row;
                const d = c + 1;
                indices.push(a, c, b, b, c, d);
            }
        }

        const mesh = new BABYLON.Mesh(`patch ${tile.uid}`, this.getScene());
        const data = new BABYLON.VertexData();
        data.positions = positions;
        data.uvs = uvs;
        data.indices = indices;
        const normals: number[] = [];
        BABYLON.VertexData.ComputeNormals(positions, indices, normals);
        data.normals = normals;
        data.applyToMesh(mesh);

        const material = new BABYLON.StandardMaterial(`patchMat ${tile.uid}`, this.getScene());
        material.diffuseTexture = texture;
        material.emissiveTexture = texture; // unlit look: readable without a light rig
        material.disableLighting = true;
        material.backFaceCulling = false; // double-sided: winding-independent for the test
        material.useLogarithmicDepth = true; // planet-scale depth precision
        material.wireframe = this._wireframe;
        mesh.material = material;
        mesh.parent = this;
        mesh.alwaysSelectAsActiveMesh = true;
        return mesh;
    }
}
