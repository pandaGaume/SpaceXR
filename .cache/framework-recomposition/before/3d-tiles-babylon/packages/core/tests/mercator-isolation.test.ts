import { GeodeticSystem } from "@spacexr/geodesy";
import { describe, expect, it } from "vitest";

import { webMercatorTiling } from "../src";
import { tileCenterEcef, tileCenterLongitude, webMercatorLatitude } from "../src/terrain/gpu/grid-shapes";
import { instancedGridPixelShader } from "../src/terrain/gpu/shaders/instancedGrid.fragment";
import { instancedGridVertexShader } from "../src/terrain/gpu/shaders/instancedGrid.vertex";

import { shaderBranch } from "./shader-branch";

describe("the Web Mercator path", () => {
    it("keeps the legacy Web Mercator shader independent of radial and runtime geometry", () => {
        for (const shader of [instancedGridVertexShader.shader, instancedGridPixelShader.shader]) {
            const mercator = shaderBranch(shader, ["IMAGERY"]);
            for (const token of [
                "turns",
                "floor(reference",
                "inverseRadiiSquared",
                "vUp",
                "vEast",
                "shapePosition",
                "heightGradient",
                "mercatorSurface",
                "vDrape",
                "imageryTables",
            ]) {
                expect(mercator).not.toContain(token);
            }
        }
    });

    it("selects analytic runtime geometry without cube shapes or edge snapping", () => {
        const vertex = shaderBranch(instancedGridVertexShader.shader, ["RUNTIME_SELECTION", "IMAGERY"]);
        const fragment = shaderBranch(instancedGridPixelShader.shader, ["RUNTIME_SELECTION", "IMAGERY"]);
        expect(vertex).toContain("vec3 local = surface + localUp * heightIn(elevationAt(h), position.xy);");
        expect(vertex).toContain("vec3 mercatorSurface(");
        for (const token of ["texelFetch(shapes", "shapePosition", "int turns", "0.5 * (sampledPosition", "vec3 local = positionAt(h);"])
            expect(vertex).not.toContain(token);
        expect(fragment).toContain("texelFetch(imageryTables");
        expect(fragment).toContain("joinedGradient(vTile)");
        expect(fragment).not.toContain("vec3 normal = normalize(vNormal);");
    });

    it("resolves nested conditions, elif and inactive parent branches", () => {
        const source = `#if defined(A) || defined(B)
outer
#ifdef C
nested
#else
fallback
#endif
#elif defined(D)
alternative
#else
legacy
#endif`;
        expect(shaderBranch(source, ["A", "C"])).toBe("outer\nnested");
        expect(shaderBranch(source, ["B"])).toBe("outer\nfallback");
        expect(shaderBranch(source, ["D", "C"])).toBe("alternative");
        expect(shaderBranch(source, ["C"])).toBe("legacy");
        expect(() => shaderBranch("#if defined(A)\n", [])).toThrow("Unclosed");
    });

    it("computes the latitude of a shape exactly, without going through a float up vector", () => {
        const texels = webMercatorTiling().shapeTexels({ lod: 7, x: 13, y: 31 }, 4);

        for (let row = 0; row <= 4; row++) {
            expect(texels[(row * 5 + 2) * 4 + 3]).toBe(new Float32Array([webMercatorLatitude((31 + row / 4) / 128)])[0]);
        }
    });

    it("shares a shape along a row, whichever column asks for it", () => {
        const tiling = webMercatorTiling();

        expect(tiling.shapeKey({ lod: 7, x: 13, y: 31 })).toBe(tiling.shapeKey({ lod: 7, x: 90, y: 31 }));
        expect(tiling.shapeTexels({ lod: 7, x: 90, y: 31 }, 4)).toEqual(tiling.shapeTexels({ lod: 7, x: 13, y: 31 }, 4));
    });

    it("places tiles with the functions of the engine", () => {
        const tiling = webMercatorTiling();
        const address = { lod: 9, x: 265, y: 180 };

        expect(tiling.center(address)).toEqual(tileCenterEcef(address, GeodeticSystem.WGS84));
        expect(tiling.rotation(address)).toBe(tileCenterLongitude(address));
    });

    it("reads a DEM tile without turning it or wrapping columns", () => {
        const tiling = webMercatorTiling();

        expect(tiling.demArea({ lod: 5, x: 9, y: 6 }, { lod: 3, x: 2, y: 1 })).toEqual({ west: 0.25, north: 0.5, size: 0.25, turns: 0 });
        expect(tiling.demArea({ lod: 3, x: 0, y: 1 }, { lod: 3, x: 7, y: 1 })).toEqual({ west: -7, north: 0, size: 1, turns: 0 });
    });
});
