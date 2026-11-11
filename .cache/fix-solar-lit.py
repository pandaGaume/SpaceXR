from pathlib import Path
r=Path('C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-atmosphere')
p=r/'webgpu/index.ts';s=p.read_text();s=s.replace('-Math.cos(0.1)','-1.0').replace('Math.cos(0.1)','1.0');s=s.replace('const t = (2 * x) / (solarSize[0] - 1) - 1,\n                            longitude = (t < 0 ? center * (1 - t * t) : center + (Math.PI - center) * t * t) + sunLongitude;','''// Shadowed rays are rejected analytically by readers. Spend all columns on lit rays,
                        // approaching the height-dependent tangent from its illuminated side.
                        const t = 1 - x / (solarSize[0] - 1),
                            longitude = Math.max(0, center - 1e-7) * (1 - t * t) + sunLongitude;''');p.write_text(s)
p=r/'webgpu/shaders/transport.wgsl';s=p.read_text().replace('-cos(0.1),cos(0.1)','-1.0,1.0');s=s.replace('let u=select(0.5+0.5*sqrt(max(0.0,(angle-center)/(atmosphere_PI-center))),0.5*(1.0-sqrt(max(0.0,(center-angle)/center))),angle<center);','''let u=1.0-sqrt(clamp(1.0-angle/max(1e-8,center-1e-7),0.0,1.0));''');p.write_text(s)
