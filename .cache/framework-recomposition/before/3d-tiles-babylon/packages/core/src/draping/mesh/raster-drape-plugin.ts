import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine.js";
import { ShaderLanguage } from "@babylonjs/core/Materials/shaderLanguage.js";
import { MaterialDefines } from "@babylonjs/core/Materials/materialDefines.js";
import { MaterialPluginBase } from "@babylonjs/core/Materials/materialPluginBase.js";
import type { Material } from "@babylonjs/core/Materials/material.js";
import type { UniformBuffer } from "@babylonjs/core/Materials/uniformBuffer.js";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh.js";
import type { SubMesh } from "@babylonjs/core/Meshes/subMesh.js";
import type { Scene } from "@babylonjs/core/scene.js";

import type { TextureArrayPool } from "../../raster/texture-array-pool";
import { rasterDrapeFragmentDefinitions } from "./shaders/snippets/rasterDrapeFragmentDefinitions";
import { rasterDrapeFragmentUpdateDiffuse } from "./shaders/snippets/rasterDrapeFragmentUpdateDiffuse";
import { rasterDrapeUniforms } from "./shaders/snippets/rasterDrapeUniforms";
import { rasterDrapeVertexDefinitions } from "./shaders/snippets/rasterDrapeVertexDefinitions";
import { rasterDrapeVertexMainEnd } from "./shaders/snippets/rasterDrapeVertexMainEnd";
import { rasterDrapeFragmentDefinitionsWGSL } from "./shaders/wgsl/snippets/rasterDrapeFragmentDefinitions";
import { rasterDrapeFragmentUpdateDiffuseWGSL } from "./shaders/wgsl/snippets/rasterDrapeFragmentUpdateDiffuse";
import { rasterDrapeUniformsWGSL } from "./shaders/wgsl/snippets/rasterDrapeUniforms";
import { rasterDrapeVertexDefinitionsWGSL } from "./shaders/wgsl/snippets/rasterDrapeVertexDefinitions";
import { rasterDrapeVertexMainEndWGSL } from "./shaders/wgsl/snippets/rasterDrapeVertexMainEnd";

/** Binding of one mesh: its drape depth and the layer of its cell table, `-1` without table. */
export interface IMeshRasterDrape {
    depth: number;
    tableLayer: number;
}

const NO_DRAPE: IMeshRasterDrape = { depth: 0, tableLayer: -1 };

/** Source of the drape of each mesh, kept by the draping engine. */
export interface IMeshRasterDrapeSource {
    /** Imagery pages, RGBA8. */
    readonly pages: TextureArrayPool;
    /** Cell tables, RGBA32F: per cell, the page layer, `-1` without page, then `west, north, size` in the page. */
    readonly tables: TextureArrayPool;
    drapeOf(mesh: AbstractMesh): IMeshRasterDrape | undefined;
}

class RasterDrapeDefines extends MaterialDefines {
    public RASTERDRAPE = false;
}

/**
 * Standard material plugin colouring terrain tiles with imagery pages.
 *
 * A terrain tile draped at depth `k` is divided into `2^k x 2^k` cells, each sampling its own page. The cells of a
 * mesh are described by a table, one texel per cell, read with `texelFetch`; each mesh receives its depth and table
 * layer when it is drawn, so tiles of every level share one material. Lighting is unchanged: the page colour replaces
 * the diffuse colour, and a cell without page keeps the material colour. The mesh UVs are the tile coordinates
 * `(u, 1 - v)`, `u` east and `v` south.
 */
export class RasterDrapeMaterialPlugin extends MaterialPluginBase {
    private enabled = true;

    public constructor(
        material: Material,
        private readonly source: IMeshRasterDrapeSource,
    ) {
        super(material, "RasterDrape", 200, new RasterDrapeDefines());
        this.registerForExtraEvents = true;
        this._enable(true);
    }

    public override getClassName(): string {
        return "RasterDrapeMaterialPlugin";
    }

    /** Shows the material colour instead of the imagery when false. */
    public get isEnabled(): boolean {
        return this.enabled;
    }

    public set isEnabled(value: boolean) {
        if (this.enabled === value) return;
        this.enabled = value;
        this.markAllDefinesAsDirty();
    }

    /** The drape is written in GLSL for WebGL and in WGSL for WebGPU. Texture arrays need WebGL 2 or WebGPU. */
    public override isCompatible(shaderLanguage: ShaderLanguage): boolean {
        return (
            (shaderLanguage === ShaderLanguage.GLSL || shaderLanguage === ShaderLanguage.WGSL) &&
            this._material.getScene().getEngine().getCaps().texture2DArrayMaxLayerCount > 0
        );
    }

    public override prepareDefinesBeforeAttributes(defines: MaterialDefines): void {
        defines["RASTERDRAPE"] = this.enabled;
        // The tile coordinates come from the mesh UVs.
        if (this.enabled) defines._needUVs = true;
    }

    public override getSamplers(samplers: string[]): void {
        samplers.push("drapePages", "drapeTables");
    }

    public override getUniforms(shaderLanguage: ShaderLanguage = ShaderLanguage.GLSL): {
        ubo: { name: string; size: number; type: string }[];
        fragment: string;
    } {
        return {
            ubo: [{ name: "drapeInfo", size: 4, type: "vec4" }],
            fragment: (shaderLanguage === ShaderLanguage.WGSL ? rasterDrapeUniformsWGSL : rasterDrapeUniforms).shader,
        };
    }

    public override bindForSubMesh(uniformBuffer: UniformBuffer, _scene: Scene, _engine: AbstractEngine, subMesh: SubMesh): void {
        this.bindDrape(uniformBuffer, subMesh);
    }

    /** Called for every mesh drawn, even when the material does not rebind: each mesh has its own drape. */
    public override hardBindForSubMesh(uniformBuffer: UniformBuffer, _scene: Scene, _engine: AbstractEngine, subMesh: SubMesh): void {
        this.bindDrape(uniformBuffer, subMesh);
    }

    public override getCustomCode(shaderType: string, shaderLanguage: ShaderLanguage = ShaderLanguage.GLSL): Record<string, string> | null {
        const wgsl = shaderLanguage === ShaderLanguage.WGSL;
        if (shaderType === "vertex")
            return {
                CUSTOM_VERTEX_DEFINITIONS: (wgsl ? rasterDrapeVertexDefinitionsWGSL : rasterDrapeVertexDefinitions).shader,
                CUSTOM_VERTEX_MAIN_END: (wgsl ? rasterDrapeVertexMainEndWGSL : rasterDrapeVertexMainEnd).shader,
            };
        if (shaderType === "fragment")
            return {
                CUSTOM_FRAGMENT_DEFINITIONS: (wgsl ? rasterDrapeFragmentDefinitionsWGSL : rasterDrapeFragmentDefinitions).shader,
                CUSTOM_FRAGMENT_UPDATE_DIFFUSE: (wgsl ? rasterDrapeFragmentUpdateDiffuseWGSL : rasterDrapeFragmentUpdateDiffuse).shader,
            };
        return null;
    }

    private bindDrape(uniformBuffer: UniformBuffer, subMesh: SubMesh): void {
        if (!this.enabled) return;
        const drape = this.source.drapeOf(subMesh.getMesh()) ?? NO_DRAPE;
        uniformBuffer.updateFloat4("drapeInfo", drape.depth, drape.tableLayer, 0, 0);
        uniformBuffer.setTexture("drapePages", this.source.pages);
        uniformBuffer.setTexture("drapeTables", this.source.tables);
    }
}
