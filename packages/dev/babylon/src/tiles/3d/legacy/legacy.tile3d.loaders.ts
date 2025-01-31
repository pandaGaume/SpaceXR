import { AbstractMesh, Mesh, Nullable, PointsCloudSystem, Scene, SceneLoader, Vector3 } from "@babylonjs/core";

export abstract class Tile3dLoader<T> {
    _scene: Scene;

    constructor(scene: Scene) {
        this._scene = scene;
    }

    abstract loadAsync(url: string): Promise<T>;
}

export class B3DMLoader extends Tile3dLoader<AbstractMesh[]> {
    constructor(scene: Scene) {
        super(scene);
    }

    public async loadAsync(url: string): Promise<AbstractMesh[]> {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const { glbData } = this._parseB3DM(arrayBuffer);
        return await this._loadGLBAsync(glbData);
    }

    _parseB3DM(arrayBuffer: ArrayBuffer) {
        const byteOffset = 28; // Header is 28 bytes
        const glbData = arrayBuffer.slice(byteOffset);
        return { glbData };
    }

    async _loadGLBAsync(glbData: ArrayBuffer): Promise<AbstractMesh[]> {
        return new Promise((resolve, reject) => {
            const blob = new Blob([glbData], { type: "model/gltf-binary" });
            const objectURL = URL.createObjectURL(blob);

            SceneLoader.ImportMesh(
                "",
                objectURL,
                "",
                this._scene,
                (meshes) => {
                    URL.revokeObjectURL(objectURL);
                    resolve(meshes);
                },
                null,
                (scene, message) => {
                    reject(new Error("Failed to load GLB: " + message));
                },
                ".glb"
            );
        });
    }
}

export class I3DMLoader extends Tile3dLoader<AbstractMesh[]> {
    _parent: Nullable<Node>;

    constructor(scene: Scene, parent: Nullable<Node> = null) {
        super(scene);
        this._parent = parent;
    }

    public async loadAsync(url: string): Promise<AbstractMesh[]> {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const { glbData, instances } = this._parseI3DM(arrayBuffer);
        return await this._loadInstancesAsync(glbData, instances, this._parent);
    }

    _parseI3DM(arrayBuffer: ArrayBuffer) {
        const byteOffset = 32; // Header is 32 bytes
        const glbData = arrayBuffer.slice(byteOffset);
        const instances = this._extractInstances(arrayBuffer, byteOffset);
        return { glbData, instances };
    }

    _extractInstances(arrayBuffer: ArrayBuffer, offset: number) {
        // Extract transformation matrices for instances
        const instanceCount = new DataView(arrayBuffer, offset, 4).getUint32(0, true);
        const instanceData = new Float32Array(arrayBuffer, offset + 4, instanceCount * 12);
        return instanceData;
    }

    async _loadInstancesAsync(glbData: ArrayBuffer, instances: Float32Array, parent: Nullable<Node> = null): Promise<AbstractMesh[]> {
        const meshes = await new B3DMLoader(this._scene)._loadGLBAsync(glbData);
        const baseMesh = meshes[0];

        for (let index = 0; index < instances.length; index += 12) {
            const clone = baseMesh.clone(`instance_${index / 12}`, null);
            if (clone) {
                clone.position = new Vector3(instances[index], instances[index + 1], instances[index + 2]);
            }
        }
        return meshes;
    }
}

export class PNTSLoader extends Tile3dLoader<Mesh | undefined> {
    constructor(scene: Scene) {
        super(scene);
    }

    public async loadAsync(url: string): Promise<Mesh | undefined> {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const positions = this._parsePNTS(arrayBuffer);
        return this._createPointCloud(positions);
    }

    _parsePNTS(arrayBuffer: ArrayBuffer): Float32Array {
        const byteOffset = 28;
        return new Float32Array(arrayBuffer, byteOffset);
    }

    _createPointCloud(positions: Float32Array): Mesh | undefined {
        const pcs = new PointsCloudSystem("pcs", 1, this._scene);
        for (let i = 0; i < positions.length; i += 3) {
            pcs.addPoints(1, (particle: any) => {
                particle.position = new Vector3(positions[i], positions[i + 1], positions[i + 2]);
            });
        }
        pcs.buildMeshAsync();
        return pcs.mesh;
    }
}

export class CMPTLoader extends Tile3dLoader<AbstractMesh[][]> {
    constructor(scene: Scene) {
        super(scene);
    }

    public async loadAsync(url: string): Promise<AbstractMesh[][]> {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const tileDataArray = this._parseCMPT(arrayBuffer);

        const promises = tileDataArray.map((tileData) => {
            return this._loadTileAsync(tileData);
        });
        return Promise.all(promises);
    }

    _parseCMPT(arrayBuffer: ArrayBuffer) {
        const byteOffset = 16; // Header is 16 bytes
        const tiles = [];
        let offset = byteOffset;

        while (offset < arrayBuffer.byteLength) {
            const tileLength = new DataView(arrayBuffer, offset, 4).getUint32(0, true);
            tiles.push(arrayBuffer.slice(offset, offset + tileLength));
            offset += tileLength;
        }
        return tiles;
    }

    async _loadTileAsync(tileData: ArrayBuffer): Promise<AbstractMesh[]> {
        return new B3DMLoader(this._scene)._loadGLBAsync(tileData);
    }
}
