from pathlib import Path
root=Path('C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-atmosphere')
p=root/'webgpu/index.ts'
s=p.read_text()
a=s.index('                        const center = Math.acos(')
b=s.index('                        const t =',a)
s=s[:a]+'''                        const height = this.model.top * (z / (solarSize[2] - 1)) ** 2;
                        const meridian = geodeticPosition(this.model.ellipsoid, latitude, 0, height);
                        const axes = [this.model.ellipsoid.semiMajorAxis, this.model.ellipsoid.semiMajorAxis, this.model.ellipsoid.semiMinorAxis];
                        const q = meridian.map((v, i) => v / axes[i]);
                        const v = this.model.sun.map((value, i) => value / axes[i]);
                        // Concentrate columns at the actual solar tangent at this height.
                        const tangent = -Math.sqrt(v.reduce((sum, value) => sum + value * value, 0) * Math.max(0, q.reduce((sum, value) => sum + value * value, 0) - 1));
                        const center = Math.acos(Math.max(-Math.cos(0.1), Math.min(Math.cos(0.1),
                            (tangent - q[2] * v[2]) / Math.max(1e-20, Math.hypot(q[0], q[1]) * Math.hypot(v[0], v[1])))));
'''+s[b:]
s=s.replace('const declination = this.model.sun[2],\n                sunLongitude = Math.atan2(this.model.sun[1], this.model.sun[0]);','const sunLongitude = Math.atan2(this.model.sun[1], this.model.sun[0]);')
p.write_text(s)
p=root/'webgpu/shaders/transport.wgsl';s=p.read_text();a=s.index('fn atmosphere_terminator(');b=s.index('fn atmosphere_solar(',a)
s=s[:a]+'''fn atmosphere_terminator(p:atmosphere_Point)->f32 {
    let v=atmosphere_frame.sun.xyz*atmosphere_frame.inverseHi.xyz;
    let residual=atmosphere_add(atmosphere_pointDot(p,p),atmosphere_Pair(-1.0,0.0));
    let tangent=-sqrt(dot(v,v)*max(0.0,residual.hi+residual.lo));
    let denominator=max(1e-15,length(p.hi.xy)*length(v.xy));
    return acos(clamp((tangent-p.hi.z*v.z)/denominator,-cos(0.1),cos(0.1)));
}
'''+s[b:];s=s.replace('atmosphere_terminator(latitude)','atmosphere_terminator(p)');p.write_text(s)
