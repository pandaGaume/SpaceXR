const {chromium}=require('C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-atmosphere/node_modules/playwright');const fs=require('node:fs');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu','--use-angle=d3d11','--ignore-gpu-blocklist']});
try{const page=await browser.newPage({viewport:{width:1200,height:860}});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.goto('http://127.0.0.1:5191/atmosphere.html?sunset=1&dem=0');await page.waitForFunction(()=>window.earthDemo?.earth.atmosphereReady||document.body.dataset.error==='true',{},{timeout:60000});await page.waitForTimeout(5000);
await page.screenshot({path:'C:/Users/GuillaumePelletier/Documents/GitHub/SpaceXR/.cache/earth-motion/sunset.png'});console.log(JSON.stringify({errors,state:await page.evaluate(()=>({status:document.querySelector('#status').textContent,time:document.querySelector('#time').value,frames:window.earthDemo?.frames,errors:window.earthDemo?.errors}))},null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
