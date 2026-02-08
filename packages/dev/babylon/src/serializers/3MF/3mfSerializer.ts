// Babylonjs
import type { Mesh, SubMesh } from "@babylonjs/core/Meshes";
import type { InstancedMesh } from "@babylonjs/core/Meshes/instancedMesh";
import { Matrix } from "@babylonjs/core/Maths/math";
import { Tools } from "@babylonjs/core/Misc/tools";

// 3MF
import { IncrementalIdFactory } from "./core/model/3mf.utils";
import { ThreeMfMeshBuilder, ThreeMfModelBuilder } from "./core/model/3mf.builder";
import { Matrix3d } from "./core/model/3mf.math";

import type { I3mfModel, I3mfObject } from "./core/model/3mf.interfaces";
import type { I3mfVertexData } from "./core/model/3mf.types";
import { AbstractThreeMfSerializer, IThreeMfSerializerOptions } from "./core/model/3mf.serializer";
import { ThreeMfSerializerGlobalConfiguration } from "./3mfSerializer.configuration";

/**
 *
 */
export class BjsThreeMfSerializer extends AbstractThreeMfSerializer<Mesh | InstancedMesh> {

    private static _PositionKind = "position";

    private _fflateReadyPromise?: Promise<any>;

    /**
     *
     * @param opts
     */
    public constructor(opts: Partial<IThreeMfSerializerOptions> = {}) {
        super(opts);
    }

    public override toModel(meshes: Array<Mesh | InstancedMesh>): I3mfModel  {
        const idFactory = new IncrementalIdFactory();

        const modelBuilder = new ThreeMfModelBuilder();
        const index = new Map<Mesh | SubMesh, I3mfObject>();

        // first pass to build every model from mesh - keep it simple
        const instances: Array<InstancedMesh> | null = this.options.exportInstances ? [] : null;

        for (let j = 0; j < meshes.length; j++) {
            if (meshes[j].isAnInstance) {
                instances?.push(meshes[j] as InstancedMesh);
                continue;
            }
            const babylonMesh = meshes[j] as Mesh;
            const objectName = babylonMesh.name || `mesh${j}`;
            const worldTransform = babylonMesh.getWorldMatrix();
            const buildTransform = this._handleBjsTo3mfMatrixTransformToRef(worldTransform, Matrix3d.Zero())

             // into 3MF Submeshes are important because they may carry color information...
            if (this.options.exportSubmeshes ) {
                const subMeshes = babylonMesh.subMeshes;

                if (subMeshes && subMeshes.length > 0) {
                    for (let k = 0; k < subMeshes.length; k++) {
                        const subMesh = subMeshes[k];
                        const data = this._extractSubMesh(babylonMesh, subMesh);
                        if (data) {
                            const submeshName = `${objectName}_${k}`;
                            const object = new ThreeMfMeshBuilder(idFactory.next())
                                .withData(data)
                                .withName(submeshName)
                                .build();
                            modelBuilder.withMesh(object);
                            // lets add a build to ref the object
                            modelBuilder.withBuild(object.id,buildTransform);
                            index.set(subMesh, object);
                        }
                    }
                }
            } else {
                const data = {
                    positions: babylonMesh.getVerticesData(BjsThreeMfSerializer._PositionKind) || [],
                    indices: babylonMesh.getIndices() || [],
                };
                const object = new ThreeMfMeshBuilder(idFactory.next()).withData(data).withName(objectName).build();
                modelBuilder.withMesh(object);
                // lets add a build to ref the object
                modelBuilder.withBuild(object.id,buildTransform);

                index.set(babylonMesh, object);
            }
        }

        // second pass to instances - the reason is the instance will be saved as 3MF Component with a transformation associed
        // if we export the sub meshes, then we have to add an object per submesh, while the submeshes are exported as whole object
        if (instances && instances.length) {
            // group the instance per mesh, then the xml will be more readable with a Components container per mesh.
            const grouped = this._groupBy(instances, (i) => i.sourceMesh);

            for (const [_babylonMesh, _instances] of Array.from(grouped.entries())) {
                if (_instances && _instances.length) {
                    for (let j = 0; j < _instances.length; j++) {
                        const mesh = _instances[j];
                        const worldTransform = mesh.getWorldMatrix();

                        // process sub meshes
                        const subMeshes = _babylonMesh.subMeshes;
                        if (this.options.exportSubmeshes && subMeshes && subMeshes.length > 0) {
                            for (let k = 0; k < subMeshes.length; k++) {
                                const subMesh = subMeshes[k];

                                // we may speed up the search using a cache to the lastest mesh/object pair
                                const objectRef = index.get(subMesh);

                                if (objectRef) {
                                    // we build a single component
                                    modelBuilder.withBuild(objectRef.id, this._handleBjsTo3mfMatrixTransformToRef(worldTransform, Matrix3d.Zero()));
                                    continue;
                                }
                            }
                            continue;
                        }

                        const objectRef = index.get(_babylonMesh);
                        if (objectRef) {
                            // we build a single component
                            modelBuilder.withBuild(objectRef.id, this._handleBjsTo3mfMatrixTransformToRef(worldTransform, Matrix3d.Zero()));
                            continue;
                        }
                    }
                }
            }
        }

        return modelBuilder.build();
    }

    public override async ensureZipLibReadyAsync(): Promise<any> {
        if (this._fflateReadyPromise) {
            return await this._fflateReadyPromise;
        }

        this._fflateReadyPromise = (async () => {
            // globalThis is the glogal object whatever the environment : ie windows
            const g = globalThis as any;

            if (!g.fflate) {
                await Tools.LoadScriptAsync(ThreeMfSerializerGlobalConfiguration.FFLATEUrl);
            }

            return g.fflate;
        })();

        return await this._fflateReadyPromise;
    }

    private _extractSubMesh(mesh: Mesh, sm: SubMesh): I3mfVertexData | undefined {
        const allInd = mesh.getIndices();
        if (!allInd) {
            return undefined;
        }

        const allPos = mesh.getVerticesData(BjsThreeMfSerializer._PositionKind);
        if (!allPos) {
            return undefined;
        }
        if (sm.indexStart == 0 && sm.indexCount == allInd.length) {
            return {
                positions: allPos,
                indices: allInd,
            };
        }
        const indStart = sm.indexStart;

        const map = new Map<number, number>(); // oldIndex -> newIndex
        const newPositions: number[] = [];
        const newIndices = new Uint32Array(sm.indexCount);

        for (let i = 0; i < sm.indexCount; i++) {
            const oldVi = allInd[indStart + i];

            let newVi = map.get(oldVi);
            if (newVi === undefined) {
                newVi = map.size;
                map.set(oldVi, newVi);

                const p = oldVi * 3;
                newPositions.push(allPos[p], allPos[p + 1], allPos[p + 2]);
            }

            newIndices[i] = newVi;
        }

        return {
            positions: new Float32Array(newPositions),
            indices: newIndices,
        };
    }

    private _groupBy<T, K>(items: readonly T[], key: (v: T) => K): Map<K, T[]> {
        const m = new Map<K, T[]>();
        for (const it of items) {
            const k = key(it);
            const arr = m.get(k);
            if (arr) {
                arr.push(it);
            } else {
                m.set(k, [it]);
            }
        }
        return m;
    }

    private static readonly _R_BJS_TO_3MF = Matrix.RotationX(Math.PI / 2);

    /**
     * Converts a Babylon.js 4x4 matrix into a 3MF 3x4 transform matrix and writes the result into ref.
     *
     * Babylon.js conventions:
     * Babylon.js exposes matrices with logical row/column indexing (M(row, column)),
     * but stores the 16 coefficients in a contiguous Float32Array using row-major order.
     * In other words, tmp.m is laid out as:
     * [ M00, M01, M02, M03,
     *   M10, M11, M12, M13,
     *   M20, M21, M22, M23,
     *   M30, M31, M32, M33 ]
     *
     * Babylon operations (multiply, TransformCoordinates, etc.) are consistent with this storage.
     *
     * 3MF expectation:
     * 3MF expects an affine transform as a 3x4 matrix (12 values) ordered as:
     * m00 m01 m02  m10 m11 m12  m20 m21 m22  m30 m31 m32
     * (the 4th column M03, M13, M23, M33 is not part of the 3x4 representation).
     *
     * How it works:
     * 1) First compose the Babylon transform with the basis change matrix _R_BJS_TO_3MF:
     *    tmp = tBjs * _R_BJS_TO_3MF
     * 2) Then read tmp.m (Babylon row-major storage) and extract the 12 required coefficients in 3MF order:
     *    row 0: a[0],  a[1],  a[2]
     *    row 1: a[4],  a[5],  a[6]
     *    row 2: a[8],  a[9],  a[10]
     *    row 3: a[12], a[13], a[14]
     *
     * Interop note:
     * Do not transpose here. This code relies on Babylon's row-major memory layout and only reorders
     * values to match the 3MF 3x4 format. Transposition/reinterpretation is only needed when interfacing
     * with systems that assume column-major storage.
     *
     * @param tBjs Babylon.js 4x4 matrix (logical M(row, column), row-major storage in tBjs.m).
     * @param ref Output 3MF matrix (3x4). ref.values receives 12 numbers in 3MF order.
     * @returns ref, for chaining.
     */
    private _handleBjsTo3mfMatrixTransformToRef(tBjs: Matrix, ref: Matrix3d): Matrix3d {
        const tmp = tBjs.multiplyToRef(BjsThreeMfSerializer._R_BJS_TO_3MF, Matrix.Zero());
        const a = tmp.m;
        // a is still Babylon storage, but now the semantic rows/cols match 3MF expectation.
        // 3MF order: m00 m01 m02 m10 m11 m12 m20 m21 m22 m30 m31 m32
        ref.values = [a[0], a[1], a[2], 
                      a[4], a[5], a[6], 
                      a[8], a[9], a[10], 
                      a[12], a[13], a[14]];
        return ref;
    }
}
