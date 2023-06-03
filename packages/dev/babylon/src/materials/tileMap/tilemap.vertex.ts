// Important Note: This file has been generated as part of the build process.
// Therefore, any manual changes made to this file will be overridden by the next build.
// We strongly advise against editing this file directly, as it may cause unintended consequences and affect the final product.
import { ShaderStore } from "@babylonjs/core";

const tilemapVertexShader = `precision highp float;attribute vec3 position;attribute vec3 normal;uniform mat4 worldViewProjection;uniform vec3 tileSize; uniform vec3 cellSize; uniform vec2 size;varying vec4 vPosition;varying vec3 vNormal;varying vec4 fClipDistance;void main(void) {vec4 p=vec4(position*tileSize*cellSize,1);vec2 halfSize=size/2.0; fClipDistance=vec4(p.x+halfSize.x,halfSize.y-p.y,halfSize.x-p.x,p.y+halfSize.y );vPosition=p.xzyw; vec4 outPosition=worldViewProjection*vPosition ;gl_Position=outPosition;vNormal=normal; }`;
ShaderStore.ShadersStore["tilemapVertexShader"] = tilemapVertexShader;
