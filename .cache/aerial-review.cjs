const {chromium}=require('C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-atmosphere/node_modules/playwright');const fs=require('node:fs');const out='C:/Users/GuillaumePelletier/Documents/GitHub/SpaceXR/.cache/aerial-review';fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu','--use-angle=d3d11','--ignore-gpu-blocklist']});try{
for(const [name,path] of [['globe','orbital.html'],['horizon','orbital.html?view=horizon']]){
 const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.addInitScript(()=>{window.gpuErrors=[];const f=GPUAdapter.prototype.requestDevice;GPUAdapter.prototype.requestDevice=async function(...args){const d=await f.apply(this,args);window.device=d;d.addEventListener('uncapturederror',e=>window.gpuErrors.push(e.error.message));return d;};});
 await page.goto('http://127.0.0.1:5189/'+path);await page.waitForFunction(()=>window.earthDemo?.earth.atmosphereReady||document.body.dataset.error==='true',{},{timeout:60000});await page.waitForTimeout(4500);await page.evaluate(()=>window.device.queue.onSubmittedWorkDone());
 await page.screenshot({path:out+'/'+name+'.png'});console.log(JSON.stringify({name,errors,state:await page.evaluate(()=>({status:document.querySelector('#status').textContent,stats:document.querySelector('#stats').textContent,gpuErrors:window.gpuErrors,errors:window.earthDemo.errors}))},null,2));await page.evaluate(()=>window.earthDemo.dispose());await page.close();
}
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
