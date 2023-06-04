/* eslint-disable @typescript-eslint/no-unused-vars */
import * as fs from "fs";
import * as path from "path";
import { checkArgs, getHashOfContent, getHashOfFile } from "./utils";

const tsShaderTemplate = `// Important Note: This file has been generated as part of the build process.
// Therefore, any manual changes made to this file will be overridden by the next build.
// We strongly advise against editing this file directly, as it may cause unintended consequences and affect the final product.
import { ShaderStore } from "@babylonjs/core";
const name = "##NAME_PLACEHOLDER##";
const shader = \`##SHADER_PLACEHOLDER##\`;
ShaderStore.##SHADERSTORE_PLACEHOLDER##[name] = shader;
/** @internal */ export const ##NAME_PLACEHOLDER## = { name, shader };`;

/**
 * Get the shaders name from their path.
 * @param filename
 */
function getShaderName(filename: string): string | undefined {
    const parts = filename.split(".");
    if (parts[1] !== "glsl") {
        if (parts[1].toLowerCase() === "fragment") {
            return `${parts[0]}FragmentShader`;
        }
        if (parts[1].toLowerCase() === "vertex") {
            return `${parts[0]}VertexShader`;
        }
        return undefined;
    } else {
        return parts[0];
    }
}

export function buildShaders(filePath: string) {
    const isVerbose = checkArgs("--verbose", true);
    isVerbose && console.log("Generating shaders for " + filePath);

    const content = fs.readFileSync(filePath, "utf8");
    const filename = path.basename(filePath);
    const normalized = path.normalize(filePath);
    const directory = path.dirname(normalized);
    const shaderName = getShaderName(filename);
    if (shaderName === undefined) {
        console.log(`file name :${filename} do not follow naming pattern convention. Must be xxxx.vertex.glsl or xxxx.fragment.glsl.`);
        return;
    }
    const tsFilename = filename.replace(".glsl", ".ts");
    let glslData = content.toString();

    isVerbose && console.log(`directory:${directory}, shaderName:${shaderName}, ts file name:${tsFilename}`);

    // Remove Trailing whitespace...
    glslData = glslData
        .replace(/^\uFEFF/, "")
        .replace(/(\/\/)+.*$/gm, "")
        .replace(/\t+/gm, " ")
        .replace(/^\s+/gm, "")
        // .replace(/[^\S\r\n]{2,}$/gm, "")
        // eslint-disable-next-line no-useless-escape
        .replace(/ ([\*\/\=\+\-\>\<]+) /g, "$1")
        .replace(/,[ \n]/g, ",")
        .replace(/ {1,}/g, " ")
        // .replace(/;\s*/g, ";")
        .replace(/^#(.*)/gm, "#$1\n")
        .replace(/\{\n([^#])/g, "{$1")
        .replace(/\n\}/g, "}")
        .replace(/^(?:[\t ]*(?:\r?\n|\r))+/gm, "")
        .replace(/;\n([^#])/g, ";$1");

    const isInclude = directory.indexOf("includes") > -1;
    const shaderStore = isInclude ? `IncludesShadersStore` : `ShadersStore`;

    // Fill template in.
    let tsContent = tsShaderTemplate.replaceAll("##NAME_PLACEHOLDER##", shaderName);
    tsContent = tsContent.replaceAll("##SHADER_PLACEHOLDER##", glslData);
    tsContent = tsContent.replace("##SHADERSTORE_PLACEHOLDER##", shaderStore);

    const tsShaderFilename = path.join(directory, tsFilename);

    // check hash
    if (fs.existsSync(tsShaderFilename)) {
        const hash = getHashOfFile(tsShaderFilename);
        const newHash = getHashOfContent(tsContent);
        if (hash === newHash) {
            isVerbose && console.log("Skip " + tsShaderFilename);
            return;
        }
    }

    fs.writeFileSync(tsShaderFilename, tsContent);
    isVerbose && console.log("Generated " + tsShaderFilename);
}
