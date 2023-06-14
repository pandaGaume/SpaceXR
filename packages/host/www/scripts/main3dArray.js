// Vertex shader program
const vertexShaderSource = `#version 300 es
      precision highp float;

      in vec2 a_position;
      in vec2 a_texCoord;
      
      out vec2 v_texCoord;

      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
      }
    `;

// Fragment shader program
const fragmentShaderSource = `#version 300 es
      precision highp float;
 
      uniform highp sampler2DArray u_texture;

      in vec2 v_texCoord;
      
      out vec4 fragColor;

      void main() {
        fragColor = texture(u_texture, vec3(v_texCoord,2.0));
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

function createTexture(gl, format, width, height, depth) {
    const texture = gl.createTexture();

    gl.bindTexture(gl.TEXTURE_2D_ARRAY, texture);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, format, width, height, depth);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);

    return texture;
}

async function updateTexture(gl, texture) {
    const image00 = await fetchImage("https://s3.amazonaws.com/elevation-tiles-prod/normal/12/3037/1714.png");
    const image01 = await fetchImage("https://s3.amazonaws.com/elevation-tiles-prod/normal/12/3037/1715.png");
    const image10 = await fetchImage("https://s3.amazonaws.com/elevation-tiles-prod/normal/12/3038/1714.png");
    const image11 = await fetchImage("https://s3.amazonaws.com/elevation-tiles-prod/normal/12/3038/1715.png");

    gl.bindTexture(gl.TEXTURE_2D_ARRAY, texture);
    gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, 0, 256, 256, 1, gl.RGB, gl.UNSIGNED_BYTE, image00);
    gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, 1, 256, 256, 1, gl.RGB, gl.UNSIGNED_BYTE, image01);
    gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, 2, 256, 256, 1, gl.RGB, gl.UNSIGNED_BYTE, image10);
    gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, 3, 256, 256, 1, gl.RGB, gl.UNSIGNED_BYTE, image11);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
}

async function main() {
    const canvas = document.getElementById("canvas");
    const gl = canvas.getContext("webgl2");

    // Create shader program
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    const program = createProgram(gl, vertexShader, fragmentShader);

    // Create texture
    const texture = createTexture(gl, gl.RGB8, 256, 256, 4);
    // load texture
    await updateTexture(gl, texture);

    // Rendering
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Use the shader program
    gl.useProgram(program);

    // Create vertex buffer
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);

    // Create texture coordinates buffer
    const texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1]), gl.STATIC_DRAW);

    // Look up attribute and uniform locations
    const positionAttributeLocation = gl.getAttribLocation(program, "a_position");
    const texCoordAttributeLocation = gl.getAttribLocation(program, "a_texCoord");
    const textureUniformLocation = gl.getUniformLocation(program, "u_texture");

    // Bind the position buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

    // Bind the texture coordinate buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.enableVertexAttribArray(texCoordAttributeLocation);
    gl.vertexAttribPointer(texCoordAttributeLocation, 2, gl.FLOAT, false, 0, 0);

    // Bind the texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, texture);
    gl.uniform1i(textureUniformLocation, 0);

    // Draw the triangles
    gl.drawArrays(gl.TRIANGLES, 0, 6);

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
