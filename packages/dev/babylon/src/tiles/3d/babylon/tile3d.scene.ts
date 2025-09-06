import * as BABYLON from "@babylonjs/core";

import { ITargetBlock, IPipelineMessageType } from "core/tiles";
import { EventState } from "core/events";

import { GetTile3dContents, ITile3d } from "../interfaces";
import { EcefBoxToBjsInPlace, EcefSphereToBjsInPlace } from "../interfaces/math/math";

export interface ITile3DSceneOptions {
    showBox?: boolean;
    showSphere?: boolean;
}

export class Tile3dScene extends BABYLON.TransformNode implements ITargetBlock<ITile3d> {
    public static DefaultOptions: ITile3DSceneOptions = {};

    private readonly _options: ITile3DSceneOptions;

    public constructor(name: string, scene: BABYLON.Scene, options?: ITile3DSceneOptions) {
        super(name, scene);
        this._options = options ?? Tile3dScene.DefaultOptions;
    }

    public getClassName(): string {
        return "Tile3dScene";
    }

    public added(eventData: IPipelineMessageType<ITile3d>, eventState: EventState): void {
        if (eventData && eventData.length) {
            for (const t of eventData) {
                if (t) {
                    this._addContents(t);
                }
            }
        }
    }

    public removed(eventData: IPipelineMessageType<ITile3d>, eventState: EventState): void {
        if (eventData && eventData.length) {
            for (const t of eventData) {
                if (t) {
                    this._removeContents(t);
                }
            }
        }
    }

    public updated(eventData: IPipelineMessageType<ITile3d>, eventState: EventState): void {
        if (eventData && eventData.length) {
            for (const t of eventData) {
                if (t) {
                    this._updateContents(t);
                }
            }
        }
    }

    protected _updateContents(tile: ITile3d): void {
        this._addContents(tile);
    }

    protected _addContents(tile: ITile3d): void {
        const contents = GetTile3dContents(tile);
        if (contents) {
            for (const c of contents) {
                const container = c?.container;
                if (container && container instanceof BABYLON.AssetContainer) {
                    if (c.isLoadedInScene) {
                        continue;
                    }
                    try {
                        if (this._options.showBox) {
                            const originalTileBox = tile.boundingVolume.box;
                            if (originalTileBox) {
                                const transformedTileBox = new Float64Array(originalTileBox);
                                EcefBoxToBjsInPlace(transformedTileBox);
                                this._createMeshFromTileBox(transformedTileBox, this.getScene());
                            }
                        }

                        if (this._options.showSphere) {
                            const originalTileSphere = tile.boundingVolume.sphere;
                            if (originalTileSphere) {
                                const transformedTileSphere = new Float64Array(originalTileSphere);
                                EcefSphereToBjsInPlace(transformedTileSphere);
                                this._createMeshFromTileSphere(transformedTileSphere, this.getScene());
                            }
                        }

                        for (const m of container.getNodes().filter((n) => n.parent == null)) {
                            m.name = `tile ${tile.depth}`;
                        }

                        for (const mat of container.materials) {
                            // this is a trick to keep precision into the z-buffer along large dimension.
                            // instead of that, we might want to scale the scene at reasonable size...
                            mat.useLogarithmicDepth = true;
                            //mat.wireframe = true;
                        }
                        try {
                            container.addAllToScene();
                        } catch {}
                    } finally {
                        c.isLoadedInScene = true;
                    }
                }
            }
        }
    }
    protected _removeContents(tile: ITile3d): void {
        const contents = GetTile3dContents(tile);
        if (contents) {
            for (const c of contents) {
                const container = c?.container;
                if (container && container instanceof BABYLON.AssetContainer) {
                    if (!c.isLoadedInScene) {
                        continue;
                    }
                    try {
                        for (const m of container.getNodes().filter((n) => n.parent == null)) {
                            console.log(`remove ${m.name}`);
                        }

                        container.removeAllFromScene();
                        c.container = undefined;
                    } finally {
                        c.isLoadedInScene = false;
                    }
                }
            }
        }
    }

    /**
     * Create a Babylon.js sphere Mesh from an ITileSphere.
     */
    protected _createMeshFromTileSphere(
        sphere: Float64Array,
        scene: BABYLON.Scene,
        name = "tileSphere",
        options?: {
            segments?: number; // latitude/longitude segments (Babylon uses segments for both)
            color?: BABYLON.Color3;
            alpha?: number;
            doubleSided?: boolean; // disable back-face culling if true
            showEdges?: boolean; // outline edges overlay
            updatable?: boolean; // MeshBuilder option
        }
    ): BABYLON.Mesh {
        const radius = sphere[3];
        if (!sphere || radius <= 0) {
            throw new Error("Invalid sphere: radius must be > 0.");
        }

        const cx = sphere[0];
        const cy = sphere[1];
        const cz = sphere[2];
        const diameter = 2 * radius;

        const mesh = BABYLON.MeshBuilder.CreateSphere(
            name,
            {
                diameter,
                segments: Math.max(8, options?.segments ?? 24),
                updatable: options?.updatable ?? false,
            },
            scene
        );

        mesh.position.set(cx, cy, cz);

        // Material
        const mat = new BABYLON.StandardMaterial(`${name}-mat`, scene);
        mat.diffuseColor = options?.color ?? BABYLON.Color3.FromHexString("#FF9D3D");
        mat.alpha = options?.alpha ?? 0.25;
        mat.backFaceCulling = !(options?.doubleSided ?? false);
        mesh.material = mat;

        // Optional crisp edges overlay (nice for selection/highlight)
        if (options?.showEdges) {
            new BABYLON.EdgesRenderer(mesh, 0.995, false);
        }

        return mesh;
    }

    protected _createMeshFromTileBox(
        box: Float64Array, // number[12]
        scene: BABYLON.Scene,
        name = "tileBox",
        options?: {
            color?: BABYLON.Color3;
            alpha?: number;
            doubleSided?: boolean; // true if you’re unsure about winding
            showEdges?: boolean; // draw an outline
        }
    ): BABYLON.Mesh {
        if (!box || box.length !== 12) {
            throw new Error("TileBox must be number[12]: [C, U, V, W].");
        }

        const C = new BABYLON.Vector3(box[0], box[1], box[2]);
        const U = new BABYLON.Vector3(box[3], box[4], box[5]);
        const V = new BABYLON.Vector3(box[6], box[7], box[8]);
        const W = new BABYLON.Vector3(box[9], box[10], box[11]);

        // 8 corners of the OBB
        const p000 = C.subtract(U).subtract(V).subtract(W);
        const p100 = C.add(U).subtract(V).subtract(W);
        const p010 = C.subtract(U).add(V).subtract(W);
        const p110 = C.add(U).add(V).subtract(W);
        const p001 = C.subtract(U).subtract(V).add(W);
        const p101 = C.add(U).subtract(V).add(W);
        const p011 = C.subtract(U).add(V).add(W);
        const p111 = C.add(U).add(V).add(W);

        // Pack positions
        const positions = [
            p000,
            p100,
            p110,
            p010, // 0..3  bottom (-W)
            p001,
            p101,
            p111,
            p011, // 4..7  top    (+W)
        ].flatMap((p) => [p.x, p.y, p.z]);

        // Indices for 12 triangles (6 faces)
        // Faces listed as quads: each as two triangles.
        // bottom (-W): 0,1,2,3
        // top    (+W): 4,5,6,7
        // -V: 0,4,5,1
        // +V: 3,2,6,7
        // -U: 0,3,7,4
        // +U: 1,5,6,2
        let indices = [
            // bottom
            0, 1, 2, 0, 2, 3,
            // top
            4, 6, 5, 4, 7, 6,
            // -V
            0, 4, 5, 0, 5, 1,
            // +V
            3, 2, 6, 3, 6, 7,
            // -U
            0, 3, 7, 0, 7, 4,
            // +U
            1, 5, 6, 1, 6, 2,
        ];

        // If you want to be totally safe about face culling, duplicate faces on both sides.
        const makeDoubleSided = !!options?.doubleSided;
        if (makeDoubleSided) {
            const flipped = [];
            for (let i = 0; i < indices.length; i += 3) {
                flipped.push(indices[i], indices[i + 2], indices[i + 1]); // reverse winding
            }
            indices = indices.concat(flipped);
        }

        // Compute normals
        const normals: number[] = [];
        BABYLON.VertexData.ComputeNormals(positions, indices, normals);

        // Build mesh
        const mesh = new BABYLON.Mesh(name, scene);
        const vd = new BABYLON.VertexData();
        vd.positions = positions;
        vd.indices = indices;
        vd.normals = normals;
        vd.applyToMesh(mesh, true);

        // Simple material
        const mat = new BABYLON.StandardMaterial(`${name}-mat`, scene);
        mat.diffuseColor = options?.color ?? BABYLON.Color3.FromHexString("#3DA5FF");
        mat.alpha = options?.alpha ?? 0.2;
        mat.backFaceCulling = !makeDoubleSided; // if double-sided, disable culling
        mesh.material = mat;

        // Optional crisp edges overlay (looks like wireframe but cleaner)
        if (options?.showEdges) {
            // High epsilon avoids overdraw artifacts
            new BABYLON.EdgesRenderer(mesh, 0.999, false);
        }

        return mesh;
    }

    protected _createContainerBoundingBox(container: BABYLON.AssetContainer, scene: BABYLON.Scene): BABYLON.Mesh {
        if (container.meshes.length === 0) {
            throw new Error("Container has no meshes");
        }

        // Init min/max avec le premier mesh
        let min = new BABYLON.Vector3(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
        let max = new BABYLON.Vector3(-Number.MAX_VALUE, -Number.MAX_VALUE, -Number.MAX_VALUE);

        for (const mesh of container.meshes) {
            if (!mesh.getBoundingInfo) continue;

            const bounding = mesh.getBoundingInfo().boundingBox;
            const vmin = bounding.minimumWorld;
            const vmax = bounding.maximumWorld;

            min = BABYLON.Vector3.Minimize(min, vmin);
            max = BABYLON.Vector3.Maximize(max, vmax);
        }

        // Dimensions et centre
        const size = max.subtract(min);
        const center = min.add(size.scale(0.5));

        // Crée une box wireframe
        const box = BABYLON.MeshBuilder.CreateBox(
            "containerBBox",
            {
                width: size.x,
                height: size.y,
                depth: size.z,
            },
            scene
        );

        box.position.copyFrom(center);

        const mat = new BABYLON.StandardMaterial("bboxMat", scene);
        mat.wireframe = true;
        mat.emissiveColor = BABYLON.Color3.Red(); // plus visible
        box.material = mat;

        return box;
    }
}
