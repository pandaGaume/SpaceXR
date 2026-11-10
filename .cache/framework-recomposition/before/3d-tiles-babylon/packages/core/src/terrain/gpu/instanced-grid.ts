import { Buffer, type VertexBuffer } from "@babylonjs/core/Buffers/buffer.js";
import type { Material } from "@babylonjs/core/Materials/material.js";
import { Mesh } from "@babylonjs/core/Meshes/mesh.js";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData.js";
import type { Scene } from "@babylonjs/core/scene.js";
import { createJunctionGridTopology, NeighborLod, type IGridTopology } from "@spacexr/grid";
import { TileNeighbor } from "@spacexr/tiles";

/**
 * Instance attributes of the GPU terrain engine, four floats each; see the vertex shader. The elevation references
 * are the area of the instance in a DEM tile, `west, north, size`, and the layer of its page: its own, then those of
 * its edges N, E, S, W and of its corners NW, NE, SE, SW.
 */
export const INSTANCE_ATTRIBUTES = [
    "instPlace",
    "instRotation",
    "instImagery",
    "instElevation",
    "instEdgeN",
    "instEdgeE",
    "instEdgeS",
    "instEdgeW",
    "instCornerNW",
    "instCornerNE",
    "instCornerSE",
    "instCornerSW",
] as const;
/** Extra compact ellipsoid parameters used only by analytic Mercator instances. */
export const RUNTIME_INSTANCE_ATTRIBUTES = [...INSTANCE_ATTRIBUTES, "instSurface", "instNormal"] as const;
export type InstanceAttribute = (typeof RUNTIME_INSTANCE_ATTRIBUTES)[number];

/**
 * The predefined grid of every instance, as in SpaceXR: `cells x cells` cells whose four edges are refined with a
 * vertex in the middle of each cell side, the `Finer` junction variant on every edge. Its edges then hold the vertices
 * of any neighbour one level finer, and the shader moves the edge midpoints onto the edge of a coarser neighbour.
 */
export function refinedGridTopology(cells: number): IGridTopology {
    return createJunctionGridTopology(cells, cells, {
        [TileNeighbor.N]: NeighborLod.Finer,
        [TileNeighbor.E]: NeighborLod.Finer,
        [TileNeighbor.S]: NeighborLod.Finer,
        [TileNeighbor.W]: NeighborLod.Finer,
    });
}

/** The exact fine-side junction topology of a runtime-selected tile. */
export function runtimeGridTopology(cells: number, coarserEdges: number): IGridTopology {
    return createJunctionGridTopology(cells, cells, {
        [TileNeighbor.N]: coarserEdges & 1 ? NeighborLod.Coarser : NeighborLod.Same,
        [TileNeighbor.E]: coarserEdges & 2 ? NeighborLod.Coarser : NeighborLod.Same,
        [TileNeighbor.S]: coarserEdges & 4 ? NeighborLod.Coarser : NeighborLod.Same,
        [TileNeighbor.W]: coarserEdges & 8 ? NeighborLod.Coarser : NeighborLod.Same,
    });
}

/**
 * One predefined grid drawn once per instance: a Babylon mesh drawn with `forcedInstanceCount`, whose instance
 * attributes are interleaved in one vertex buffer with a divisor of one. `position` holds the `u, v` of each vertex.
 * WebGPU devices may only bind 8 vertex buffers to a pipeline: two buffers, the grid and the instances, fit any of
 * them.
 */
export class InstancedGrid {
    public readonly mesh: Mesh;
    private readonly data = new Map<InstanceAttribute, Float32Array>();
    private interleaved = new Float32Array(0);
    private buffer: Buffer | undefined;
    private readonly vertexBuffers: VertexBuffer[] = [];
    private capacity = 0;
    private instances = 0;

    public constructor(
        private readonly scene: Scene,
        name: string,
        topology: IGridTopology,
        material: Material,
        private readonly attributes: readonly InstanceAttribute[] = INSTANCE_ATTRIBUTES,
    ) {
        this.mesh = new Mesh(name, scene);
        const positions = new Float32Array((topology.coordinates.length / 2) * 3);
        for (let vertex = 0; vertex < topology.coordinates.length / 2; vertex++) {
            positions[vertex * 3] = topology.coordinates[vertex * 2]!;
            positions[vertex * 3 + 1] = topology.coordinates[vertex * 2 + 1]!;
        }
        const vertexData = new VertexData();
        vertexData.positions = positions;
        vertexData.indices = topology.indices;
        vertexData.applyToMesh(this.mesh, false);
        this.mesh.material = material;
        // Instances are placed in the shader: the mesh has no meaningful bounds, and the runtimes cull the tiles.
        this.mesh.alwaysSelectAsActiveMesh = true;
        this.mesh.doNotSyncBoundingInfo = true;
        this.mesh.isPickable = false;
        this.reserve(256);
        this.resize(0);
    }

    /** Instances drawn. */
    public get count(): number {
        return this.instances;
    }

    /** Bytes of the instance buffer. */
    public get gpuBytes(): number {
        return this.capacity * this.attributes.length * 16;
    }

    /** Values of an attribute, four floats per instance, valid up to {@link count} instances. */
    public attribute(name: InstanceAttribute): Float32Array {
        return this.data.get(name)!;
    }

    /** Sets the number of instances, growing the buffers when needed; their values must be written next. */
    public resize(count: number): void {
        if (count > this.capacity) this.reserve(Math.max(count, Math.ceil(this.capacity * 1.5)));
        this.instances = count;
        this.mesh.forcedInstanceCount = count;
        this.mesh.setEnabled(count > 0);
    }

    /** Uploads the values of attributes after they were written, interleaved with the others. */
    public upload(...names: readonly InstanceAttribute[]): void {
        for (const name of names) {
            const values = this.data.get(name)!;
            const start = this.attributes.indexOf(name) * 4;
            for (let instance = 0; instance < this.instances; instance++) {
                const from = instance * 4;
                const to = instance * (this.attributes.length * 4) + start;
                this.interleaved[to] = values[from]!;
                this.interleaved[to + 1] = values[from + 1]!;
                this.interleaved[to + 2] = values[from + 2]!;
                this.interleaved[to + 3] = values[from + 3]!;
            }
        }
        this.buffer?.updateDirectly(this.interleaved.subarray(0, this.instances * (this.attributes.length * 4)), 0);
    }

    public dispose(): void {
        for (const vertexBuffer of this.vertexBuffers) vertexBuffer.dispose();
        this.buffer?.dispose();
        this.mesh.dispose();
    }

    private reserve(capacity: number): void {
        for (const name of this.attributes) {
            const data = new Float32Array(capacity * 4);
            const previous = this.data.get(name);
            if (previous) data.set(previous);
            this.data.set(name, data);
        }
        const interleaved = new Float32Array(capacity * (this.attributes.length * 4));
        interleaved.set(this.interleaved);
        this.interleaved = interleaved;
        for (const vertexBuffer of this.vertexBuffers.splice(0)) vertexBuffer.dispose();
        this.buffer?.dispose();
        this.buffer = new Buffer(this.scene.getEngine(), interleaved, true, this.attributes.length * 4, false, true, false, 1);
        this.attributes.forEach((name, index) => {
            const vertexBuffer = this.buffer!.createVertexBuffer(name, index * 4, 4, this.attributes.length * 4, true, false, 1);
            this.vertexBuffers.push(vertexBuffer);
            this.mesh.setVerticesBuffer(vertexBuffer);
        });
        this.capacity = capacity;
    }
}
