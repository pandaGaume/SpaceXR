const {chromium}=require('C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-atmosphere/node_modules/playwright');
const fs=require('node:fs');
const out='C:/Users/GuillaumePelletier/Documents/GitHub/SpaceXR/.cache/earth-validation';
async function ready(page){await page.waitForFunction(()=>window.earthDemo?.earth.atmosphereReady || document.body.dataset.error==='true',{},{timeout:60000});await page.waitForTimeout(500);}
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu','--use-angle=d3d11','--ignore-gpu-blocklist','--disable-background-timer-throttling']});
 const page=await browser.newPage({viewport:{width:1200,height:860}});const errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 try {
  await page.goto('http://127.0.0.1:5189/');await ready(page);
  await page.screenshot({path:out+'/orbit.png'});
  await page.locator('#atmosphere').uncheck();await page.waitForTimeout(200);await page.screenshot({path:out+'/without-atmosphere.png'});await page.locator('#atmosphere').check();
  await page.evaluate(()=>window.earthDemo.earth.setDate(new Date('2026-06-21T18:00:00Z')));await ready(page);await page.screenshot({path:out+'/sunset.png'});
  await page.mouse.move(1000,440);await page.mouse.down();await page.mouse.move(930,480,{steps:6});await page.mouse.up();await page.waitForTimeout(1500);await ready(page);
  await page.setViewportSize({width:1000,height:700});await page.waitForTimeout(400);await page.screenshot({path:out+'/resized.png'});
  const disposed=await page.evaluate(async()=>{const scene=window.earthDemo.earth.camera.getScene();await window.earthDemo.earth.dispose();const result={scenePreserved:!scene.isDisposed,meshes:scene.meshes.length,cameras:scene.cameras.length,lights:scene.lights.length};await window.earthDemo.dispose();return result;});
  if(disposed.meshes||disposed.cameras||disposed.lights)throw Error('Residual scene resources: '+JSON.stringify(disposed));
  await page.setViewportSize({width:1200,height:860});await page.goto('http://127.0.0.1:5189/?view=terrain&dem=1');await ready(page);
  await page.waitForFunction(()=>window.earthDemo?.earth.terrain.getStatistics().presented>4 || document.body.dataset.error==='true',{},{timeout:60000});
  await page.waitForTimeout(4000);await page.screenshot({path:out+'/terrain.png'});
  const terrain=await page.evaluate(()=>({status:document.querySelector('#status').textContent,stats:document.querySelector('#stats').textContent,errors:window.earthDemo?.errors}));
  await page.evaluate(()=>window.earthDemo?.dispose());
  const webgl=await browser.newPage({viewport:{width:1000,height:700}});
  webgl.on('pageerror',e=>errors.push(e.message));webgl.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await webgl.goto('http://127.0.0.1:5189/?renderer=webgl&atmosphere=0');
  await webgl.waitForFunction(()=>window.earthDemo?.frames>20 || document.body.dataset.error==='true',{},{timeout:60000});
  await webgl.screenshot({path:out+'/webgl.png'});
  const gl=await webgl.evaluate(()=>({status:document.querySelector('#status').textContent,stats:document.querySelector('#stats').textContent,errors:window.earthDemo?.errors}));
  await webgl.evaluate(()=>window.earthDemo?.dispose());
  fs.writeFileSync(out+'/interaction-results.json',JSON.stringify({errors,terrain,webgl:gl,disposed},null,2));
  console.log(JSON.stringify({errors,terrain,webgl:gl,disposed},null,2));
  if(errors.length||terrain.errors?.length||gl.errors?.length)throw Error('Browser validation failed');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
