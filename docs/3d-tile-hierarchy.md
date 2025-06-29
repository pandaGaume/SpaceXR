# 3D Tile Node Hierarchy: Babylon.js Integration vs Engine-Agnostic Design

## Context

When designing a 3D Tiles system (e.g., for rendering terrain or buildings in a LOD-based structure), it is common to build a tile hierarchy where each tile has:

-   A local transformation matrix
-   A bounding volume (box or sphere)
-   A reference to child tiles
-   Optionally, a reference to in-memory content (e.g., meshes, instances...)

In Babylon.js, `TransformNode` provides built-in hierarchical support for transformations and is well integrated with the scene graph. It may appear to be a good candidate for implementing a tile hierarchy.

## Option 1: Use Babylon.js `TransformNode` as Tile Node

Using `TransformNode` directly as the node for your tile tree allows you to:

-   Leverage Babylon’s built-in parent/child system
-   Attach matrices and transformations easily
-   Add children using Babylon’s scene tree
-   Attach content to `TransformNode` via meshes or instances

Example interface:

```ts
interface I3DTileNode extends TransformNode, IBounded {
    content?: any;
    refinement: "REPLACE" | "ADD";
}
```

However, this approach has strong implications:

### pro

-   less code

### cons

-   It couples your tile hierarchy tightly to Babylon.js
-   It makes serialization and cross-platform use more difficult
-   You lose the ability to reuse the same logic in non-JavaScript environments or with other engines (e.g., C++ - apple vision, unreal, c# - unity )

## Option 2: Use an Engine-Agnostic Tile Node and Build an Adapter

Instead of binding your tile tree to a Babylon scene, you can define a standalone structure:

```ts
interface I3DTileNode {
    id: string;
    transform: Matrix4Like;
    boundingBox?: IBounds;
    boundingSphere?: IBoundingSphere;
    children: I3DTileNode[];
    content?: any;
    refinement: "REPLACE" | "ADD";
}
```

Then, in your Babylon.js integration, you write an adapter to create a view of your hierarchy as `TransformNode` instances:

```ts
function attachToScene(tile: I3DTileNode, scene: Scene, parent?: TransformNode): TransformNode {
    const node = new TransformNode(tile.id, scene);
    node.setPreTransformMatrix(tile.transform);
    node.parent = parent ?? null;

    for (const child of tile.children) {
        attachToScene(child, scene, node);
    }

    return node;
}
```

### pro

-   You maintain control over the tile graph structure
-   It is easy to serialize or persist the tile tree in any format (JSON, binary, etc.)
-   The logic can be ported to other languages or engines:
    -   In C++, you can map `I3DTileNode` to a struct or class
    -   In Unity, you can build a parallel `GameObject` hierarchy based on the same tile structure

### cons

-   need of dynamic synch between model & view.

### Portability Strategy

To ensure full portability:

-   Define `I3DTileNode` in a language-neutral way (no dependency on Babylon types)
-   Separate rendering concerns (e.g., Babylon-specific objects) from data structure
-   Provide adapters or bridges for each target platform (e.g., Babylon.js, Unity, WebGPU, native engine)

## Conclusion

Using `TransformNode` directly offers immediate integration benefits with Babylon.js but sacrifices long-term flexibility and engine independence.

Designing an engine-agnostic tile node model gives you:

-   Better maintainability
-   Greater portability
-   Easier testing and serialization
-   Future-proofing for cross-platform use

If portability or reuse is a requirement (e.g., you want to run the same tile system in C++ or Unity), the adapter-based approach is strongly recommended.

## Option 3: Use a 3DTileTree with Adapter Interface (Recommended for Portability)

To maximize separation of concerns and enable cross-platform support, you can abstract the tile rendering logic behind an interface.

### Core Interface

```ts
export interface ITileNodeAdapter {
    setTransform(matrix: Matrix4Like): void;
    attachTo(parent?: ITileNodeAdapter): void;
    setContent(object: any): void;
    updateBoundingVolumes(box?: IBounds, sphere?: IBoundingSphere): void;
    getId(): string;
}
```

Each rendering engine can implement this interface separately.

### Babylon.js Implementation

```ts
export class BabylonTileNodeAdapter implements ITileNodeAdapter {
    private node: TransformNode;

    constructor(id: string, scene: Scene) {
        this.node = new TransformNode(id, scene);
    }

    setTransform(matrix: Matrix4Like): void {
        this.node.setPreTransformMatrix(matrix);
    }

    attachTo(parent?: ITileNodeAdapter): void {
        if (parent instanceof BabylonTileNodeAdapter) {
            this.node.parent = parent.node;
        }
    }

    setContent(uri: string): void {
        // Load mesh, GLB, etc.
    }

    updateBoundingVolumes(box?: IBounds, sphere?: IBoundingSphere): void {
        // Optionally store metadata
    }

    getId(): string {
        return this.node.name;
    }
}
```

### Generic 3DTileTree Builder

```ts
export class TileTreeBuilder {
    constructor(private root: I3DTileNode) {}

    build(adapterFactory: (tile: I3DTileNode) => ITileNodeAdapter): ITileNodeAdapter {
        return this._buildRecursive(this.root, undefined, adapterFactory);
    }

    private _buildRecursive(tile: I3DTileNode, parent: ITileNodeAdapter | undefined, factory: (tile: I3DTileNode) => ITileNodeAdapter): ITileNodeAdapter {
        const adapter = factory(tile);
        adapter.setTransform(tile.transform);
        adapter.updateBoundingVolumes(tile.boundingBox, tile.boundingSphere);
        if (tile.content) adapter.setContent(tile.content);
        adapter.attachTo(parent);

        for (const child of tile.children) {
            this._buildRecursive(child, adapter, factory);
        }

        return adapter;
    }
}
```

### Benefits

-   Full separation of logic and rendering concerns
-   Can be reused across Babylon.js, Three.js, Unity, etc.
-   Facilitates testing, mocking, and headless usage
-   Centralized tree traversal and logic

### cons

-   more code

This is the most flexible and maintainable approach for long-term cross-platform support.
