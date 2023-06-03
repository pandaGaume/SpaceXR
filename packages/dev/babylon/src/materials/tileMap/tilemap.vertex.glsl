precision highp float;

    // Attributes
    attribute vec3 position;
    attribute vec3 normal;

    // Uniforms
    uniform mat4 worldViewProjection;
    uniform vec3 tileSize; // the size of the tile 
    uniform vec3 cellSize; // the size of one cell - ie the size in 3D coordinate of a pixel.
    uniform vec2 size;
 
    // Varying
    varying vec4 vPosition;
    varying vec3 vNormal;
	varying vec4 fClipDistance;

    void main(void) {

        // convert normalized position to map coordinates
        // ----------------------------------------------
        // 1 - get the coordinate in pixel
        vec4 p = vec4(position * tileSize * cellSize, 1);
        vec2 halfSize = size / 2.0; 
        fClipDistance = vec4(p.x+halfSize.x,halfSize.y-p.y,halfSize.x-p.x,p.y+halfSize.y );
      
        // finally assign position 
        // --------------------
        vPosition = p.xzyw; // switch y and z
        vec4 outPosition = worldViewProjection * vPosition ;
        gl_Position = outPosition;
    
        vNormal = normal; 
    }