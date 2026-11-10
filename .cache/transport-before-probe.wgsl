const atmosphere_PI:f32=3.141592653589793;
struct atmosphere_LayerProfile { bounds:vec4f, shape:vec4f }
struct atmosphere_LayerOptics { rayleigh:vec4f, scattering:vec4f, atmosphere_extinction:vec4f }
struct atmosphere_SpectralBand {
    rayleigh:vec4f, scattering:vec4f, atmosphere_extinction:vec4f,
    toX:vec4f, toY:vec4f, toZ:vec4f, atmosphere_solar:vec4f,
    layers:array<atmosphere_LayerOptics,4>,
}
@group(0) @binding(1) var<storage,read> atmosphere_profiles:array<atmosphere_LayerProfile>;
@group(0) @binding(2) var<storage,read> atmosphere_spectrum:array<atmosphere_SpectralBand>;
@group(0) @binding(3) var atmosphere_phase:texture_2d<f32>;
fn atmosphere_density(p: atmosphere_Point) -> vec4f {
    let h=atmosphere_altitude(p); var rho=vec4f(0.0);
    if h<0.0 || h>atmosphere_frame.originHi.w { return rho; }
    for(var i=0u;i<arrayLength(&atmosphere_profiles);i++) {
        let layer=atmosphere_profiles[i];
        if h>=layer.bounds.x && h<layer.bounds.y {
            let x=(h-layer.bounds.z)/layer.bounds.w;
            rho[i]=layer.shape.x*select(select(exp(select(-x,-0.5*x*x,layer.shape.y>1.5)),1.0,layer.shape.y>0.5&&layer.shape.y<1.5),max(0.0,1.0-abs(x)),layer.shape.y>2.5);
        }
    }
    return rho;
}
fn atmosphere_extinction(rho:vec4f,band:atmosphere_SpectralBand)->vec3f {
    var value=vec3f(0.0);
    for(var l=0u;l<arrayLength(&atmosphere_profiles);l++) { value+=band.layers[l].atmosphere_extinction.xyz*rho[l]; }
    return value;
}
fn atmosphere_solarDirect(p:atmosphere_Point,band:atmosphere_SpectralBand)->vec3f {
    let direction=atmosphere_frame.sun.xyz; let ground=atmosphere_intersect(p,direction,1.0);
    if ground.y>1e-7 && ground.x>=-1e-7 { return vec3f(0.0); }
    let outer=atmosphere_intersect(p,direction,atmosphere_frame.inverseHi.w);
    let start=max(0.0,outer.x); let end=outer.y;
    if end<=start { return vec3f(1.0); }
    let count=atmosphere_frame.quality.y; let step=(end-start)/f32(count); var col=vec4f(0.0);
    for(var j=0u;j<count;j++) { col+=atmosphere_density(atmosphere_pointAdd(p,direction,start+(f32(j)+0.5)*step))*step; }
    return exp(-atmosphere_extinction(col,band));
}
fn atmosphere_phaseValue(mu:f32,group:u32,layer:u32)->vec3f {
    let width=textureDimensions(atmosphere_phase).x;
    let x=sqrt(acos(clamp(mu,-1.0,1.0))/atmosphere_PI)*f32(width-1u); let a=u32(floor(x));
    let row=layer*arrayLength(&atmosphere_spectrum)+group;
    return mix(textureLoad(atmosphere_phase,vec2i(i32(a),i32(row)),0).xyz,
        textureLoad(atmosphere_phase,vec2i(i32(min(a+1u,width-1u)),i32(row)),0).xyz,fract(x));
}
struct atmosphere_RayResult { light:vec3f, transmission:vec3f }
fn atmosphere_integrate(d:vec3f,group:u32,tangentSide:i32)->atmosphere_RayResult {
    let origin=atmosphere_cameraPoint(); var segment=atmosphere_interval(origin,d);
    if tangentSide!=0 {
        let outer=atmosphere_intersect(origin,d,atmosphere_frame.inverseHi.w);
        let scaled=d*atmosphere_frame.inverseHi.xyz;
        let closest=max(0.0,-dot(origin.hi,scaled)/dot(scaled,scaled));
        segment=vec2f(max(0.0,outer.x),select(outer.y,closest,tangentSide<0));
    }
    return atmosphere_integrateRange(d,group,segment,tangentSide,i32(atmosphere_frame.quality.x));
}
// Shared finite-segment transport; no renderer-specific approximation of scattering.
fn atmosphere_integrateRange(d:vec3f,group:u32,segment:vec2f,tangentSide:i32,steps:i32)->atmosphere_RayResult {
    let origin=atmosphere_cameraPoint();
    var light=vec3f(0.0); var transmission=vec3f(1.0);
    if segment.y<=segment.x { return atmosphere_RayResult(light,transmission); }
    let band=atmosphere_spectrum[group]; let mu=dot(d,atmosphere_frame.sun.xyz);
    let phaseR=3.0*(1.0+mu*mu)/(16.0*atmosphere_PI);
    var phaseM:array<vec3f,4>;
    for(var l=0u;l<arrayLength(&atmosphere_profiles);l++) { phaseM[l]=atmosphere_phaseValue(mu,group,l); }
    let count=u32(steps); let ds=(segment.y-segment.x)/f32(count);
    for(var i=0u;i<count;i++) {
        var p=atmosphere_pointAdd(origin,d,segment.x+(f32(i)+0.5)*ds);
        if tangentSide!=0 {
            let height=atmosphere_altitude(p);
            if height<0.000001 {p=atmosphere_pointAdd(p,normalize(p.hi*atmosphere_frame.inverseHi.xyz),0.000001-height);}
        }
        let rho=atmosphere_density(p);
        let ext=atmosphere_extinction(rho,band); let stepT=exp(-ext*ds); var source=vec3f(0.0);
        for(var l=0u;l<arrayLength(&atmosphere_profiles);l++) {
            source+=rho[l]*(band.layers[l].rayleigh.xyz*phaseR+band.layers[l].scattering.xyz*phaseM[l]);
        }
        var weight=vec3f(ds);
        for(var c=0u;c<3u;c++) { if ext[c]>1e-7 { weight[c]=(1.0-stepT[c])/ext[c]; } }
        var diffuse=vec3f(0.0);
        if atmosphere_frame.sun.w>0.5 {
            var scattering=vec3f(0.0);
            for(var l=0u;l<arrayLength(&atmosphere_profiles);l++){scattering+=rho[l]*(band.layers[l].rayleigh.xyz+band.layers[l].scattering.xyz);}
            diffuse=scattering*atmosphere_multipleRadiance(p,group);
        }
        light+=transmission*(atmosphere_solar(p,band)*source+diffuse)*weight; transmission*=stepT;
    }
    return atmosphere_RayResult(light,transmission);
}
fn atmosphere_toXYZ(v:vec3f,b:atmosphere_SpectralBand)->vec3f { return vec3f(dot(v,b.toX.xyz),dot(v,b.toY.xyz),dot(v,b.toZ.xyz)); }
fn atmosphere_xyzToRgb(v:vec3f)->vec3f { return vec3f(dot(v,vec3f(3.2406,-1.5372,-0.4986)),dot(v,vec3f(-0.9689,1.8758,0.0415)),dot(v,vec3f(0.0557,-0.2040,1.0570))); }

@group(0) @binding(8) var atmosphere_solarColumns:texture_3d<f32>;
fn atmosphere_terminator(p:atmosphere_Point)->f32 {
    let v=atmosphere_frame.sun.xyz*atmosphere_frame.inverseHi.xyz;
    let residual=atmosphere_add(atmosphere_pointDot(p,p),atmosphere_Pair(-1.0,0.0));
    let tangent=-sqrt(dot(v,v)*max(0.0,residual.hi+residual.lo));
    let denominator=max(1e-15,length(p.hi.xy)*length(v.xy));
    return acos(clamp((tangent-p.hi.z*v.z)/denominator,-1.0,1.0));
}
fn atmosphere_solar(p:atmosphere_Point,band:atmosphere_SpectralBand)->vec3f {
    let direction=atmosphere_frame.sun.xyz; let ground=atmosphere_intersect(p,direction,1.0);
    if ground.y>1e-7 && ground.x>=-1e-7 { return vec3f(0.0); }
    let h=atmosphere_altitude(p);
    if h<0.0 || h>atmosphere_frame.originHi.w { return atmosphere_solarDirect(p,band); }
    let inv=atmosphere_frame.inverseHi.xyz;
    var n=normalize(p.hi*inv);
    for(var k=0u;k<3u;k++) { n=normalize(atmosphere_pointAdd(p,n,-h).hi*inv); }
    let latitude=asin(clamp(n.z,-1.0,1.0));
    let longitude=atan2(p.hi.y,p.hi.x)-atan2(direction.y,direction.x);
    let angle=abs((fract(longitude/(2.0*atmosphere_PI)+0.5)-0.5)*2.0*atmosphere_PI);let center=atmosphere_terminator(p);
    let u=1.0-sqrt(clamp(1.0-angle/max(1e-8,center-1e-7),0.0,1.0));
    let dimensions=vec3i(textureDimensions(atmosphere_solarColumns));
    let coord=vec3f(u,latitude/atmosphere_PI+0.5,sqrt(clamp(h/atmosphere_frame.originHi.w,0.0,1.0)))*vec3f(dimensions-vec3i(1));
    let base=vec3i(floor(coord));let f=fract(coord);var col=vec4f(0.0);
    for(var c=0u;c<8u;c++) {
        let shift=vec3i(i32(c&1u),i32((c>>1u)&1u),i32((c>>2u)&1u));let weights=select(vec3f(1.0)-f,f,shift>vec3i(0));let w=weights.x*weights.y*weights.z;
        if w>1e-7 { let value=textureLoad(atmosphere_solarColumns,clamp(base+shift,vec3i(0),dimensions-vec3i(1)),0);if value.x<0.0 {return atmosphere_solarDirect(p,band);}col+=w*value; }
    }
    return exp(-atmosphere_extinction(col,band));
}

@group(0) @binding(9) var atmosphere_multiple:texture_2d_array<f32>;
@group(0) @binding(10) var atmosphere_multipleSampler:sampler;
fn atmosphere_multipleRadiance(p:atmosphere_Point,group:u32)->vec3f {
    if atmosphere_frame.sun.w<0.5 {return vec3f(0.0);}
    let h=clamp(atmosphere_altitude(p),0.0,atmosphere_frame.originHi.w);
    let up=normalize(p.hi*atmosphere_frame.inverseHi.xyz);
    let uv=vec2f(0.5+0.5*dot(up,atmosphere_frame.sun.xyz),sqrt(h/atmosphere_frame.originHi.w));
    let dimensions=vec2f(textureDimensions(atmosphere_multiple));
    return textureSampleLevel(atmosphere_multiple,atmosphere_multipleSampler,(uv*(dimensions-vec2f(1.0))+vec2f(0.5))/dimensions,i32(group),0.0).xyz;
}
