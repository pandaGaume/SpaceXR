// Vertex shader program
const vertexShaderSource = `#version 300 es
      precision highp float;

      in vec3 a_position;
      in vec2 a_texCoord;
      
      out vec2 v_texCoord;
      out float v_depth;

      void main() {
        // warning, passing the index in z, lead to value oustide of range for z.
        // then the data became unvisible. we must use x,y and put 0 in z.
        gl_Position = vec4(a_position.xy,0.0, 1.0);
        v_depth = a_position.z;
        v_texCoord = a_texCoord;
      }
    `;

// Fragment shader program
const fragmentShaderSource = `#version 300 es
      precision highp float;
 
      uniform highp sampler2DArray u_texture;

      in vec2 v_texCoord;
      in float v_depth;
      out vec4 fragColor;

      void main() {
        fragColor = texture(u_texture, vec3(v_texCoord,v_depth));
      }
    `;

async function fetchImage(url) {
    const r = await fetch(url);
    if (r && r.ok) {
        const blob = r instanceof Response ? await r.blob() : null;
        if (blob) {
            return new Promise((resolve, reject) => {
                const img = new Image();
                const blobURL = URL.createObjectURL(blob);
                // this frees up memory, which is usually handled automatically when you close the
                // page or navigate away from it
                img.onload = function (ev) {
                    const e = ev.target;
                    if (e && e instanceof HTMLImageElement) {
                        URL.revokeObjectURL(e.src);
                        e.onload = null;
                    }
                    // then call the resolve part of the promise.
                    resolve(img);
                };
                img.onerror = reject;
                img.src = blobURL;
            });
        }
    }
    return null;
}

function createTextureArray(gl, format, width, height, depth) {
    const texture = gl.createTexture();

    // tell webgl to invert texture coordinate in Y
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

    gl.bindTexture(gl.TEXTURE_2D_ARRAY, texture);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, format, width, height, depth);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);

    return texture;
}

async function updateTextureArray(gl, texture) {
    const subject = "terrarium";
    const image00 = await fetchImage(`https://s3.amazonaws.com/elevation-tiles-prod/${subject}/12/3037/1714.png`);
    const image01 = await fetchImage(`https://s3.amazonaws.com/elevation-tiles-prod/${subject}/12/3037/1715.png`);
    const image10 = await fetchImage(`https://s3.amazonaws.com/elevation-tiles-prod/${subject}/12/3038/1714.png`);
    const image11 = await fetchImage(`https://s3.amazonaws.com/elevation-tiles-prod/${subject}/12/3038/1715.png`);

    gl.bindTexture(gl.TEXTURE_2D_ARRAY, texture);
    gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, 0, 256, 256, 1, gl.RGB, gl.UNSIGNED_BYTE, image00);
    gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, 1, 256, 256, 1, gl.RGB, gl.UNSIGNED_BYTE, image01);
    gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, 2, 256, 256, 1, gl.RGB, gl.UNSIGNED_BYTE, image10);
    gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, 3, 256, 256, 1, gl.RGB, gl.UNSIGNED_BYTE, image11);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
}

function createSquare(x, y, s, i) {
    return new Float32Array([x, y, i, x + s, y, i, x, y + s, i, x + s, y, i, x + s, y + s, i, x, y + s, i]);
}
function createUV() {
    return new Float32Array([0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1]);
}

function concat(...params) {
    let length = 0;
    for (const a of params) {
        length += a.length;
    }
    const target = new Float32Array(length);
    let count = 0;
    for (let i = 0; i != params.length; i++) {
        target.set(params[i], count);
        count += params[i].length;
    }
    return target;
}

async function main() {
    const canvas = document.getElementById("canvas");
    const gl = canvas.getContext("webgl2");

    // Create shader program
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    const program = createProgram(gl, vertexShader, fragmentShader);

    // Create texture
    const texture = createTextureArray(gl, gl.RGB8, 256, 256, 4);

    // load texture
    await updateTextureArray(gl, texture);

    // Rendering
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Use the shader program
    gl.useProgram(program);

    // Create vertex buffer
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const a = createSquare(-1, 0, 1, 0);
    const b = createSquare(-1, -1, 1, 1);
    const c = createSquare(0, 0, 1, 2);
    const d = createSquare(0, -1, 1, 3);

    const data = concat(a, b, c, d);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

    // Create texture coordinates buffer
    const texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    const uva = createUV();
    const uvb = createUV();
    const uvc = createUV();
    const uvd = createUV();
    const uvs = concat(uva, uvb, uvc, uvd);
    gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW);

    // Look up attribute and uniform locations
    const positionAttributeLocation = gl.getAttribLocation(program, "a_position");
    const texCoordAttributeLocation = gl.getAttribLocation(program, "a_texCoord");
    const textureUniformLocation = gl.getUniformLocation(program, "u_texture");

    // Bind the position buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.vertexAttribPointer(positionAttributeLocation, 3, gl.FLOAT, false, 0, 0);

    // Bind the texture coordinate buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.enableVertexAttribArray(texCoordAttributeLocation);
    gl.vertexAttribPointer(texCoordAttributeLocation, 2, gl.FLOAT, false, 0, 0);

    // Bind the texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, texture);
    gl.uniform1i(textureUniformLocation, 0);

    // Draw the triangles
    gl.drawArrays(gl.TRIANGLES, 0, data.length / 3);

    gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
}

// Utility functions for creating shaders and program
function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (success) {
        return shader;
    }
    console.log(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
}

function createProgram(gl, vertexShader, fragmentShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    const success = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (success) {
        return program;
    }
    console.log(gl.getShaderInfoLog(vertexShader));
    console.log(gl.getShaderInfoLog(fragmentShader));
    gl.deleteProgram(program);
}

main();
