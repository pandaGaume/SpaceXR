import { Bounds, IBounded, IBounds, IsBounds } from "../geometry";
import { IKdtreeSplitter, ISpatialTreeNode, ISpatialTreeOptions, ISplitter, RoundRobin } from "./tree.spatial.interfaces";

export class QuadtreeSplitter<T extends IBounds | IBounded> implements ISplitter<T> {
    public split(node: ISpatialTreeNode<T>, options: ISpatialTreeOptions<T>): Array<IBounds> {
        if (node.boundingBox) {
            const { xmin, ymin, zmin, width, height } = node.boundingBox;
            const halfWidth = width / 2;
            const halfHeight = height / 2;
            const midX = xmin + halfWidth;
            const midY = ymin + halfHeight;
            return [
                new Bounds(xmin, ymin, halfWidth, halfHeight, zmin, 0),
                new Bounds(xmin, midY, halfWidth, halfHeight, zmin, 0), // Top-left
                new Bounds(midX, ymin, halfWidth, halfHeight, zmin, 0), // Bottom-right
                new Bounds(midX, midY, halfWidth, halfHeight, zmin, 0), // Top-right
            ];
        }
        return [] as Array<IBounds>;
    }
}

export class OctreeSplitter<T extends IBounds | IBounded> implements ISplitter<T> {
    public split(node: ISpatialTreeNode<T>, options: ISpatialTreeOptions<T>): Array<IBounds> {
        if (node.boundingBox) {
            const { xmin, ymin, zmin, width, height, depth } = node.boundingBox;
            const halfWidth = width / 2;
            const halfHeight = height / 2;
            const midX = xmin + halfWidth;
            const midY = ymin + halfHeight;

            const halfDepth = depth / 2;
            const midZ = zmin + halfDepth;

            return [
                new Bounds(xmin, ymin, halfWidth, halfHeight, zmin, halfDepth), // Bottom-left-front
                new Bounds(xmin, midY, halfWidth, halfHeight, zmin, halfDepth), // Top-left-front
                new Bounds(midX, ymin, halfWidth, halfHeight, zmin, halfDepth), // Bottom-right-front
                new Bounds(midX, midY, halfWidth, halfHeight, zmin, halfDepth), // Top-right-front
                new Bounds(xmin, ymin, halfWidth, halfHeight, midZ, halfDepth), // Bottom-left-back
                new Bounds(xmin, midY, halfWidth, halfHeight, midZ, halfDepth), // Top-left-back
                new Bounds(midX, ymin, halfWidth, halfHeight, midZ, halfDepth), // Bottom-right-back
                new Bounds(midX, midY, halfWidth, halfHeight, midZ, halfDepth), // Top-right-back
            ];
        }
        return [] as Array<IBounds>;
    }
}

export class KdtreeSplitter<T extends IBounds | IBounded> implements IKdtreeSplitter<T> {
    public splitAxisSelector?: (depth: number, dimension: number) => number;
    public dimension?: 2 | 3;

    public constructor(splitAxisSelector?: (depth: number, dimension: number) => number, dimension: 2 | 3 = 2) {
        this.splitAxisSelector = splitAxisSelector;
        this.dimension = dimension;
    }

    public split(node: ISpatialTreeNode<T>, options: ISpatialTreeOptions<T>): Array<IBounds> {
        if (node.boundingBox) {
            const { xmin, ymin, zmin, width, height, depth } = node.boundingBox;
            const halfWidth = width / 2;
            const halfHeight = height / 2;
            const midX = xmin + halfWidth;
            const midY = ymin + halfHeight;

            const halfDepth = depth / 2;
            const midZ = zmin + halfDepth;
            const axe = this.splitAxisSelector ? this.splitAxisSelector(node.depth, this.dimension ?? 3) : RoundRobin(node.depth, this.dimension ?? 3);
            switch (axe) {
                case 0: // X-axis
                    let center = node.items?.data.map((item) => (IsBounds(item) ? item.center.x : item.boundingBox?.center.x ?? midX));
                    if (center && center.length > 0) {
                        const splitPlane = center.reduce((a, b) => a + b, 0) / center.length;
                        const size = splitPlane - xmin;
                        return [
                            new Bounds(xmin, ymin, size, height, zmin, depth), // Left
                            new Bounds(splitPlane, ymin, size, height, zmin, depth), // Right
                        ];
                    }
                    break;
                case 1: // Y-axis
                    center = node.items?.data.map((item) => (IsBounds(item) ? item.center.y : item.boundingBox?.center.y ?? midY));
                    if (center && center.length > 0) {
                        const splitPlane = center.reduce((a, b) => a + b, 0) / center.length;
                        const size = splitPlane - ymin;
                        return [
                            new Bounds(xmin, ymin, width, size, zmin, depth), // bottom
                            new Bounds(xmin, splitPlane, width, size, zmin, depth), // top
                        ];
                    }
                    break;
                case 2: // Z-axis
                    center = node.items?.data.map((item) => (IsBounds(item) ? item.center.z : item.boundingBox?.center.z ?? midZ));
                    if (center && center.length > 0) {
                        const splitPlane = center.reduce((a, b) => a + b, 0) / center.length;
                        const size = splitPlane - zmin;
                        return [
                            new Bounds(xmin, ymin, width, height, zmin, size), // lower
                            new Bounds(xmin, ymin, width, height, splitPlane, size), // upper
                        ];
                    }
                    break;
            }
        }
        return [] as Array<IBounds>;
    }
}
