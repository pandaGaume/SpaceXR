struct SceneCamera {forward:vec4f,right:vec4f,up:vec4f,screen:vec4f,sun:vec4f,inverseProjection:mat4x4f,options:vec4f}
@group(1) @binding(0) var<uniform> sceneCamera:SceneCamera;
@group(1) @binding(1) var sceneColor:texture_2d<f32>;
@group(1) @binding(2) var sceneDepth:texture_depth_2d;
@group(1) @binding(3) var aerialRadiance:texture_3d<f32>;
@group(1) @binding(4) var aerialTransmission:texture_3d<f32>;
@group(1) @binding(5) var aerialSampler:sampler;
@vertex fn vertexMain(@builtin(vertex_index) index:u32)->@builtin(position) vec4f {
    let positions=array<vec2f,3>(vec2f(-1.0,-1.0),vec2f(3.0,-1.0),vec2f(-1.0,3.0));return vec4f(positions[index],0.0,1.0);
}
fn viewRay(uv:vec2f)->vec3f {return normalize(sceneCamera.forward.xyz+(2.0*uv.x-1.0)*sceneCamera.right.w*sceneCamera.right.xyz+(1.0-2.0*uv.y)*sceneCamera.up.w*sceneCamera.up.xyz);}
fn skyLight(d:vec3f)->vec3f {
    let interval=atmosphere_interval(atmosphere_cameraPoint(),d);
    if interval.y<=interval.x {return vec3f(0.0);}
    return max(atmosphere_skyRadiance(d),vec3f(0.0));
}
@fragment fn fragmentMain(@builtin(position) pixel:vec4f)->@location(0) vec4f {
    let uv=pixel.xy/sceneCamera.screen.xy;let direction=viewRay(uv);
    // Babylon renders its scene RTT with Y inverted. Read actual displaced geometry depth from that same pass.
    let size=vec2i(textureDimensions(sceneColor));let coordinate=clamp(vec2i(i32(pixel.x),size.y-1-i32(pixel.y)),vec2i(0),size-vec2i(1));
    let depth=textureLoad(sceneDepth,coordinate,0);
    let surface=textureLoad(sceneColor,coordinate,0).rgb;
    let interval=atmosphere_interval(atmosphere_cameraPoint(),direction);
    let v=direction*atmosphere_frame.inverseHi.xyz;let origin=atmosphere_cameraPoint().hi;
    let closest=max(0.0,-dot(origin,v)/dot(v,v));
    let edge=length(origin+v*closest)-atmosphere_frame.inverseHi.w;
    let edgeWidth=max(fwidth(edge),1e-7);
    let sunAngle=length(cross(direction,sceneCamera.sun.xyz));let sunAA=max(fwidth(sunAngle),1e-6);
    let disc=(1.0-smoothstep(sin(sceneCamera.sun.w)-sunAA,sin(sceneCamera.sun.w)+sunAA,sunAngle))*select(0.0,1.0,dot(direction,sceneCamera.sun.xyz)>0.0);
    let geometry=abs(depth-sceneCamera.options.x)>1e-7;
    var color=vec3f(0.0);
    if geometry {
        let viewPosition=sceneCamera.inverseProjection*vec4f(uv.x*2.0-1.0,1.0-uv.y*2.0,depth,1.0);
        let distance=length(viewPosition.xyz/viewPosition.w)/1000.0;
        var light=vec3f(0.0);var transmission=vec3f(1.0);
        if interval.y>interval.x && distance>interval.x {
            let fraction=clamp((distance-interval.x)/(interval.y-interval.x),0.0,1.0);
            let dimensions=vec3f(textureDimensions(aerialRadiance));
            let coord=(vec3f(uv,fraction)*(dimensions-vec3f(1.0))+vec3f(0.5))/dimensions;
            light=textureSampleLevel(aerialRadiance,aerialSampler,coord,0.0).rgb;
            transmission=textureSampleLevel(aerialTransmission,aerialSampler,coord,0.0).rgb;
            // At the ellipsoid endpoint the denser horizon cache is a more accurate full-path boundary condition.
            let endpoint=smoothstep(0.9,1.0,fraction);
            light=mix(light,skyLight(direction),endpoint);
            transmission=mix(transmission,atmosphere_skyTransmission(direction),endpoint);
        }
        color=surface*transmission+light;
    } else {
        if abs(edge)<2.0*edgeWidth {
            let pixelSize=1.0/sceneCamera.screen.xy;
            color=0.25*(skyLight(viewRay(uv+vec2f(-0.25,-0.25)*pixelSize))+skyLight(viewRay(uv+vec2f(0.25,-0.25)*pixelSize))
                +skyLight(viewRay(uv+vec2f(-0.25,0.25)*pixelSize))+skyLight(viewRay(uv+vec2f(0.25,0.25)*pixelSize)));
        } else {color=skyLight(direction);}
        let ground=atmosphere_intersect(atmosphere_cameraPoint(),direction,1.0);
        if disc>0.0 && !(ground.x>=0.0 && ground.y>0.0) {
            let skyUv=atmosphere_skyUv(direction);var xyz=vec3f(0.0);
            for(var group=0u;group<arrayLength(&atmosphere_spectrum);group++) {
                let band=atmosphere_spectrum[group];
                let t=textureSampleLevel(atmosphere_transmission,atmosphere_sampler,skyUv,i32(group),0.0).xyz;
                xyz+=atmosphere_toXYZ(t*band.atmosphere_solar.xyz,band);
            }
            color+=max(atmosphere_xyzToRgb(xyz),vec3f(0.0))*disc/(4.0*atmosphere_PI*pow(sin(0.5*sceneCamera.sun.w),2.0));
        }
    }
    let mapped=vec3f(1.0)-exp(-max(color,vec3f(0.0))*sceneCamera.screen.z);
    let encoded=select(1.055*pow(mapped,vec3f(1.0/2.4))-vec3f(0.055),12.92*mapped,mapped<=vec3f(0.0031308));
    return vec4f(encoded,1.0);
}
