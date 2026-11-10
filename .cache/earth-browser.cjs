const {chromium}=require('C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-atmosphere/node_modules/playwright');
const fs=require('node:fs');
const out='C:/Users/GuillaumePelletier/Documents/GitHub/SpaceXR/.cache/earth-validation';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu','--use-angle=d3d11','--ignore-gpu-blocklist','--disable-background-timer-throttling']});
 const page=await browser.newPage({viewport:{width:1200,height:860}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 try {
  await page.goto('http://127.0.0.1:5189/');
  await page.waitForFunction(()=>window.earthDemo?.earth.atmosphereReady || document.body.dataset.error==='true',{},{timeout:60000});
  await page.waitForTimeout(1500);
  console.log(JSON.stringify(await page.evaluate(()=>({status:document.querySelector('#status').textContent,stats:document.querySelector('#stats').textContent,frames:window.earthDemo?.frames,errors:window.earthDemo?.errors})),null,2));
  await page.screenshot({path:out+'/orbit.png'});
  fs.writeFileSync(out+'/errors.json',JSON.stringify(errors,null,2));
  if(errors.length) throw Error(errors.slice(0,4).join('\n'));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
