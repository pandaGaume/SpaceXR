const {chromium}=require('C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-atmosphere/node_modules/playwright');
const fs=require('node:fs');
const out='C:/Users/GuillaumePelletier/Documents/GitHub/SpaceXR/.cache/earth-validation';
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu','--use-angle=d3d11','--ignore-gpu-blocklist','--disable-background-timer-throttling']});
 const results=[];
 try{
  for(const entry of ['orbital','atmosphere']){
   const page=await browser.newPage({viewport:{width:1200,height:860}});const errors=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
   await page.addInitScript(()=>{
    window.gpuErrors=[];
    const original=GPUAdapter.prototype.requestDevice;
    GPUAdapter.prototype.requestDevice=async function(...args){const device=await original.apply(this,args);window.testDevice=device;device.addEventListener('uncapturederror',event=>window.gpuErrors.push(event.error.message));return device;};
   });
   await page.goto(`http://127.0.0.1:5189/${entry}.html`);
   await page.waitForFunction(()=>window.earthDemo?.earth.atmosphereReady || document.body.dataset.error==='true',{},{timeout:60000});
   await page.waitForFunction(()=>window.earthDemo?.earth.terrain.getStatistics().presented>4 || document.body.dataset.error==='true',{},{timeout:60000});
   await page.waitForTimeout(1200);
   if(entry==='atmosphere') await page.waitForFunction(()=>window.earthDemo?.earth.runtime.instrumentation.snapshot().pendingLoads===0 || document.body.dataset.error==='true',{},{timeout:60000});
   const state=await page.evaluate(async()=>{await window.testDevice?.queue.onSubmittedWorkDone();const demo=window.earthDemo;const earth=demo?.earth;return {
    title:document.title,status:document.querySelector('#status').textContent,frames:demo?.frames,errors:demo?.errors,
    gpuErrors:window.gpuErrors,height:earth?.geodeticSystem.ecefToGeodeticRadians(earth.camera.globalPosition).height,
    tiles:earth?.terrain.getStatistics().presented,atmosphereReady:earth?.atmosphereReady,
   };});
   await page.screenshot({path:out+`/${entry}.png`});
   results.push({entry,...state,consoleErrors:errors});
   if(!state.atmosphereReady||errors.length||state.errors?.length||state.gpuErrors.length)throw Error(JSON.stringify(results));
   if(entry==='orbital'&&!(state.height>100000))throw Error('Orbit camera is inside atmosphere');
   if(entry==='atmosphere'&&!(state.height>0&&state.height<100000))throw Error('Atmospheric camera is outside atmosphere');
   await page.evaluate(()=>window.earthDemo.dispose());await page.close();
  }
  fs.writeFileSync(out+'/two-pages.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
