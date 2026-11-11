const {chromium}=require('C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-atmosphere/node_modules/playwright');
const fs=require('node:fs');const out='C:/Users/GuillaumePelletier/Documents/GitHub/SpaceXR/.cache/atmo-day';fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu','--use-angle=d3d11','--ignore-gpu-blocklist']});try{
const page=await browser.newPage({viewport:{width:1480,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.goto('http://127.0.0.1:5189/atmosphere.html?sse=20');await page.waitForFunction(()=>window.earthDemo?.earth.atmosphereReady,{},{timeout:60000});await page.waitForTimeout(6000);
for(const hour of [10,12]){await page.evaluate(async(hour)=>{await window.earthDemo.earth.setDate(new Date(Date.UTC(2026,5,21,hour)));document.querySelector('#time').value=hour+':00';},hour);await page.waitForTimeout(4000);await page.screenshot({path:out+'/day-'+hour+'.png'});}
console.log(JSON.stringify({errors,state:await page.evaluate(()=>({stats:document.querySelector('#stats').textContent,errors:window.earthDemo.errors,position:window.earthDemo.earth.camera.globalPosition,keys:Object.keys(window.earthDemo.earth)}))},null,2));await page.evaluate(()=>window.earthDemo.dispose());
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
