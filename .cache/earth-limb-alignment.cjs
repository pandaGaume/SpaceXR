const {chromium}=require('C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-atmosphere/node_modules/playwright');const fs=require('node:fs');const {pathToFileURL}=require('node:url');
const out='C:/Users/GuillaumePelletier/Documents/GitHub/SpaceXR/.cache/earth-motion';
(async()=>{const {PngDataDecoder}=await import(pathToFileURL('C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/terrain-core/packages/raster/dist/index.js'));
const {intersectEllipsoid}=await import(pathToFileURL('C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-atmosphere/dist/index.js'));
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu','--use-angle=d3d11','--ignore-gpu-blocklist']});
try{const page=await browser.newPage({viewport:{width:1200,height:860}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{const raf=requestAnimationFrame;window.requestAnimationFrame=cb=>raf(t=>{if(!window.pauseEarth)cb(t);});});
await page.goto('http://127.0.0.1:5189/orbital.html');await page.waitForFunction(()=>window.earthDemo?.earth.atmosphereReady,{},{timeout:60000});
await page.evaluate(async()=>{window.pauseEarth=true;await new Promise(r=>setTimeout(r,30));});
const results=[];
for(let pose=0;pose<4;pose++){
 const frame=await page.evaluate(async(pose)=>{const earth=window.earthDemo.earth,camera=earth.camera,scene=camera.getScene(),engine=scene.getEngine();
 camera.limits.pitchDisabledRadiusScale.x=100;camera.limits.pitchDisabledRadiusScale.y=101;
 const p=earth.geodeticSystem.geodeticDegreesToEcef(25+pose*2,pose*12,0);camera.center.copyFromFloats(p.x,p.y,p.z);camera.pitch=.15+pose*.04;camera.yaw=.8+pose*.3;
 await earth.update();engine.beginFrame();scene.render(false);engine.endFrame();await engine._device.queue.onSubmittedWorkDone();
 const v=camera.getViewMatrix(true).clone().invert().m,pr=camera.getProjectionMatrix(true).m;
 return {position:[camera.globalPosition.x,camera.globalPosition.y,camera.globalPosition.z],right:[v[0],v[1],v[2]],up:[v[4],v[5],v[6]],forward:[-v[8],-v[9],-v[10]],halfWidth:1/pr[0],halfHeight:1/pr[5],axes:{semiMajorAxis:earth.body.ellipsoid.semiMajorAxis,semiMinorAxis:earth.body.ellipsoid.semiMinorAxis}};
 },pose);
 const bytes=await page.screenshot({path:out+`/limb-${pose}.png`});const image=await new PngDataDecoder().decode(new Uint8Array(bytes));
 let checked=0,leaks=0,max=0,maxEquivalentHeight=0;const samples=[];
 for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++){
  if(x<330&&y<700)continue;
  const u=(2*(x+.5)/image.width-1)*frame.halfWidth,v=(1-2*(y+.5)/image.height)*frame.halfHeight;
  const d=frame.forward.map((f,i)=>f+u*frame.right[i]+v*frame.up[i]);const length=Math.hypot(...d);for(let i=0;i<3;i++)d[i]/=length;
  // The 768px sky is bilinearly enlarged to 1200px. Allow two source texels around its physical boundary.
  const hit=intersectEllipsoid(frame.axes,frame.position,d,1+150000/frame.axes.semiMinorAxis);if(hit&&hit[1]>0)continue;
  checked++;const index=(y*image.width+x)*4,b=Math.max(image.data[index],image.data[index+1],image.data[index+2]);max=Math.max(max,b);if(b>4){leaks++;const axes=[frame.axes.semiMajorAxis,frame.axes.semiMajorAxis,frame.axes.semiMinorAxis],q=frame.position.map((v,i)=>v/axes[i]),v=d.map((v,i)=>v/axes[i]),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),t=-dot(q,v)/dot(v,v),alt=(Math.hypot(...q.map((a,i)=>a+t*v[i]))-1)*frame.axes.semiMinorAxis;maxEquivalentHeight=Math.max(maxEquivalentHeight,alt);if(samples.length<3)samples.push({x,y,b,alt});}
 }
 const towardsCenter=frame.position.map(v=>-v);const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
 const projectedCenterY=(1-dot(towardsCenter,frame.up)/dot(towardsCenter,frame.forward)/frame.halfHeight)*image.height/2;
 results.push({pose,projectedCenterY,checked,leaks,max,maxEquivalentHeight,samples});
}
console.log(JSON.stringify({results,errors},null,2));fs.writeFileSync(out+'/limb-alignment.json',JSON.stringify({results,errors},null,2));if(results.some(r=>r.leaks>30)||errors.length)throw Error('Atmospheric image extends beyond the physical envelope');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
