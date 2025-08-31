import * as BABYLON from "@babylonjs/core";

import { ITargetBlock, IPipelineMessageType } from "core/tiles";
import { EventState } from "core/events";

import { GetTile3dContents, ITile3d } from "../interfaces";

export class Tile3dScene extends BABYLON.TransformNode implements ITargetBlock<ITile3d> {
    public constructor(name: string, scene: BABYLON.Scene) {
        super(name, scene);
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
                if (container) {
                    if (c.isLoadedInScene) {
                        continue;
                    }
                    try {
                        for (const m of container.rootNodes) {
                            m.parent = this;
                        }
                        for (const mat of container.materials) {
                            // this is a trick to keep precision into the z-buffer along large dimension.
                            // instead of that, we might want to scale the scene at reasonable size...
                            mat.useLogarithmicDepth = true;
                            //mat.wireframe = true;
                        }
                        container.addAllToScene();
                        //const box = this._createContainerBoundingBox(container, this.getScene());
                        //box.parent = this;
                    } finally {
                        c.isLoadedInScene = true;
                    }
                }
            }
        }
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

    protected _removeContents(tile: ITile3d): void {
        const contents = GetTile3dContents(tile);
        if (contents) {
            for (const c of contents) {
                const container = c?.container;
                if (container) {
                    if (!c.isLoadedInScene) {
                        continue;
                    }
                    try {
                        for (const m of container.rootNodes) {
                            m.parent = null;
                        }
                        container.removeAllFromScene();
                    } finally {
                        c.isLoadedInScene = false;
                    }
                }
            }
        }
    }

    protected _flipWindingAndRecomputeNormals(mesh: BABYLON.Mesh): void {
        const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
        const indices = mesh.getIndices();

        if (!positions || !indices) return;

        // 1) Inverser l’ordre des sommets de chaque triangle (i, i+1, i+2) -> (i, i+2, i+1)
        for (let i = 0; i < indices.length; i += 3) {
            const tmp = indices[i + 1];
            indices[i + 1] = indices[i + 2];
            indices[i + 2] = tmp;
        }

        // 2) Recalculer les normales
        const normals = new Array<number>(positions.length);
        BABYLON.VertexData.ComputeNormals(positions, indices, normals);

        // 3) Appliquer au mesh
        mesh.setIndices(indices);
        if (mesh.isVerticesDataPresent(BABYLON.VertexBuffer.NormalKind)) {
            mesh.updateVerticesData(BABYLON.VertexBuffer.NormalKind, normals, true);
        } else {
            mesh.setVerticesData(BABYLON.VertexBuffer.NormalKind, normals, true);
        }

        // Optionnel: si le mesh paraît « à l’envers », vérifier le culling
        // mesh.material && (mesh.material.backFaceCulling = true);
    }
}
