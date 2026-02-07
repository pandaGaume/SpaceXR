// Babylonjs
import type { Mesh, SubMesh } from "@babylonjs/core/Meshes";
import type { InstancedMesh } from "@babylonjs/core/Meshes/instancedMesh";
import { Matrix } from "@babylonjs/core/Maths/math";
import { Tools } from "@babylonjs/core/Misc/tools";

// 3MF
import { IncrementalIdFactory } from "./core/model/3mf.utils";
import { ThreeMfDocumentBuilder, ThreeMfMeshBuilder, ThreeMfModelBuilder } from "./core/model/3mf.builder";
import { ContentTypeFileName, ModelFileName, Object3dDirName, RelationshipDirName, RelationshipFileName, type I3mfDocument } from "./core/model/3mf.opc.interfaces";
import { Matrix3d } from "./core/model/3mf.math";

import { ThreeMfSerializerGlobalConfiguration } from "./3mfSerializer.configuration";
import { XmlBuilder } from "./core/xml/xml.builder";
import { XmlSerializer } from "./core/xml/xml.serializer";
import { type ByteSink, Utf8XmlWriterToBytes } from "./core/xml/xml.builder.bytes";
import type { I3mfObject } from "./core/model/3mf.interfaces";
import type { I3mfVertexData } from "./core/model/3mf.types";

/**
 *
 */
export interface IThreeMfSerializerOptions {
    /**  */
    exportInstances?: boolean;
    /**  */
    exportSubmeshes?: boolean;
}

/**
 *
 */
export class ThreeMfSerializer {
    private static _PositionKind = "position";

    /**
     *
     */
    static DEFAULT_3MF_EXPORTER_OPTIONS: IThreeMfSerializerOptions = {
        exportInstances: false,
        exportSubmeshes: false,
    };

    private _o: IThreeMfSerializerOptions;
    /**
     *
     * @param opts
     */
    public constructor(opts: Partial<IThreeMfSerializerOptions> = {}) {
        this._o = { ...ThreeMfSerializer.DEFAULT_3MF_EXPORTER_OPTIONS, ...opts };
    }

    /**
     *
     */
    public get options(): Readonly<IThreeMfSerializerOptions> {
        return this._o;
    }

    /**
     *
     * @param meshes
     * @returns
     */
    public async serializeToMemoryAsync(meshes: Array<Mesh | InstancedMesh>): Promise<Uint8Array | undefined> {
        const chunks = new Array<Uint8Array>();
        let size = 0;
        const sink = function (err: any, chunk: Uint8Array, _final: boolean) {
            chunks.push(chunk);
            size += chunk.length;
        };
        await this.serializeAsync(meshes, sink);
        if (size) {
            const buffer = new Uint8Array(size);
            let off = 0;
            for (const c of chunks) {
                buffer.set(c, off);
                off += c.length;
            }
            return buffer;
        }
        return undefined;
    }

    /**
     * Generic 3MF binary serializer.
     * @param meshes the meshes to serialize.
     * @param sink we use sink to acumulate chunk of data into a target. This let's the opportunity to stream the output without storing huge amount of memory.
     */
    public async serializeAsync(meshes: Array<Mesh | InstancedMesh>, sink: (err: any, chunk: Uint8Array, final: boolean) => void): Promise<void> {
        const lib = await this._ensureZipLibReadyAsync();
        if (lib) {
            const zip = lib.Zip;
            const zipDeflate = lib.ZipDeflate;

            if (!zip || !zipDeflate) {
                throw new Error("fflate Zip / ZipDeflate not available");
            }

            const makeByteSinkFromFflateEntry = function (entry: any): ByteSink {
                return { push: (chunk: any, final: any) => entry.push(chunk, final) };
            };

            const serializeEntry = function (target: any, name: string, object: any) {
                const entry = new zipDeflate(name, { level: 6 });
                target.add(entry);
                const sink = makeByteSinkFromFflateEntry(entry);
                const w = new Utf8XmlWriterToBytes(sink);
                const b = new XmlBuilder(w).dec("1.0", "UTF-8");
                const s = new XmlSerializer(b);
                s.serialize(object);
                w.finish();
            };

            const doc = this.toDocument(meshes);
            if (doc) {
                const target = new zip(sink);

                // save the root content type
                serializeEntry(target, ContentTypeFileName, doc.contentTypes);

                // save the relationships
                serializeEntry(target, `${RelationshipDirName}${RelationshipFileName}`, doc.relationships);

                // save the model
                serializeEntry(target, `${Object3dDirName}${ModelFileName}`, doc.model);

                target.end();
            }
        }
    }

    /**
     *
     * @param meshes
     * @returns
     */
    public toDocument(meshes: Array<Mesh | InstancedMesh>): I3mfDocument | undefined {
        const idFactory = new IncrementalIdFactory();

        const modelBuilder = new ThreeMfModelBuilder();
        const index = new Map<Mesh | SubMesh, I3mfObject>();

        // first pass to build every model from mesh - keep it simple
        const instances: Array<InstancedMesh> | null = this._o.exportInstances ? [] : null;

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
            if (this._o.exportSubmeshes ) {
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
                    positions: babylonMesh.getVerticesData(ThreeMfSerializer._PositionKind) || [],
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
                        if (this._o.exportSubmeshes && subMeshes && subMeshes.length > 0) {
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

        const docBuilder = new ThreeMfDocumentBuilder().withModel(modelBuilder);

        return docBuilder.build();
    }

    private _extractSubMesh(mesh: Mesh, sm: SubMesh): I3mfVertexData | undefined {
        const allInd = mesh.getIndices();
        if (!allInd) {
            return undefined;
        }

        const allPos = mesh.getVerticesData(ThreeMfSerializer._PositionKind);
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

    private _handleBjsTo3mfMatrixTransformToRef(tBjs: Matrix, ref: Matrix3d): Matrix3d {
        const tmp = ThreeMfSerializer._R_BJS_TO_3MF.multiplyToRef(tBjs, Matrix.Zero()).transpose();
        const a = tmp.m;
        // a is still Babylon storage, but now the semantic rows/cols match 3MF expectation.
        // 3MF order: m00 m01 m02 m10 m11 m12 m20 m21 m22 m30 m31 m32
        ref.values = [a[0], a[4], a[8], a[1], a[5], a[9], a[2], a[6], a[10], a[3], a[7], a[11]];
        return ref;
    }

    private _fflateReadyPromise?: Promise<any>;

    private async _ensureZipLibReadyAsync(): Promise<any> {
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
}
