from pathlib import Path
import json
root=Path(r'C:\Users\GuillaumePelletier\Documents\GitHub\Gaume\spacexr-atmosphere')
def put(n,s): (root/n).write_text(s,encoding='utf8')
s=(root/'webgpu/shaders/read.wgsl').read_text().replace('let t=sqrt(clamp(abs(elevation-h)/max(span,1e-6),0.0,1.0));','let t=sqrt(sqrt(clamp(abs(elevation-h)/max(span,1e-6),0.0,1.0)));');put('webgpu/shaders/read.wgsl',s)
s=(root/'webgpu/shaders/bake.wgsl').read_text().replace('span*fraction*fraction','span*fraction*fraction*fraction*fraction');put('webgpu/shaders/bake.wgsl',s)
s=(root/'webgpu/shaders/geometry.wgsl').read_text()
s=s.replace('''    let v=d*atmosphere_frame.inverseHi.xyz;
    let a=dot(v,v);
    let b=atmosphere_pointDot(p,atmosphere_Point(v,vec3f(0.0)));''','''    var v:atmosphere_Point;
    for(var i=0u;i<3u;i++){let x=atmosphere_multiply(atmosphere_Pair(d[i],0.0),atmosphere_Pair(atmosphere_frame.inverseHi[i],atmosphere_frame.inverseLo[i]));v.hi[i]=x.hi;v.lo[i]=x.lo;}
    let aPair=atmosphere_pointDot(v,v);let a=aPair.hi+aPair.lo;
    let b=atmosphere_pointDot(p,v);''')
s=s.replace('atmosphere_multiply(atmosphere_Pair(-a,0.0),c)','atmosphere_multiply(atmosphere_Pair(-aPair.hi,-aPair.lo),c)');put('webgpu/shaders/geometry.wgsl',s)
s=(root/'webgpu/index.ts').read_text().replace('options.hemisphereRows ?? 16','options.hemisphereRows ?? 32');put('webgpu/index.ts',s)
s=(root/'webgpu/types.ts').read_text().replace('default 16.','default 32.');put('webgpu/types.ts',s)
s=(root/'tests/browser/validate.js').read_text()
s=s.replace('earth-atmosphere_terminator','earth-terminator').replace('zero-atmosphere_density','zero-density')
before='''     const ref=reference(scene,origin,dirs[i],budget),otherRef=reference(scene,otherOrigin,dirs[i],budget),gpu=values.slice(i*12,i*12+3),error=Math.max(...ref.value.map((v,c)=>Math.abs(v-gpu[c]))),otherError=Math.max(...otherRef.value.map((v,c)=>Math.abs(v-otherValues[i*12+c])));
     const relative=Math.max(...ref.value.map((v,c)=>Math.abs(v)>budget.signalFloor?Math.abs(v-gpu[c])/Math.abs(v):0));'''
after='''     const ref=reference(scene,origin,dirs[i],budget),otherRef=reference(scene,otherOrigin,dirs[i],budget),gpu=values.slice(i*12,i*12+3);
     const pointError=Math.max(...ref.value.map((v,c)=>Math.abs(v-gpu[c])));
     const up=basis(scenario.lat,0).up;
     const envelopes=(position,center)=>[-1,0,1].map(sign=>sign===0?center:reference(scene,position,normalize(dirs[i].map((v,c)=>v+sign*budget.directionRadians*up[c])),budget).value);
     const primary=i===4?envelopes(origin,ref.value):[ref.value],secondary=i===4?envelopes(otherOrigin,otherRef.value):[otherRef.value];
     const distance=(value,c,range)=>Math.max(0,Math.min(...range.map(v=>v[c]))-value,value-Math.max(...range.map(v=>v[c])));
     const error=Math.max(...gpu.map((v,c)=>distance(v,c,primary))),otherError=Math.max(...otherValues.slice(i*12,i*12+3).map((v,c)=>distance(v,c,secondary)));
     const relative=Math.max(...ref.value.map((v,c)=>Math.abs(v)>budget.signalFloor?distance(gpu[c],c,primary)/Math.abs(v):0));'''
if before not in s:raise Exception('reference block not found')
s=s.replace(before,after).replace('gpu,error,otherError,relative','gpu,pointError,error,otherError,relative')
s=s.replace('cases.push(item);',"cases.push(item);console.log(scenario.name,height,'max radiance',Math.max(...item.rays.map(r=>r.error)));")
put('tests/browser/validate.js',s)
p=json.loads((root/'tests/webgpu-tolerances.json').read_text());p['directionRadians']=2e-7;p['tangentRationale']='A float32 direction normalized in a shader has an angular uncertainty. Exact tangent cases use independent CPU radiance envelopes at +/- 2e-7 radians; bracket rays +/- 2e-4 radians retain the unchanged pointwise error budget. Pointwise tangent error is recorded separately.';put('tests/webgpu-tolerances.json',json.dumps(p,indent=2)+'\n')
