/**
 * From Copyright 2019 Oskar Sigvardsson
 */

import { Assert } from "../utils";
import { Cartesian3 } from "./geometry.cartesian";
import { ICartesian3 } from "./geometry.interfaces";

/// <summary>
///   Struct representing a single face.
///
///   Vertex0, Vertex1 and Vertex2 are the vertices in CCW order. They
///   acutal points are stored in the points array, these are just
///   indexes into that array.
///
///   Opposite0, Opposite1 and Opposite2 are the keys to the faces which
///   share an edge with this face. Opposite0 is the face opposite
///   Vertex0 (so it has an edge with Vertex2 and Vertex1), etc.
///
///   Normal is (unsurprisingly) the normal of the triangle.
/// </summary>
class Face {
    Vertex0: number;
    Vertex1: number;
    Vertex2: number;

    Opposite0: number;
    Opposite1: number;
    Opposite2: number;

    Normal: ICartesian3;

    public constructor(v0: number, v1: number, v2: number, o0: number, o1: number, o2: number, normal: ICartesian3) {
        this.Vertex0 = v0;
        this.Vertex1 = v1;
        this.Vertex2 = v2;
        this.Opposite0 = o0;
        this.Opposite1 = o1;
        this.Opposite2 = o2;
        this.Normal = normal;
    }

    public Equals(other: Face): boolean {
        return (
            this.Vertex0 == other.Vertex0 &&
            this.Vertex1 == other.Vertex1 &&
            this.Vertex2 == other.Vertex2 &&
            this.Opposite0 == other.Opposite0 &&
            this.Opposite1 == other.Opposite1 &&
            this.Opposite2 == other.Opposite2 &&
            this.Normal == other.Normal
        );
    }
}

/// <summary>
///   Struct representing a mapping between a point and a face. These
///   are used in the openSet array.
///
///   Point is the index of the point in the points array, Face is the
///   key of the face in the Key dictionary, Distance is the distance
///   from the face to the point.
/// </summary>
class PointFace {
    public Point: number;
    public Face: number;
    public Distance: number;

    public constructor(p: number, f: number, d: number) {
        this.Point = p;
        this.Face = f;
        this.Distance = d;
    }
}

/// <summary>
///   Struct representing a single edge in the horizon.
///
///   Edge0 and Edge1 are the vertexes of edge in CCW order, Face is the
///   face on the other side of the horizon.
///
///   TODO Edge1 isn't actually needed, you can just index the next item
///   in the horizon array.
/// </summary>
class HorizonEdge {
    constructor(public Face: number = 0, public Edge0: number = 0, public Edge1: number = 0) {}
}

/// <summary>
///   An implementation of the quickhull algorithm for generating 3d convex
///   hulls.
///
///   The algorithm works like this: you start with an initial "seed" hull,
///   that is just a simple tetrahedron made up of four points in the point
///   cloud. This seed hull is then grown until it all the points in the
///   point cloud is inside of it, at which point it will be the convex hull
///   for the entire set.
///
///   All of the points in the point cloud is divided into two parts, the
///   "open set" and the "closed set". The open set consists of all the
///   points outside of the tetrahedron, and the closed set is all of the
///   points inside the tetrahedron. After each iteration of the algorithm,
///   the closed set gets bigger and the open set get smaller. When the open
///   set is empty, the algorithm is finished.
///
///   Each point in the open set is assigned to a face that it lies outside
///   of. To grow the hull, the point in the open set which is farthest from
///   it's face is chosen. All faces which are facing that point (I call
///   them "lit faces" in the code, because if you imagine the point as a
///   point light, it's the set of points which would be lit by that point
///   light) are removed, and a "horizon" of edges is found from where the
///   faces were removed. From this horizon, new faces are constructed in a
///   "cone" like fashion connecting the point to the edges.
///
///   To keep track of the faces, I use a struct for each face which
///   contains the three vertices of the face in CCW order, as well as the
///   three triangles which share an edge. I was considering doing a
///   half-edge structure to store the mesh, but it's not needed. Using a
///   struct for each face and neighbors simplify the algorithm and makes it
///   easy to export it as a mesh.
///
///   The most subtle part of the algorithm is finding the horizon. In order
///   to properly construct the cone so that all neighbors are kept
///   consistent, you can do a depth-first search from the first lit face.
///   If the depth-first search always proceeeds in a counter-clockwise
///   fashion, it guarantees that the horizon will be found in a
///   counter-clockwise order, which makes it easy to construct the cone of
///   new faces.
///
///   A note: the code uses a right-handed coordinate system, where the
///   cross-product uses the right-hand rule and the faces are in CCW order.
///   At the end of the algorithm, the hull is exported in a 3d-friendly
///   fashion, with a left-handed mesh.
/// </summary>
export class QuickHull {
    /// <summary>
    ///   Constant representing a point that has yet to be assigned to a
    ///   face. It's only used immediately after constructing the seed hull.
    /// </summary>
    static UNASSIGNED = -2;

    /// <summary>
    ///   Constant representing a point that is inside the convex hull, and
    ///   thus is behind all faces. In the openSet array, all points with
    ///   INSIDE are at the end of the array, with indexes larger
    ///   openSetTail.
    /// </summary>
    static INSIDE = -1;

    /// <summary>
    ///   Epsilon value. If the coordinates of the point space are
    ///   exceptionally close to each other, this value might need to be
    ///   adjusted.
    /// </summary>
    static EPSILON = 0.0001;

    /// <summary>
    ///   A dictionary storing the faces of the currently generated convex
    ///   hull. The key is the id of the face, used in the Face, PointFace
    ///   and HorizonEdge struct.
    ///
    ///   This is a Dictionary, because we need both random access to it,
    ///   the ability to loop through it, and ability to quickly delete
    ///   faces (in the ConstructCone method), and Dictionary is the obvious
    ///   candidate that can do all of those things.
    ///
    ///   I'm wondering if using a Dictionary is best idea, though. It might
    ///   be better to just have them in a List<Face> and mark a face as
    ///   deleted by adding a field to the Face struct. The downside is that
    ///   we would need an extra field in the Face struct, and when we're
    ///   looping through the points in openSet, we would have to loop
    ///   through all the Faces EVER created in the algorithm, and skip the
    ///   ones that have been marked as deleted. However, looping through a
    ///   list is fairly fast, and it might be worth it to avoid Dictionary
    ///   overhead.
    ///
    ///   TODO test converting to a List<Face> instead.
    /// </summary>
    faces: Map<number, Face>;

    /// <summary>
    ///   The set of points to be processed. "openSet" is a misleading name,
    ///   because it's both the open set (points which are still outside the
    ///   convex hull) and the closed set (points that are inside the convex
    ///   hull). The first part of the array (with indexes <= openSetTail)
    ///   is the openSet, the last part of the array (with indexes >
    ///   openSetTail) are the closed set, with Face set to INSIDE. The
    ///   closed set is largely irrelevant to the algorithm, the open set is
    ///   what matters.
    ///
    ///   Storing the entire open set in one big list has a downside: when
    ///   we're reassigning points after ConstructCone, we only need to
    ///   reassign points that belong to the faces that have been removed,
    ///   but storing it in one array, we have to loop through the entire
    ///   list, and checking litFaces to determine which we can skip and
    ///   which need to be reassigned.
    ///
    ///   The alternative here is to give each face in Face array it's own
    ///   openSet. I don't like that solution, because then you have to
    ///   juggle so many more heap-allocated List<T>'s, we'd have to use
    ///   object pools and such. It would do a lot more allocation, and it
    ///   would have worse locality. I should maybe test that solution, but
    ///   it probably wont be faster enough (if at all) to justify the extra
    ///   allocations.
    /// </summary>
    openSet: Array<PointFace>;

    /// <summary>
    ///   Set of faces which are "lit" by the current point in the set. This
    ///   is used in the FindHorizon() DFS search to keep track of which
    ///   faces we've already visited, and in the ReassignPoints() method to
    ///   know which points need to be reassigned.
    /// </summary>
    litFaces: Set<number>;

    /// <summary>
    ///   The current horizon. Generated by the FindHorizon() DFS search,
    ///   and used in ConstructCone to construct new faces. The list of
    ///   edges are in CCW order.
    /// </summary>
    horizon: Array<HorizonEdge>;

    /// <summary>
    ///   If SplitVerts is false, this Dictionary is used to keep track of
    ///   which points we've added to the final mesh.
    /// </summary>
    hullVerts: Map<number, number>;

    /// <summary>
    ///   The "tail" of the openSet, the last index of a vertex that has
    ///   been assigned to a face.
    /// </summary>
    openSetTail: number = -1;

    /// <summary>
    ///   When adding a new face to the faces Dictionary, use this for the
    ///   key and then increment it.
    /// </summary>
    faceCount: number = 0;

    public constructor() {
        this.faces = new Map<number, Face>();
        this.litFaces = new Set<number>();
        this.horizon = new Array<HorizonEdge>();
        this.openSet = new Array<PointFace>();
        this.hullVerts = new Map<number, number>();
    }

    /// <summary>
    ///   Generate a convex hull from points in points array, and store the
    ///   mesh in 3d-friendly format in verts and tris. If splitVerts is
    ///   true, the the verts will be split, if false, the same vert will be
    ///   used for more than one triangle.
    /// </summary>
    public generateHull(points: Array<ICartesian3>, splitVerts: boolean = false): { vertices: Array<ICartesian3>; faces: Array<number>; normals: Array<ICartesian3> } {
        if (points.length < 4) {
            throw new Error("Need at least 4 points to generate a convex hull");
        }

        this._initialize(points, splitVerts);

        this._generateInitialHull(points);

        while (this.openSetTail >= 0) {
            this._growHull(points);
        }

        const exported = this._exportMeshData(points, splitVerts);
        //this._verifyMesh(points, exported.vertices, exported.faces);
        return exported;
    }

    /// <summary>
    ///   Make sure all the buffers and variables needed for the algorithm
    ///   are initialized.
    /// </summary>
    private _initialize(points: Array<ICartesian3>, splitVerts: boolean): void {
        this.faceCount = 0;
        this.openSetTail = -1;

        this.faces.clear();
        this.litFaces?.clear();
        this.horizon = [];
        this.openSet = [];

        if (!splitVerts) {
            this.hullVerts.clear();
        }
    }

    /// <summary>
    ///   Create initial seed hull.
    /// </summary>
    private _generateInitialHull(points: Array<ICartesian3>): void {
        // Find points suitable for use as the seed hull. Some varieties of
        // this algorithm pick extreme points here, but I'm not convinced
        // you gain all that much from that. Currently what it does is just
        // find the first four points that are not coplanar.

        const b = this._findInitialHullIndices(points);
        const b0 = b[0];
        const b1 = b[1];
        const b2 = b[2];
        const b3 = b[3];

        var v0 = points[b0];
        var v1 = points[b1];
        var v2 = points[b2];
        var v3 = points[b3];

        var above = Cartesian3.Dot(Cartesian3.Subtract(v3, v1), Cartesian3.Cross(Cartesian3.Subtract(v1, v0), Cartesian3.Subtract(v2, v0))) > 0.0;

        // Create the faces of the seed hull. You need to draw a diagram
        // here, otherwise it's impossible to know what's going on :)

        // Basically: there are two different possible start-tetrahedrons,
        // depending on whether the fourth point is above or below the base
        // triangle. If you draw a tetrahedron with these coordinates (in a
        // right-handed coordinate-system):

        //   b0 = (0,0,0)
        //   b1 = (1,0,0)
        //   b2 = (0,1,0)
        //   b3 = (0,0,1)

        // you can see the first case (set b3 = (0,0,-1) for the second
        // case). The faces are added with the proper references to the
        // faces opposite each vertex

        this.faceCount = 0;

        if (above) {
            this.faces.set(this.faceCount++, new Face(b0, b2, b1, 3, 1, 2, Cartesian3.Normal(points[b0], points[b2], points[b1])));
            this.faces.set(this.faceCount++, new Face(b0, b1, b3, 3, 2, 0, Cartesian3.Normal(points[b0], points[b1], points[b3])));
            this.faces.set(this.faceCount++, new Face(b0, b3, b2, 3, 0, 1, Cartesian3.Normal(points[b0], points[b3], points[b2])));
            this.faces.set(this.faceCount++, new Face(b1, b2, b3, 2, 1, 0, Cartesian3.Normal(points[b1], points[b2], points[b3])));
        } else {
            this.faces.set(this.faceCount++, new Face(b0, b1, b2, 3, 2, 1, Cartesian3.Normal(points[b0], points[b1], points[b2])));
            this.faces.set(this.faceCount++, new Face(b0, b3, b1, 3, 0, 2, Cartesian3.Normal(points[b0], points[b3], points[b1])));
            this.faces.set(this.faceCount++, new Face(b0, b2, b3, 3, 1, 0, Cartesian3.Normal(points[b0], points[b2], points[b3])));
            this.faces.set(this.faceCount++, new Face(b1, b3, b2, 2, 0, 1, Cartesian3.Normal(points[b1], points[b3], points[b2])));
        }

        this._verifyFaces(points);

        // Create the openSet. Add all points except the points of the seed
        // hull.
        for (let i = 0; i < points.length; i++) {
            if (i == b0 || i == b1 || i == b2 || i == b3) continue;

            this.openSet.push(new PointFace(i, QuickHull.UNASSIGNED, 0.0));
        }

        // Add the seed hull verts to the tail of the list.
        this.openSet.push(new PointFace(b0, QuickHull.INSIDE, Number.NaN));
        this.openSet.push(new PointFace(b1, QuickHull.INSIDE, Number.NaN));
        this.openSet.push(new PointFace(b2, QuickHull.INSIDE, Number.NaN));
        this.openSet.push(new PointFace(b3, QuickHull.INSIDE, Number.NaN));

        // Set the openSetTail value. Last item in the array is
        // openSet.Count - 1, but four of the points (the verts of the seed
        // hull) are part of the closed set, so move openSetTail to just
        // before those.
        this.openSetTail = this.openSet.length - 5;

        Assert(this.openSet.length == points.length);

        // Assign all points of the open set. This does basically the same
        // thing as ReassignPoints()
        for (let i = 0; i <= this.openSetTail; i++) {
            Assert(this.openSet[i].Face == QuickHull.UNASSIGNED);
            Assert(this.openSet[this.openSetTail].Face == QuickHull.UNASSIGNED);
            Assert(this.openSet[this.openSetTail + 1].Face == QuickHull.INSIDE);

            var assigned = false;
            var fp = this.openSet[i];

            Assert(this.faces.size == 4);
            Assert(this.faces.size == this.faceCount);
            for (let j = 0; j < 4; j++) {
                Assert(this.faces.has(j));
                var face = this.faces.get(j)!;

                var dist = this._pointFaceDistance(points[fp.Point], points[face.Vertex0], face);

                if (dist > 0) {
                    fp.Face = j;
                    fp.Distance = dist;
                    this.openSet[i] = fp;

                    assigned = true;
                    break;
                }
            }

            if (!assigned) {
                // Point is inside
                fp.Face = QuickHull.INSIDE;
                fp.Distance = Number.NaN;

                // Point is inside seed hull: swap point with tail, and move
                // openSetTail back. We also have to decrement i, because
                // there's a new item at openSet[i], and we need to process
                // it next iteration
                this.openSet[i] = this.openSet[this.openSetTail];
                this.openSet[this.openSetTail] = fp;

                this.openSetTail -= 1;
                i -= 1;
            }
        }

        this._verifyOpenSet(points);
    }

    /// <summary>
    ///   Find four points in the point cloud that are not coplanar for the
    ///   seed hull
    /// </summary>
    private _findInitialHullIndices(points: Array<ICartesian3>): Array<number> {
        var count = points.length;

        for (let i0 = 0; i0 < count - 3; i0++) {
            for (let i1 = i0 + 1; i1 < count - 2; i1++) {
                var p0 = points[i0];
                var p1 = points[i1];

                if (Cartesian3.AreCoincident(p0, p1, QuickHull.EPSILON)) continue;

                for (let i2 = i1 + 1; i2 < count - 1; i2++) {
                    var p2 = points[i2];

                    if (Cartesian3.AreCollinear(p0, p1, p2, QuickHull.EPSILON)) continue;

                    for (let i3 = i2 + 1; i3 < count - 0; i3++) {
                        var p3 = points[i3];

                        if (Cartesian3.AreCoplanar(p0, p1, p2, p3, QuickHull.EPSILON)) continue;

                        return [i0, i1, i2, i3];
                    }
                }
            }
        }

        throw new Error("Can't generate hull, points are coplanar");
    }

    /// <summary>
    ///   Grow the hull. This method takes the current hull, and expands it
    ///   to encompass the point in openSet with the point furthest away
    ///   from its face.
    /// </summary>
    private _growHull(points: Array<ICartesian3>): void {
        Assert(this.openSetTail >= 0);
        Assert(this.openSet[0].Face != QuickHull.INSIDE);

        // Find farthest point and first lit face.
        var farthestPoint = 0;
        var dist = this.openSet[0].Distance;

        for (let i = 1; i <= this.openSetTail; i++) {
            if (this.openSet[i].Distance > dist) {
                farthestPoint = i;
                dist = this.openSet[i].Distance;
            }
        }

        // Use lit face to find horizon and the rest of the lit
        // faces.
        this._findHorizon(points, points[this.openSet[farthestPoint].Point], this.openSet[farthestPoint].Face, this.faces.get(this.openSet[farthestPoint].Face));

        this._verifyHorizon();

        // Construct new cone from horizon
        this._constructCone(points, this.openSet[farthestPoint].Point);

        this._verifyFaces(points);

        // Reassign points
        this._reassignPoints(points);
    }

    /// <summary>
    ///   Start the search for the horizon.
    ///
    ///   The search is a DFS search that searches neighboring triangles in
    ///   a counter-clockwise fashion. When it find a neighbor which is not
    ///   lit, that edge will be a line on the horizon. If the search always
    ///   proceeds counter-clockwise, the edges of the horizon will be found
    ///   in counter-clockwise order.
    ///
    ///   The heart of the search can be found in the recursive
    ///   SearchHorizon() method, but the the first iteration of the search
    ///   is special, because it has to visit three neighbors (all the
    ///   neighbors of the initial triangle), while the rest of the search
    ///   only has to visit two (because one of them has already been
    ///   visited, the one you came from).
    /// </summary>
    private _findHorizon(points: Array<ICartesian3>, point: ICartesian3, fi: number, face?: Face): void {
        Assert(face != null && face != undefined);
        // TODO should I use epsilon in the PointFaceDistance comparisons?

        this.litFaces.clear();
        this.horizon = [];

        this.litFaces.add(fi);

        Assert(this._pointFaceDistance(point, points[face.Vertex0], face) > 0.0);

        // For the rest of the recursive search calls, we first check if the
        // triangle has already been visited and is part of litFaces.
        // However, in this first call we can skip that because we know it
        // can't possibly have been visited yet, since the only thing in
        // litFaces is the current triangle.
        {
            var oppositeFace = this.faces.get(face.Opposite0)!;

            var dist = this._pointFaceDistance(point, points[oppositeFace.Vertex0], oppositeFace);

            if (dist <= 0.0) {
                this.horizon.push(new HorizonEdge(face.Opposite0, face.Vertex1, face.Vertex2));
            } else {
                this._searchHorizon(points, point, fi, face.Opposite0, oppositeFace);
            }
        }

        if (!this.litFaces.has(face.Opposite1)) {
            var oppositeFace = this.faces.get(face.Opposite1)!;

            var dist = this._pointFaceDistance(point, points[oppositeFace.Vertex0], oppositeFace);

            if (dist <= 0.0) {
                this.horizon.push(new HorizonEdge(face.Opposite1, face.Vertex2, face.Vertex0));
            } else {
                this._searchHorizon(points, point, fi, face.Opposite1, oppositeFace);
            }
        }

        if (!this.litFaces.has(face.Opposite2)) {
            var oppositeFace = this.faces.get(face.Opposite2)!;

            var dist = this._pointFaceDistance(point, points[oppositeFace.Vertex0], oppositeFace);

            if (dist <= 0.0) {
                this.horizon.push(new HorizonEdge(face.Opposite2, face.Vertex0, face.Vertex1));
            } else {
                this._searchHorizon(points, point, fi, face.Opposite2, oppositeFace);
            }
        }
    }

    /// <summary>
    ///   Recursively search to find the horizon or lit set.
    /// </summary>
    private _searchHorizon(points: Array<ICartesian3>, point: ICartesian3, prevFaceIndex: number, faceCount: number, face: Face): void {
        Assert(prevFaceIndex >= 0);
        Assert(this.litFaces.has(prevFaceIndex));
        Assert(!this.litFaces.has(faceCount));
        Assert(this.faces.get(faceCount)?.Equals(face));

        this.litFaces.add(faceCount);

        // Use prevFaceIndex to determine what the next face to search will
        // be, and what edges we need to cross to get there. It's important
        // that the search proceeds in counter-clockwise order from the
        // previous face.
        let nextFaceIndex0: number;
        let nextFaceIndex1: number;
        let edge0: number;
        let edge1: number;
        let edge2: number;

        if (prevFaceIndex == face.Opposite0) {
            nextFaceIndex0 = face.Opposite1;
            nextFaceIndex1 = face.Opposite2;

            edge0 = face.Vertex2;
            edge1 = face.Vertex0;
            edge2 = face.Vertex1;
        } else if (prevFaceIndex == face.Opposite1) {
            nextFaceIndex0 = face.Opposite2;
            nextFaceIndex1 = face.Opposite0;

            edge0 = face.Vertex0;
            edge1 = face.Vertex1;
            edge2 = face.Vertex2;
        } else {
            Assert(prevFaceIndex == face.Opposite2);

            nextFaceIndex0 = face.Opposite0;
            nextFaceIndex1 = face.Opposite1;

            edge0 = face.Vertex1;
            edge1 = face.Vertex2;
            edge2 = face.Vertex0;
        }

        if (!this.litFaces.has(nextFaceIndex0)) {
            const oppositeFace = this.faces.get(nextFaceIndex0)!;

            const dist = this._pointFaceDistance(point, points[oppositeFace.Vertex0], oppositeFace);

            if (dist <= 0.0) {
                this.horizon.push(new HorizonEdge(nextFaceIndex0, edge0, edge1));
            } else {
                this._searchHorizon(points, point, faceCount, nextFaceIndex0, oppositeFace);
            }
        }

        if (!this.litFaces.has(nextFaceIndex1)) {
            const oppositeFace = this.faces.get(nextFaceIndex1)!;

            const dist = this._pointFaceDistance(point, points[oppositeFace.Vertex0], oppositeFace);

            if (dist <= 0.0) {
                this.horizon.push(new HorizonEdge(nextFaceIndex1, edge1, edge2));
            } else {
                this._searchHorizon(points, point, faceCount, nextFaceIndex1, oppositeFace);
            }
        }
    }

    /// <summary>
    ///   Remove all lit faces and construct new faces from the horizon in a
    ///   "cone-like" fashion.
    ///
    ///   This is a relatively straight-forward procedure, given that the
    ///   horizon is handed to it in already sorted counter-clockwise. The
    ///   neighbors of the new faces are easy to find: they're the previous
    ///   and next faces to be constructed in the cone, as well as the face
    ///   on the other side of the horizon. We also have to update the face
    ///   on the other side of the horizon to reflect it's new neighbor from
    ///   the cone.
    /// </summary>
    private _constructCone(points: Array<ICartesian3>, farthestPoint: number): void {
        for (let fi of this.litFaces) {
            Assert(this.faces.has(fi));
            this.faces.delete(fi);
        }

        const firstNewFace = this.faceCount;

        for (let i = 0; i < this.horizon.length; i++) {
            // Vertices of the new face, the farthest point as well as the
            // edge on the horizon. Horizon edge is CCW, so the triangle
            // should be as well.
            const v0 = farthestPoint;
            const v1 = this.horizon[i].Edge0;
            const v2 = this.horizon[i].Edge1;

            // Opposite faces of the triangle. First, the edge on the other
            // side of the horizon, then the next/prev faces on the new cone
            const o0 = this.horizon[i].Face;
            const o1 = i == this.horizon.length - 1 ? firstNewFace : firstNewFace + i + 1;
            const o2 = i == 0 ? firstNewFace + this.horizon.length - 1 : firstNewFace + i - 1;

            let fi = this.faceCount++;

            this.faces.set(fi, new Face(v0, v1, v2, o0, o1, o2, Cartesian3.Normal(points[v0], points[v1], points[v2])));

            var horizonFace = this.faces.get(this.horizon[i].Face)!;

            if (horizonFace.Vertex0 == v1) {
                Assert(v2 == horizonFace.Vertex2);
                horizonFace.Opposite1 = fi;
            } else if (horizonFace.Vertex1 == v1) {
                Assert(v2 == horizonFace.Vertex0);
                horizonFace.Opposite2 = fi;
            } else {
                Assert(v1 == horizonFace.Vertex2);
                Assert(v2 == horizonFace.Vertex1);
                horizonFace.Opposite0 = fi;
            }

            this.faces.set(this.horizon[i].Face, horizonFace);
        }
    }

    /// <summary>
    ///   Reassign points based on the new faces added by ConstructCone().
    ///
    ///   Only points that were previous assigned to a removed face need to
    ///   be updated, so check litFaces while looping through the open set.
    ///
    ///   There is a potential optimization here: there's no reason to loop
    ///   through the entire openSet here. If each face had it's own
    ///   openSet, we could just loop through the openSets in the removed
    ///   faces. That would make the loop here shorter.
    ///
    ///   However, to do that, we would have to juggle A LOT more List<T>'s,
    ///   and we would need an object pool to manage them all without
    ///   generating a whole bunch of garbage. I don't think it's worth
    ///   doing that to make this loop shorter, a straight for-loop through
    ///   a list is pretty darn fast. Still, it might be worth trying
    /// </summary>
    private _reassignPoints(points: Array<ICartesian3>): void {
        for (let i = 0; i <= this.openSetTail; i++) {
            var fp = this.openSet[i];

            if (this.litFaces.has(fp.Face)) {
                var assigned = false;
                var point = points[fp.Point];

                for (let [fi, face] of this.faces) {
                    var dist = this._pointFaceDistance(point, points[face.Vertex0], face);

                    if (dist > QuickHull.EPSILON) {
                        assigned = true;

                        fp.Face = fi;
                        fp.Distance = dist;

                        this.openSet[i] = fp;
                        break;
                    }
                }

                if (!assigned) {
                    // If point hasn't been assigned, then it's inside the
                    // convex hull. Swap it with openSetTail, and decrement
                    // openSetTail. We also have to decrement i, because
                    // there's now a new thing in openSet[i], so we need i
                    // to remain the same the next iteration of the loop.
                    fp.Face = QuickHull.INSIDE;
                    fp.Distance = Number.NaN;

                    this.openSet[i] = this.openSet[this.openSetTail];
                    this.openSet[this.openSetTail] = fp;

                    i--;
                    this.openSetTail--;
                }
            }
        }
    }

    /// <summary>
    ///   Final step in algorithm, export the faces of the convex hull in a
    ///   mesh-friendly format.
    ///
    ///   TODO normals calculation for non-split vertices. Right now it just
    ///   leaves the normal array empty.
    /// </summary>
    private _exportMeshData(points: Array<ICartesian3>, splitVerts: boolean): { vertices: Array<ICartesian3>; faces: Array<number>; normals: Array<ICartesian3> } {
        const verts = new Array<ICartesian3>();
        const tris = new Array<number>();
        const normals = new Array<ICartesian3>();

        for (let face of this.faces.values()) {
            let vi0: number = 0,
                vi1: number = 0,
                vi2: number = 0;

            if (splitVerts) {
                vi0 = verts.length;
                verts.push(points[face.Vertex0]);
                vi1 = verts.length;
                verts.push(points[face.Vertex1]);
                vi2 = verts.length;
                verts.push(points[face.Vertex2]);

                normals.push(face.Normal);
                normals.push(face.Normal);
                normals.push(face.Normal);
            } else {
                let tmp = this.hullVerts.get(face.Vertex0);
                if (!tmp) {
                    vi0 = verts.length;
                    this.hullVerts.set(face.Vertex0, vi0);
                    verts.push(points[face.Vertex0]);
                } else {
                    vi0 = tmp;
                }

                tmp = this.hullVerts.get(face.Vertex1);
                if (!tmp) {
                    vi1 = verts.length;
                    this.hullVerts.set(face.Vertex1, vi1);
                    verts.push(points[face.Vertex1]);
                } else {
                    vi1 = tmp;
                }

                tmp = this.hullVerts.get(face.Vertex2);
                if (!tmp) {
                    vi2 = verts.length;
                    this.hullVerts.set(face.Vertex2, vi2);
                    verts.push(points[face.Vertex2]);
                } else {
                    vi2 = tmp;
                }
            }

            tris.push(vi0);
            tris.push(vi1);
            tris.push(vi2);
        }
        return { vertices: verts, faces: tris, normals: normals };
    }

    /// <summary>
    ///   Signed distance from face to point (a positive number means that
    ///   the point is above the face)
    /// </summary>
    private _pointFaceDistance(point: ICartesian3, pointOnFace: ICartesian3, face: Face): number {
        return Cartesian3.Dot(face.Normal, Cartesian3.Subtract(point, pointOnFace));
    }

    /// <summary>
    ///   Method used for debugging, verifies that the openSet is in a
    ///   sensible state. Conditionally compiled if DEBUG_QUICKHULL if
    ///   defined.
    /// </summary>
    private _verifyOpenSet(points: Array<ICartesian3>): void {
        for (let i = 0; i < this.openSet.length; i++) {
            if (i > this.openSetTail) {
                Assert(this.openSet[i].Face == QuickHull.INSIDE);
            } else {
                Assert(this.openSet[i].Face != QuickHull.INSIDE);
                Assert(this.openSet[i].Face != QuickHull.UNASSIGNED);

                Assert(this._pointFaceDistance(points[this.openSet[i].Point], points[this.faces.get(this.openSet[i].Face)!.Vertex0], this.faces.get(this.openSet[i].Face)!) > 0.0);
            }
        }
    }

    /// <summary>
    ///   Method used for debugging, verifies that the horizon is in a
    ///   sensible state. Conditionally compiled if DEBUG_QUICKHULL if
    ///   defined.
    /// </summary>
    private _verifyHorizon(): void {
        for (let i = 0; i < this.horizon.length; i++) {
            const prev = i == 0 ? this.horizon.length - 1 : i - 1;

            Assert(this.horizon[prev].Edge1 == this.horizon[i].Edge0);
            Assert(this._hasEdge(this.faces.get(this.horizon[i].Face), this.horizon[i].Edge1, this.horizon[i].Edge0));
        }
    }

    /// <summary>
    ///   Method used for debugging, verifies that the faces array is in a
    ///   sensible state. Conditionally compiled if DEBUG_QUICKHULL if
    ///   defined.
    /// </summary>
    private _verifyFaces(points: Array<ICartesian3>): void {
        for (var [fi, face] of this.faces) {
            Assert(this.faces.has(face.Opposite0));
            Assert(this.faces.has(face.Opposite1));
            Assert(this.faces.has(face.Opposite2));

            Assert(face.Opposite0 != fi);
            Assert(face.Opposite1 != fi);
            Assert(face.Opposite2 != fi);

            Assert(face.Vertex0 != face.Vertex1);
            Assert(face.Vertex0 != face.Vertex2);
            Assert(face.Vertex1 != face.Vertex2);

            Assert(this._hasEdge(this.faces.get(face.Opposite0), face.Vertex2, face.Vertex1));
            Assert(this._hasEdge(this.faces.get(face.Opposite1), face.Vertex0, face.Vertex2));
            Assert(this._hasEdge(this.faces.get(face.Opposite2), face.Vertex1, face.Vertex0));

            const tmp = Cartesian3.Subtract(face.Normal, Cartesian3.Normal(points[face.Vertex0], points[face.Vertex1], points[face.Vertex2]));
            Assert(Cartesian3.Magnitude(tmp) < QuickHull.EPSILON);
        }
    }

    /// <summary>
    ///   Method used for debugging, verifies that the final mesh is
    ///   actually a convex hull of all the points. Conditionally compiled
    ///   if DEBUG_QUICKHULL if defined.
    /// </summary>
    /*    private _verifyMesh(points: Array<ICartesian3>, verts: Array<ICartesian3>, tris: Array<number>): void {
        Assert(tris.length % 3 == 0);

        for (let i = 0; i < points.length; i++) {
            for (let j = 0; j < tris.length; j += 3) {
                var t0 = verts[tris[j]];
                var t1 = verts[tris[j + 1]];
                var t2 = verts[tris[j + 2]];

                Assert(Cartesian3.Dot(Cartesian3.Subtract(points[i], t0), Cartesian3.Cross(Cartesian3.Subtract(t1, t0), Cartesian3.Subtract(t2, t0))) <= QuickHull.EPSILON);
            }
        }
    }*/

    /// <summary>
    ///   Does face f have a face with vertexes e0 and e1? Used only for
    ///   debugging.
    /// </summary>
    private _hasEdge(f: Face | undefined, e0: number, e1: number): boolean {
        if (f == undefined) return false;
        return (f.Vertex0 == e0 && f.Vertex1 == e1) || (f.Vertex1 == e0 && f.Vertex2 == e1) || (f.Vertex2 == e0 && f.Vertex0 == e1);
    }
}
