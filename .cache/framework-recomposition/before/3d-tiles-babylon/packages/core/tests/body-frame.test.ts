import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode.js";
import { PerformanceConfigurator } from "@babylonjs/core/Engines/performanceConfigurator.js";
import { describe, expect, it } from "vitest";
import { terrainBodyFrame } from "../src/terrain/gpu/body-frame";
import { PickSurface } from "../src/terrain/gpu/pick-surface";
import { webMercatorTiling } from "../src/terrain/terrain-tiling";
import { instancedGridVertexShader } from "../src/terrain/gpu/shaders/instancedGrid.vertex";
import { createNullScene } from "./helpers";

describe("GPU terrain body frame", () => {
    it("preserves camera-relative vertices for translated body and rotated tangent render frames", () => {
        const scene = createNullScene();
        PerformanceConfigurator.SetMatrixPrecision(true);
        const root = new TransformNode("body", scene);
        try {
            const vertex = new Vector3(1738100.125, 1000.25, -2000.5);
            const bodyEye = new Vector3(1800000.25, 20000.125, -10000.75);
            for (const origin of [new Vector3(1.5e11, -3e8, 2e8), new Vector3(-1738100, 0, 0)]) {
                root.position.copyFrom(origin);
                root.rotationQuaternion = Quaternion.RotationAxis(new Vector3(1, 2, 3).normalize(), 1.2);
                const matrix = root.computeWorldMatrix(true);
                const sceneEye = Vector3.TransformCoordinates(bodyEye, matrix);
                const frame = terrainBodyFrame(sceneEye, root);
                const gpuRelative = Vector3.TransformNormal(vertex.subtract(frame.eye), frame.rotation);
                const expected = Vector3.TransformCoordinates(vertex, matrix).subtract(sceneEye);
                expect(Vector3.Distance(gpuRelative, expected)).toBeLessThan(0.0001);
                expect(frame.rotation.getTranslation().length()).toBe(0);
            }
            const identity = terrainBodyFrame(bodyEye);
            expect(identity.eye.equals(bodyEye)).toBe(true);
            expect(identity.rotation.equals(Matrix.IdentityReadOnly)).toBe(true);
            expect(instancedGridVertexShader.shader).toContain("viewProjection * bodyRotation");
        } finally {
            scene.dispose();
            scene.getEngine().dispose();
        }
    });

    it("parents GPU picking grids to the same body frame and retains layer metadata", () => {
        const scene = createNullScene();
        const root = new TransformNode("body", scene);
        root.position.set(1000, 2000, 3000);
        root.metadata = { bodyId: "arbitrary-body", layerId: "terrain" };
        const pick = new PickSurface(scene, undefined, 1, 4, webMercatorTiling(), root);
        try {
            pick.update([{ lod: 0, x: 0, y: 0 }]);
            const mesh = scene.meshes[0]!;
            expect(mesh.parent).toBe(root);
            expect(mesh.metadata).toEqual(root.metadata);
            expect(mesh.layerMask).toBe(0);
            expect(mesh.isPickable).toBe(true);
        } finally {
            pick.dispose();
            scene.dispose();
            scene.getEngine().dispose();
        }
    });
});
