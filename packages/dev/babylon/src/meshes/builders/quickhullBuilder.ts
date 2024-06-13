import { Mesh, Nullable, Vector3, VertexBuffer, VertexData } from "@babylonjs/core";
import { QuickHull } from "core/geometry";

export function CreateQuickHull(name: string, source: Mesh): Nullable<Mesh> {
    const quickHull = new QuickHull();
    const localVertices = source.getVerticesData(VertexBuffer.PositionKind);
    if (!localVertices) {
        return null;
    }

    const vectors = [];
    let worldMatrix = source.getWorldMatrix();
    for (let i = 0; i < localVertices.length; i += 3) {
        let localVertex = new Vector3(localVertices[i], localVertices[i + 1], localVertices[i + 2]);
        let worldVertex = Vector3.TransformCoordinates(localVertex, worldMatrix);
        vectors.push(worldVertex);
    }

    try {
        const convexHull = quickHull.generateHull(vectors);
        const data = new VertexData();
        data.positions = convexHull.vertices.flatMap((v) => [v.x, v.y, v.z]);
        data.indices = convexHull.faces;
        data.normals = convexHull.normals.flatMap((v) => [v.x, v.y, v.z]);
        const hull = new Mesh(name, source.getScene());
        data.applyToMesh(hull);
        return hull;
    } catch (e) {
        console.error(e);
        return null;
    }
}
