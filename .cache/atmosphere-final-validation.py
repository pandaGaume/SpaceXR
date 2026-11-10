from pathlib import Path
root=Path(r'C:\Users\GuillaumePelletier\Documents\GitHub\Gaume\spacexr-atmosphere')
p=root/'tests/browser/validate.js';s=p.read_text()
s=s.replace("const report={adapter:{vendor:adapter.info?.vendor,architecture:adapter.info?.architecture},budget,cases,failures};", "const report={adapter:{vendor:adapter.info?.vendor,architecture:adapter.info?.architecture},deviceLimits:{maxTextureDimension2D:device.limits.maxTextureDimension2D,maxTextureDimension3D:device.limits.maxTextureDimension3D,maxStorageBufferBindingSize:device.limits.maxStorageBufferBindingSize},quality:{width:64,hemisphereRows:64,viewSteps:256,solarSteps:192,solarSize:[64,32,32],radianceFormat:'rgba16float',solarFormat:'rgba32float'},budget,cases,failures};")
s=s.replace('''while(steps<4096){steps*=2;solarSteps*=2;current=cpu.integrateSpectral(scene,origin,d,{steps,solarSteps});residual=Math.max(...current.radiance.map((v,c)=>Math.abs(v-previous.radiance[c])));if(residual<=budget.referenceConvergence)return {value:current.radiance,residual,steps,solarSteps};previous=current;}''','''while(steps<4096){
  const viewOnly=cpu.integrateSpectral(scene,origin,d,{steps:steps*2,solarSteps}),solarOnly=cpu.integrateSpectral(scene,origin,d,{steps,solarSteps:solarSteps*2});
  steps*=2;solarSteps*=2;current=cpu.integrateSpectral(scene,origin,d,{steps,solarSteps});
  const viewResidual=Math.max(...current.radiance.map((v,c)=>Math.abs(v-solarOnly.radiance[c]))),solarResidual=Math.max(...current.radiance.map((v,c)=>Math.abs(v-viewOnly.radiance[c])));
  residual=Math.max(viewResidual,solarResidual,...current.radiance.map((v,c)=>Math.abs(v-previous.radiance[c])));
  if(residual<=budget.referenceConvergence)return {value:current.radiance,residual,viewResidual,solarResidual,steps,solarSteps};previous=current;
 }''')
s=s.replace('''     item.rays.push({direction:dirs[i],reference:ref.value,gpu,pointError,error,otherError,relative,convergence:ref.residual,steps:ref.steps,solarSteps:ref.solarSteps});''','''     const ground=cpu.intersectEllipsoid(scene.model.ellipsoid,origin,dirs[i]),gpuStart=values[i*12+8]*1000,gpuEnd=values[i*12+9]*1000;
     let intersectionError=0;
     if(i!==4){
       const expected=!!ground&&ground[0]>=-1e-6&&ground[1]>=0,actual=gpuStart>=-0.001&&gpuEnd>=0;
       if(expected!==actual)failures.push(`${scenario.name} ${height} ray ${i}: ground classification`);
       if(expected&&actual){intersectionError=Math.abs(ground[0]-gpuStart);if(intersectionError>budget.intersectionMeters)failures.push(`${scenario.name} ${height} ray ${i}: intersection ${intersectionError} m`);}
     }
     item.rays.push({direction:dirs[i],reference:ref.value,gpu,pointError,error,otherError,relative,intersectionError,convergence:ref.residual,viewResidual:ref.viewResidual,solarResidual:ref.solarResidual,steps:ref.steps,solarSteps:ref.solarSteps});''')
s=s.replace('if(solarError>budget.transmittanceAbsolute','if(!Number.isFinite(solarError)||values.slice(4,7).some(v=>!Number.isFinite(v)||v<0||v>1)||solarError>budget.transmittanceAbsolute')
s=s.replace('if(item.altitudeError>','if(!Number.isFinite(item.altitudeError)||item.altitudeError>')
s=s.replace(' await device.queue.onSubmittedWorkDone();return report;',''' await device.queue.onSubmittedWorkDone();
 const lossCheck=await AtmosphereSky.create(device,base.model,{width:8,hemisphereRows:4,viewSteps:8,solarSteps:8});device.destroy();await device.lost;
 try{lossCheck.update(camera([6378138,0,0]));failures.push('Live renderer accepted update after device loss');}catch(error){if(!String(error).includes('lost'))failures.push(String(error));}finally{lossCheck.dispose();}
 report.summary={views:cases.length*2,rays:cases.reduce((n,c)=>n+c.rays.length*2,0),maxRadianceError:Math.max(...cases.flatMap(c=>c.rays.flatMap(r=>[r.error,r.otherError]))),maxSolarError:Math.max(...cases.map(c=>c.solarError)),maxAltitudeErrorMeters:Math.max(...cases.map(c=>c.altitudeError)),maxIntersectionErrorMeters:Math.max(...cases.flatMap(c=>c.rays.map(r=>r.intersectionError)))};
 return report;''')
p.write_text(s,encoding='utf8')
