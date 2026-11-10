const {chromium}=require('C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-atmosphere/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu','--use-angle=d3d11','--ignore-gpu-blocklist']});
 const page=await browser.newPage({viewport:{width:1200,height:860}});
 page.on('pageerror',e=>console.log('PAGE ERROR '+e.message));
 try{await page.goto('http://127.0.0.1:5189/atmosphere.html');
 await page.waitForFunction(()=>window.earthDemo?.earth.atmosphereReady,{},{timeout:60000});
 for(let i=0;i<6;i++){
  await page.waitForTimeout(5000);
  console.log(JSON.stringify(await page.evaluate(()=>{const e=window.earthDemo.earth;return {snapshot:e.runtime.instrumentation.snapshot(),grids:[...e.terrain.grids.handles].filter(h=>h.presented).map(h=>({lod:h.identity.lod,height:h.elevated?.unscaledHeights?.[0]})),errors:window.earthDemo.errors};})));
 }
 await page.screenshot({path:'C:/Users/GuillaumePelletier/Documents/GitHub/SpaceXR/.cache/earth-validation/atmosphere-settled.png'});
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
