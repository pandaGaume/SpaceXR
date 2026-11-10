import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { GENERATED_HEADER, buildShaders, describeShader, generateShader, stripShader } from "../src";

const roots: string[] = [];

/** Writes files in a new folder and returns it. */
function folder(files: Record<string, string>): string {
    const root = mkdtempSync(join(tmpdir(), "spacexr-shaders-"));
    roots.push(root);
    for (const [path, content] of Object.entries(files)) {
        mkdirSync(dirname(join(root, path)), { recursive: true });
        writeFileSync(join(root, path), content);
    }
    return root;
}

afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("stripShader", () => {
    it("removes comments, indentation and blank lines", () => {
        expect(stripShader("// head\n\nvoid main(void) {\n    /* a\n b */ float x = 1.0; // end\n}\n")).toBe(
            "void main(void) {\nfloat x = 1.0;\n}",
        );
    });

    it("keeps preprocessor directives on their own line", () => {
        expect(stripShader("float a;\n#ifdef X\n  float b; // note\n#else\nfloat c;\n#endif\n")).toBe(
            "float a;\n#ifdef X\nfloat b;\n#else\nfloat c;\n#endif",
        );
    });

    it("gives the same text whatever the line endings and byte order mark", () => {
        expect(stripShader("\uFEFFfloat a;\r\nfloat b;\r\n")).toBe(stripShader("float a;\nfloat b;\n"));
    });
});

describe("describeShader", () => {
    it.each([
        ["src/grid.vertex.glsl", "stage", "gridVertexShader"],
        ["src/grid.fragment.glsl", "stage", "gridPixelShader"],
        ["src/grid.compute.wgsl", "stage", "gridComputeShader"],
        ["src/includes/lights.glsl", "include", "lights"],
        ["src/snippets/drapeColor.glsl", "snippet", "drapeColor"],
    ])("reads %s", (path, kind, name) => {
        expect(describeShader(path)).toEqual({ kind, name });
    });

    it.each([
        "src/grid.glsl",
        "src/grid.pixel.glsl",
        "src/a.b.vertex.glsl",
        "src/includes/a.vertex.glsl",
        "src/snippets/a-b.glsl",
        "src/1a.vertex.glsl",
    ])("rejects %s", (path) => {
        expect(() => describeShader(path)).toThrow(path);
    });
});

describe("generateShader", () => {
    it("registers a stage in the shader store of its language", () => {
        const root = folder({ "a.vertex.glsl": "void main(void) {}\n", "b.fragment.wgsl": "fn f() {}\n" });
        const glsl = generateShader(join(root, "a.vertex.glsl"));
        expect(glsl.target).toBe(join(root, "a.vertex.ts"));
        expect(glsl.content.startsWith(GENERATED_HEADER)).toBe(true);
        expect(glsl.content).toContain("ShaderStore.ShadersStore[name] = shader;");
        expect(glsl.content).toContain("export const aVertexShader = { name, shader };");
        const wgsl = generateShader(join(root, "b.fragment.wgsl"));
        expect(wgsl.content).toContain("ShaderStore.ShadersStoreWGSL[name] = shader;");
        // The store key is the one Babylon.js looks up; the export tells the two languages apart, as in Babylon.js.
        expect(wgsl.content).toContain('const name = "bPixelShader";');
        expect(wgsl.content).toContain("export const bPixelShaderWGSL = { name, shader };");
    });

    it("registers includes in the include store, and snippets nowhere", () => {
        const root = folder({ "includes/a.glsl": "float a;\n", "snippets/b.glsl": "float b;\n" });
        expect(generateShader(join(root, "includes/a.glsl")).content).toContain("ShaderStore.IncludesShadersStore[name] = shader;");
        const snippet = generateShader(join(root, "snippets/b.glsl")).content;
        expect(snippet).not.toContain("ShaderStore");
        expect(snippet).toContain("export const b = { name, shader };");
    });

    it("escapes what would end or interpolate the template literal", () => {
        const root = folder({ "a.vertex.glsl": "a ` b ${c} \\d\n" });
        expect(generateShader(join(root, "a.vertex.glsl")).content).toContain("const shader = `a \\` b \\${c} \\\\d`;");
    });
});

describe("buildShaders", () => {
    it("writes the modules, then leaves them alone", () => {
        const root = folder({ "a.vertex.glsl": "float a;\n" });
        expect(buildShaders(root)).toEqual({ unchanged: [], changed: ["a.vertex.ts"], orphans: [] });
        expect(readFileSync(join(root, "a.vertex.ts"), "utf8")).toContain("const shader = `float a;`;");
        expect(buildShaders(root)).toEqual({ unchanged: ["a.vertex.ts"], changed: [], orphans: [] });
    });

    it("writes nothing when checking, and reports what is out of date", () => {
        const root = folder({ "a.vertex.glsl": "float a;\n" });
        expect(buildShaders(root, { check: true }).changed).toEqual(["a.vertex.ts"]);
        expect(() => readFileSync(join(root, "a.vertex.ts"))).toThrow();
        buildShaders(root);
        writeFileSync(join(root, "a.vertex.glsl"), "float b;\n");
        expect(buildShaders(root, { check: true }).changed).toEqual(["a.vertex.ts"]);
        expect(readFileSync(join(root, "a.vertex.ts"), "utf8")).toContain("float a;");
    });

    it("does not see a difference in comments or line endings of the module", () => {
        const root = folder({ "a.vertex.glsl": "float a;\n" });
        buildShaders(root);
        writeFileSync(join(root, "a.vertex.glsl"), "// note\r\nfloat a;\r\n");
        writeFileSync(join(root, "a.vertex.ts"), readFileSync(join(root, "a.vertex.ts"), "utf8").replace(/\n/g, "\r\n"));
        expect(buildShaders(root, { check: true }).changed).toEqual([]);
    });

    it("reports a generated module without shader file, and no other module", () => {
        const root = folder({ "a.vertex.ts": `${GENERATED_HEADER}\n`, "b.ts": "export const b = 1;\n" });
        expect(buildShaders(root).orphans).toEqual(["a.vertex.ts"]);
    });

    it("refuses two files generating the same module", () => {
        const root = folder({ "a.vertex.glsl": "float a;\n", "a.vertex.wgsl": "var a: f32;\n" });
        expect(() => buildShaders(root)).toThrow("another shader file");
    });

    it("refuses a badly named file", () => {
        expect(() => buildShaders(folder({ "a.glsl": "float a;\n" }))).toThrow("a.glsl");
    });
});
