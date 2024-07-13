import { Bounds2, Cartesian2, Cartesian3, Line, Polygon, Polyline } from "../../src";

test("test line inside clip", () => {
    const line = new Line(new Cartesian3(0.1, 0.1), new Cartesian3(0.8, 0.5));
    const bounds = new Bounds2(0, 0, 1, 1);
    const clipped = line.clip(bounds);
    expect(clipped).toBe(line);
});

test("test line outside clip", () => {
    const line = new Line(new Cartesian3(10, 10), new Cartesian3(11, 11));
    const bounds = new Bounds2(0, 0, 1, 1);
    const clipped = line.clip(bounds);
    expect(clipped).toBe(undefined);
});

test("test cohen sutherland code", () => {
    const bounds = new Bounds2(0, 0, 1, 1);
    const points = [
        new Cartesian3(-1, 1.5),
        new Cartesian3(0.5, 1.5),
        new Cartesian3(1.5, 1.5),
        new Cartesian3(-1, 0.5),
        new Cartesian3(0.5, 0.5),
        new Cartesian3(1.5, 0.5),
        new Cartesian3(-1, -0.5),
        new Cartesian3(0.5, -0.5),
        new Cartesian3(1.5, -0.5),
    ];
    const codes = points.map((p) => Cartesian3.ComputeCode(p, bounds));
    expect(codes).toEqual([9, 8, 10, 1, 0, 2, 5, 4, 6]);
});

test("test line clipped", () => {
    const bounds = new Bounds2(0, 0, 11, 6);
    const line = new Line(new Cartesian3(9, 7), new Cartesian3(1, -1));
    let clipped = line.clip(bounds);
    expect(clipped).toBeInstanceOf(Line);
    clipped = clipped as Line;
    expect(clipped.end).toEqual({ x: 2, y: 0, z: 0 });
    expect(clipped.start).toEqual({ x: 8, y: 6, z: 0 });
});

test("test polyline clip inside", () => {
    const bounds = new Bounds2(0, 0, 11, 6);
    const polyline = Polyline.FromFloats([2, 5, 4, 4, 4, 2, 6, 2], 2);
    const clipped = polyline.clip(bounds);
    expect(clipped).toBe(polyline);
});

test("test polyline clip outside", () => {
    const bounds = new Bounds2(0, 0, 11, 6);
    const polyline = Polyline.FromFloats([13, 5, 15, 4, 15, 2, 17, 2], 2);
    const clipped = polyline.clip(bounds);
    expect(clipped).toBe(undefined);
});

test("test polyline clip to single", () => {
    const bounds = new Bounds2(0, 0, 11, 6);
    const polyline = Polyline.FromFloats([7, 4, 9, 4, 10, 2, 12, 2, 12, 1], 2);
    let clipped = polyline.clip(bounds);
    expect(clipped).toBeInstanceOf(Polyline);
    clipped = clipped as Polyline;
    const points = Cartesian2.Flatten(clipped.points, []);
    expect(points).toEqual([7, 4, 9, 4, 10, 2, 11, 2]);
});

test("test polyline clip to several", () => {
    const bounds = new Bounds2(0, 0, 11, 6);
    const polyline = Polyline.FromFloats([7, 4, 9, 4, 10, 2, 12, 2, 12, 1, 8, 1, 8, 2], 2);
    let clipped = polyline.clip(bounds);
    expect(clipped).toBeInstanceOf(Array<Polyline>);
    clipped = clipped as Array<Polyline>;
    let points = Cartesian2.Flatten(clipped[0].points, []);
    expect(points).toEqual([7, 4, 9, 4, 10, 2, 11, 2]);
    points = Cartesian2.Flatten(clipped[1].points, []);
    expect(points).toEqual([11, 1, 8, 1, 8, 2]);
});

test("test polygon clip inside", () => {
    const bounds = new Bounds2(0, 0, 11, 6);
    const polygon = Polygon.FromFloats([7, 4, 9, 4, 10, 2, 10, 1, 8, 1, 8, 2], 2);
    const clipped = polygon.clip(bounds);
    expect(clipped).toBe(polygon);
});

test("test polygon clip outside", () => {
    const bounds = new Bounds2(0, 0, 11, 6);
    const polygon = Polygon.FromFloats([17, 4, 19, 4, 20, 2, 20, 1, 18, 1, 18, 2], 2);
    const clipped = polygon.clip(bounds);
    expect(clipped).toBe(undefined);
});

test("test polygon clip", () => {
    const bounds = new Bounds2(0, 0, 11, 6);
    const polygon = Polygon.FromFloats([7, 4, 9, 4, 10, 2, 12, 2, 12, 1, 8, 1, 8, 2, 6, 2, 6, -2, 2, -2, 2, 4], 2);
    let clipped = polygon.clip(bounds);
    expect(clipped).toBeInstanceOf(Polygon);
    clipped = clipped as Polygon;
    const points = Cartesian2.Flatten(clipped.points, []);
    expect(points).toEqual([11, 1, 8, 1, 8, 2, 6, 2, 6, 0, 2, 0, 2, 4, 7, 4, 9, 4, 10, 2, 11, 2, 11, 1]);
});

test("test polygon clip whith hole", () => {
    const bounds = new Bounds2(0, 0, 11, 6);
    const polygon = Polygon.FromFloats(
        [
            [7, 4, 9, 4, 10, 2, 12, 2, 12, 1, 8, 1, 8, 2, 6, 2, 6, -2, 2, -2, 2, 4],
            [3, 1, 5, 1, 5, -1, 3, -1], // hole
        ],
        2
    );
    let clipped = polygon.clip(bounds);
    expect(clipped).toBeInstanceOf(Polygon);
    clipped = clipped as Polygon;
    const points = Cartesian2.Flatten(clipped.points, []);
    expect(points).toEqual([11, 1, 8, 1, 8, 2, 6, 2, 6, 0, 5, 0, 5, 1, 3, 1, 3, 0, 2, 0, 2, 4, 7, 4, 9, 4, 10, 2, 11, 2, 11, 1]);
});

test("test polygon clip to several", () => {
    const bounds = new Bounds2(0, 0, 11, 6);
    const polygon = Polygon.FromFloats([7, 4, 9, 4, 10, 2, 12, 2, 12, 4, 10, 4, 10, 7, 14, 7, 14, 1, 12, 1, 8, 1, 8, 2, 6, 2, 6, -2, 2, -2, 2, 4], 2);
    let clipped = polygon.clip(bounds);
    expect(clipped).toBeInstanceOf(Array<Polygon>);
    clipped = clipped as Array<Polygon>;
    let points = Cartesian2.Flatten(clipped[0].points, []);
    expect(points).toEqual([11, 4, 10, 4, 10, 6, 11, 6, 11, 4]);
    points = Cartesian2.Flatten(clipped[1].points, []);
    expect(points).toEqual([11, 1, 8, 1, 8, 2, 6, 2, 6, 0, 2, 0, 2, 4, 7, 4, 9, 4, 10, 2, 11, 2, 11, 1]);
});
