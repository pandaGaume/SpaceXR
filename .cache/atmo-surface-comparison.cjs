const {chromium}=require('C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-atmosphere/node_modules/playwright');
const fs=require('node:fs');const out='C:/Users/GuillaumePelletier/Documents/GitHub/SpaceXR/.cache/aerial-review';
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu','--use-angle=d3d11','--ignore-gpu-blocklist']});try{
const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.goto('http://127.0.0.1:5189/orbital.html?view=horizon');await page.waitForFunction(()=>window.earthDemo?.earth.atmosphereReady,{},{timeout:60000});await page.waitForTimeout(5000);
await page.screenshot({path:out+'/surface-with-atmosphere.png'});await page.evaluate(()=>window.earthDemo.earth.setAtmosphereEnabled(false));await page.waitForTimeout(400);await page.screenshot({path:out+'/surface-without-atmosphere.png'});
const state=await page.evaluate(()=>({errors:window.earthDemo.errors,status:document.querySelector('#status').textContent}));console.log(JSON.stringify({errors,state},null,2));await page.evaluate(()=>window.earthDemo.dispose());
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
