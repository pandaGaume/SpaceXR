# Chapter: From ECEF to Babylon.js – Building a 3D Tiles Engine

## 1. Introduction

Modern 3D Tiles datasets, such as Google Photorealistic tiles, are defined in the **ECEF (Earth-Centered Earth-Fixed)** coordinate system. Babylon.js, however, uses a **left-handed system with Y as the vertical axis**. To render tiles correctly, we must translate between these systems and integrate the tileset hierarchy into Babylon’s scene graph.

This chapter explains:

-   How to transform positions, vectors, and matrices from **ECEF → Babylon.js**.
-   How to represent the **tileset hierarchy** as a tree of nodes in Babylon.js.
-   How bounding volumes and contents are handled during streaming.

---

## 2. Coordinate Systems

### 2.1 ECEF

ECEF is a global right-handed coordinate system:

-   Origin: Earth’s center of mass
-   X-axis: intersection of equator and prime meridian
-   Y-axis: 90° east longitude
-   Z-axis: north pole

Units are in meters.

### 2.2 Babylon.js

Babylon.js uses:

-   Left-handed system
-   Y axis is “up”
-   Z is “forward”
-   X is “right”

This mismatch requires a global transformation applied to all tile data.

---

## 3. Transformation: ECEF → Babylon.js

We define the mapping:

```
(x, y, z)_{ECEF} → (-x, z, -y)_{Babylon}
```

This aligns Earth’s north axis with Babylon’s Y-up, while flipping handedness.

### 3.1 Matrix Form

The transformation can be expressed with a 4×4 matrix A:

```
A =
[ -1  0  0  0 ]
[  0  0  1  0 ]
[  0 -1  0  0 ]
[  0  0  0  1 ]
```

-   Points: p_BJS = A \* p_ECEF
-   Vectors/axes: v_BJS = A3x3 \* v_ECEF
-   Transforms: M_BJS = A _ M_ECEF _ A^-1

### 3.2 Code Snippets

```ts
// Vector conversion
export function ecefVecToBabylon(x: number, y: number, z: number) {
    return { x: -x, y: z, z: -y };
}

// Apply to a 3D Tiles oriented bounding box
export function ecefBoxToBabylon(box: number[]): number[] {
    const [cx, cy, cz, ux, uy, uz, vx, vy, vz, wx, wy, wz] = box;
    const c = ecefVecToBabylon(cx, cy, cz);
    const u = ecefVecToBabylon(ux, uy, uz);
    const v = ecefVecToBabylon(vx, vy, vz);
    const w = ecefVecToBabylon(wx, wy, wz);
    return [c.x, c.y, c.z, u.x, u.y, u.z, v.x, v.y, v.z, w.x, w.y, w.z];
}

// Matrix conversion
export function ecefMat4ToBabylon(M: number[]): number[] {
    const A = [-1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1];
    const AT = [-1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1];
    return mul4x4(mul4x4(A, M), AT);
}
```
