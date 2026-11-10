from pathlib import Path
root=Path(r'C:\Users\GuillaumePelletier\Documents\GitHub\Gaume\spacexr-atmosphere')
p=root/'examples/atmosphere-lab/src/public-sky.js';s=p.read_text()
s=s.replace('cameraInput(){return {','''cameraInput(){const c=this.camera,r=c.right,u=c.up,f=c.forward,cross=[r[1]*u[2]-r[2]*u[1],r[2]*u[0]-r[0]*u[2],r[0]*u[1]-r[1]*u[0]],right=cross.reduce((sum,v,i)=>sum+v*f[i],0)>0?r.map(v=>-v):r;return {''').replace('rightEcef:this.camera.right','rightEcef:right')
old=(root/'examples/atmosphere-lab/src/sky-view.gpu.js').read_text();start=old.index('    async capturePng()');end=old.index('    dispose()',start)
capture=old[start:end].replace('this.pipelines.format','this.format')
start=s.index(' async capturePng()');end=s.index(' dispose()',start)
s=s[:start]+''' encodeDisplay(encoder){if(!this.sky.encode(encoder))throw new Error('Complete sky construction before capture');this.display.encode(encoder,this.context.getCurrentTexture().createView(),this.cameraInput(),this.exposure);}
'''+capture+s[end:]
s=s.replace('this.sky?.dispose();}','this.sky?.dispose();this.context.unconfigure();}')
p.write_text(s,encoding='utf8')
p=root/'examples/atmosphere-lab/demo.js';s=p.read_text().replace("$('reporthd').disabled = busy || !hdState?.renderer;","$('reporthd').disabled = busy || !hdState?.renderer;\n    $('hdSun').disabled=busy||$('transport').value==='spectral';")
s=s.replace('Soleil calcule par pixel. Globe uni, sans nuages.',"${s.spectral ? 'Radiance atmospherique seule, sans disque solaire ni couleur de sol.' : 'Soleil calcule par pixel. Globe uni, sans nuages.'}")
p.write_text(s,encoding='utf8')
p=root/'scripts/test-webgpu.mjs';s=p.read_text().replace("import { execFileSync }", "import { execFileSync,spawn }")
s=s.replace('let browser;','let browser,labProcess;')
needle=" if(errors.length)throw new Error(errors.join('\\n'));\n} finally"
block=''' const labAddress=await new Promise((resolveAddress,reject)=>{
  labProcess=spawn(process.execPath,[resolve(root,'examples/atmosphere-lab/serve.js')],{cwd:root,env:{...process.env,PORT:'0'},windowsHide:true});
  labProcess.once('error',reject);labProcess.once('exit',code=>reject(new Error('Laboratory exited '+code)));
  labProcess.stdout.on('data',chunk=>{const match=String(chunk).match(/http:\\/\\/127\\.0\\.0\\.1:\\d+/);if(match)resolveAddress(match[0]);});
 });
 await page.goto(labAddress);await page.selectOption('#transport','spectral');await page.selectOption('#hdDefinition','1280');await page.selectOption('#skyLutQuality','128');await page.uncheck('#hdFrameSun');await page.click('#renderhd');
 await page.waitForFunction(()=>window.atmosphereHDResult||/Error|error/.test(document.querySelector('#hdStatus').textContent),null,{timeout:120000});
 const labReport=await page.evaluate(()=>window.atmosphereHDResult);if(!labReport)throw new Error(await page.locator('#hdStatus').textContent());
 if(labReport.skyView.implementation!=='@spacexr/atmosphere/webgpu')throw new Error('Laboratory bypassed public renderer');
 await writeFile(resolve(root,'.cache/lab-public-validation.json'),JSON.stringify(labReport,null,2));
 await page.click('#savehd');await page.waitForTimeout(200);
 if(errors.length)throw new Error(errors.join('\\n'));
} finally'''
if needle not in s:raise Exception('runner tail missing')
s=s.replace(needle,block).replace('await browser?.close();await new Promise','labProcess?.kill();await browser?.close();await new Promise')
p.write_text(s,encoding='utf8')
