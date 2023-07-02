// Vertex shader program
const vertexShaderSource = `#version 300 es
precision highp float;
 
      in vec3 a_position;
      in vec2 a_texCoord;
      
      out vec3 v_uv;

      void main() {
        // warning, passing the index in z, lead to value oustide of range for z.
        // then the data became unvisible. we must use x,y and put 0 in z.
        gl_Position = vec4(a_position.xy, 0.0, 1.0);
        // webgl does NOT allow invert y for texture3D operations, so we MUST do it by ourself.
        v_uv = vec3(a_texCoord.x, 1.0 - a_texCoord.y , a_position.z);  
}`;

// Fragment shader program
const fragmentShaderSource = `#version 300 es
     precision highp float;
 
     uniform highp sampler2DArray u_altitudes;
     uniform sampler2D u_rainbow;

     in vec3 v_uv;

     out vec4 fragColor;

      void main() {
        float alt = float(texture(u_altitudes, v_uv)); 
        float t = alt / 10000.0; // this is dummy value to test...
        fragColor = texture(u_rainbow, vec2(t,0.0));
}`;

function createRainbowImageData(width, height) {
    const workingCanvas = createCanvas(width, height);
    const workingContext = workingCanvas.getContext("2d");

    // Create a gradient from red to violet
    const gradient = workingContext.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, "red");
    gradient.addColorStop(1 / 6, "orange");
    gradient.addColorStop(2 / 6, "yellow");
    gradient.addColorStop(3 / 6, "green");
    gradient.addColorStop(4 / 6, "blue");
    gradient.addColorStop(5 / 6, "indigo");
    gradient.addColorStop(1, "violet");

    // Fill the canvas with the rainbow gradient
    workingContext.fillStyle = gradient;
    workingContext.fillRect(0, 0, width, height);

    const data = workingContext.getImageData(0, 0, width, height);
    workingCanvas.remove();
    return data;
}

function createCanvas(width, height) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = width;
    canvas.height = height;
    return canvas;
}

function getImageData(image) {
    if (image) {
        const w = image.width;
        const h = image.height;
        const workingCanvas = createCanvas(w, h);
        const workingContext = workingCanvas.getContext("2d");
        workingContext.clearRect(0, 0, w, h);
        workingContext.drawImage(image, 0, 0);
        const data = workingContext.getImageData(0, 0, w, h);
        workingCanvas.remove();
        return data;
    }
    return null;
}

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

function glCheckError(gl, mess) {
    const error = gl.getError();
    if (error !== gl.NO_ERROR) {
        console.error(`Webgl error in ${mess} : ${error} - check the browser log in order to have textual mess`);
    }
}

function createTexture(gl, format, width, height, type, data) {
    const texture = gl.createTexture();

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, format, width, height, 0, format, type, data);
    gl.bindTexture(gl.TEXTURE_2D, null);

    return texture;
}

function decodeElevation(pixels, offset, target, targetOffset) {
    const r = pixels[offset++];
    const g = pixels[offset++];
    const b = pixels[offset];

    target[targetOffset++] = r * 256 + g + b / 256 - 32768;
    return targetOffset;
}

function decodeFloat32(pixels, decoder, pixelSize = 4) {
    const size = pixels.length / pixelSize;
    const target = new Float32Array(size);
    targetOffset = 0;
    for (let i = 0; i < pixels.length; i += pixelSize) {
        targetOffset = decoder(pixels, i, target, targetOffset);
    }
    return target;
}

function createTextureArray(gl, format, width, height, depth) {
    const texture = gl.createTexture();

    // tell webgl to not invert texture coordinate in Y - which is not supported
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, texture);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, format, width, height, depth);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);

    return texture;
}

async function updateTextureArray(gl, texture, format, type) {
    const subject = "terrarium";
    const image00 = await fetchImage(`https://s3.amazonaws.com/elevation-tiles-prod/${subject}/12/3037/1714.png`);
    const image01 = await fetchImage(`https://s3.amazonaws.com/elevation-tiles-prod/${subject}/12/3037/1715.png`);
    const image10 = await fetchImage(`https://s3.amazonaws.com/elevation-tiles-prod/${subject}/12/3038/1714.png`);
    const image11 = await fetchImage(`https://s3.amazonaws.com/elevation-tiles-prod/${subject}/12/3038/1715.png`);

    const e00 = decodeFloat32(getImageData(image00).data, decodeElevation, 4);
    const e01 = decodeFloat32(getImageData(image01).data, decodeElevation, 4);
    const e10 = decodeFloat32(getImageData(image10).data, decodeElevation, 4);
    const e11 = decodeFloat32(getImageData(image11).data, decodeElevation, 4);

    gl.bindTexture(gl.TEXTURE_2D_ARRAY, texture);
    gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, 0, 256, 256, 1, format, type, e00);
    glCheckError(gl, "texSubImage3D");
    gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, 1, 256, 256, 1, format, type, e01);
    gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, 2, 256, 256, 1, format, type, e10);
    gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, 3, 256, 256, 1, format, type, e11);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, null);
}

function createSquare(x, y, s, i) {
    return new Float32Array([x, y, i, x + s, y, i, x, y + s, i, x + s, y, i, x + s, y + s, i, x, y + s, i]);
}
function createST() {
    return new Float32Array([0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1]);
}

function concatArrays(...params) {
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
    // Use the shader program
    gl.useProgram(program);

    // create rainbow texture
    const rainbowData = createRainbowImageData(256, 1);
    const rainbowTexture = createTexture(gl, gl.RGBA, 256, 1, gl.UNSIGNED_BYTE, rainbowData);

    // Create altitude texture
    const altitudes = createTextureArray(gl, gl.R16F, 256, 256, 4);
    await updateTextureArray(gl, altitudes, gl.RED, gl.FLOAT);

    // Rendering
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Create vertex buffer
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    // create square - the fourth parameter is the index of the depth into texture array
    // which is hold by the z attribute of position. This trick will be useful later to address
    // neighbours elevation data.
    const a = createSquare(-1, 0, 1, 0);
    const b = createSquare(-1, -1, 1, 1);
    const c = createSquare(0, 0, 1, 2);
    const d = createSquare(0, -1, 1, 3);

    const data = concatArrays(a, b, c, d);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

    // Create texture coordinates buffer
    const texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    const uva = createST();
    const uvb = createST();
    const uvc = createST();
    const uvd = createST();
    const uvs = concatArrays(uva, uvb, uvc, uvd);
    gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW);

    // Bind the position buffer
    const positionAttributeLocation = gl.getAttribLocation(program, "a_position");
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.vertexAttribPointer(positionAttributeLocation, 3, gl.FLOAT, false, 0, 0);

    // Bind the texture coordinate buffer
    const texCoordAttributeLocation = gl.getAttribLocation(program, "a_texCoord");
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.enableVertexAttribArray(texCoordAttributeLocation);
    gl.vertexAttribPointer(texCoordAttributeLocation, 2, gl.FLOAT, false, 0, 0);

    // Bind the textures
    const textureUnit1 = 0;
    const textureUnit2 = 1;

    gl.activeTexture(gl.TEXTURE0 + textureUnit1);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, altitudes);
    const textureUniformLocation = gl.getUniformLocation(program, "u_altitudes");
    gl.uniform1i(textureUniformLocation, textureUnit1);

    gl.activeTexture(gl.TEXTURE0 + textureUnit2);
    gl.bindTexture(gl.TEXTURE_2D, rainbowTexture);
    const rainbowTextureUniformLocation = gl.getUniformLocation(program, "u_rainbow");
    gl.uniform1i(rainbowTextureUniformLocation, textureUnit2);

    // Draw the triangles
    gl.drawArrays(gl.TRIANGLES, 0, data.length / 3);
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
