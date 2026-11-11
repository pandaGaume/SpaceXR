from pathlib import Path
a=Path('C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-atmosphere')
r=Path('C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-rendering')
p=a/'webgpu/shaders/aerial.wgsl';s=p.read_text(encoding='utf-8').replace('    let interval=atmosphere_interval(atmosphere_cameraPoint(),direction);','''    let interval=atmosphere_interval(atmosphere_cameraPoint(),direction);
    // A continuous depth axis across the ground tangent. Ground intersections stop transport,
    // but must not rescale neighbouring rays' froxel coordinates.
    let outer=atmosphere_intersect(atmosphere_cameraPoint(),direction,atmosphere_frame.inverseHi.w);
    let span=vec2f(max(0.0,outer.x),outer.y);''')
s=s.replace('let start=mix(interval.x,interval.y,f32(z-1u)/f32(aerialCamera.size.z-1u));','let start=max(interval.x,mix(span.x,span.y,pow(f32(z-1u)/f32(aerialCamera.size.z-1u),2.0)));').replace('let end=mix(interval.x,interval.y,f32(z)/f32(aerialCamera.size.z-1u));','let end=min(interval.y,mix(span.x,span.y,pow(f32(z)/f32(aerialCamera.size.z-1u),2.0)));')
p.write_text(s,encoding='utf-8')
p=r/'packages/babylon-earth/src/atmosphere/composite.wgsl';s=p.read_text(encoding='utf-8').replace('            let fraction=clamp((distance-interval.x)/(interval.y-interval.x),0.0,1.0);','''            let outer=atmosphere_intersect(atmosphere_cameraPoint(),direction,atmosphere_frame.inverseHi.w);
            let spanStart=max(0.0,outer.x);
            let fraction=sqrt(clamp((distance-spanStart)/(outer.y-spanStart),0.0,1.0));''').replace('let endpoint=smoothstep(0.9,1.0,fraction);','let endpoint=smoothstep(0.9,1.0,clamp((distance-interval.x)/(interval.y-interval.x),0.0,1.0));')
p.write_text(s,encoding='utf-8')
p=a/'tests/browser/aerial.js';s=p.read_text(encoding='utf-8').replace('(interval.end-interval.start)*z/16','(interval.end-interval.start)*(z/16)**2').replace('fraction:z/16,','fraction:(z/16)**2,');p.write_text(s,encoding='utf-8')
p=a/'docs/WEBGPU-INTEGRATION.md';s=p.read_text(encoding='utf-8').replace('z endpoints represent evenly spaced fractions of each ray\'s actual atmospheric interval, including zero distance.', 'z endpoints represent quadratic distance fractions of each ray\'s outer-atmosphere interval, including zero distance. The outer interval is not shortened at the ground tangent; ground intersections stop transport without changing depth coordinates.').replace('map it to `clamp((distance - intervalStart) / (intervalEnd - intervalStart), 0, 1)`','map it to `sqrt(clamp((distance - outerStart) / (outerEnd - outerStart), 0, 1))`');p.write_text(s,encoding='utf-8')
