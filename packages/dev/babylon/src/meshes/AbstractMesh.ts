import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Bounds, IBounded, IBoundingSphere, IBounds } from "core/geometry";

declare module "@babylonjs/core" {
    interface AbstractMesh extends IBounded {}
}

Object.defineProperty(AbstractMesh.prototype, "boundingBox", {
    get: function (): IBounds | undefined {
        const bb = this.getBoundingInfo?.().boundingBox;
        if (!bb) return undefined;
        const min = bb.minimumWorld;
        const max = bb.maximumWorld;
        return new Bounds(min.x, min.y, min.z, max.x - min.x, max.y - min.y, max.z - min.z) as IBounds;
    },
    configurable: true,
    enumerable: true,
});

Object.defineProperty(AbstractMesh.prototype, "boundingSphere", {
    get: function (): IBoundingSphere | undefined {
        const bs = this.getBoundingInfo?.().boundingSphere;
        if (!bs) return undefined;
        return {
            center: bs.centerWorld,
            radius: bs.radiusWorld,
        } as IBoundingSphere;
    },
    configurable: true,
    enumerable: true,
});
