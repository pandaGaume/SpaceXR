from pathlib import Path
import shutil
root=Path('C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-rendering');stage=Path(__file__).parent/'aerial-stage/rendering'
for source in stage.rglob('*'):
    if source.is_file():dest=root/source.relative_to(stage);dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source,dest)
f=root/'packages/babylon-earth/scripts/build-shader.mjs';f.write_text('''import {readFileSync,writeFileSync,mkdirSync} from "node:fs";
import {format} from "prettier";
const target=new URL("../src/atmosphere/generated/",import.meta.url);mkdirSync(target,{recursive:true});
for(const name of ["display","composite","present"]){
 const source=new URL(`../src/atmosphere/${name}.wgsl`,import.meta.url);
 const code=`// Generated from ${name}.wgsl. Run npm run shaders.\\nexport const ${name}Shader = `+JSON.stringify(readFileSync(source,"utf8"))+";\\n";
 writeFileSync(new URL(`${name}.ts`,target),await format(code,{parser:"typescript",tabWidth:4,printWidth:140}));
}
''',encoding='utf-8',newline='\n')
f=root/'packages/babylon-earth/src/atmosphere/babylon-sky.ts';s=f.read_text(encoding='utf-8');s='import { BabylonAtmosphereCompositor } from "./scene-compositor";\nimport type { AtmosphereAerialVolume, IAtmosphereAerialOptions } from "@spacexr/atmosphere/webgpu";\n'+s
s=s.replace('export interface IEarthAtmosphereOptions {','''export interface IEarthAtmosphereOptions {
    /** Compose finite-distance transport over actual scene depth. Default true. False is the diagnostic sky-only path. */
    aerialPerspective?: boolean;
    /** Bounded finite-distance spectral volume quality. */
    aerialQuality?: IAtmosphereAerialOptions;''')
s=s.replace('    private readonly layer: Layer;','''    private readonly layer: Layer;
    private compositor: BabylonAtmosphereCompositor | undefined;
    private motionAerial: AtmosphereAerialVolume | undefined;
    private settledAerial: AtmosphereAerialVolume | undefined;''')
s=s.replace('            width: 16,\n            hemisphereRows: 8,\n            viewSteps: 16,','            width: 32,\n            hemisphereRows: 16,\n            viewSteps: 24,')
s=s.replace('        let settled: AtmosphereSky | undefined;','''        let settled: AtmosphereSky | undefined;
        let motionAerial: AtmosphereAerialVolume | undefined;
        let settledAerial: AtmosphereAerialVolume | undefined;
        let bridge: BabylonEarthSky | undefined;''')
s=s.replace('            return new BabylonEarthSky(scene, engine, device, motion, settled, model, options);','''            if (options.aerialPerspective !== false) {
                motionAerial=await motion.createAerialVolume(options.aerialQuality);
                settledAerial=await settled.createAerialVolume({depth:24,segmentSteps:3,...options.aerialQuality});
            }
            bridge=new BabylonEarthSky(scene, engine, device, motion, settled, model, options);
            bridge.motionAerial=motionAerial;bridge.settledAerial=settledAerial;
            if(options.aerialPerspective!==false)bridge.compositor=new BabylonAtmosphereCompositor(scene,engine,model,bridge.solarAngularRadius,options.exposure??12);
            return bridge;''')
s=s.replace('            motion.dispose();','            bridge?.dispose();\n            motionAerial?.dispose();settledAerial?.dispose();\n            motion.dispose();')
s=s.replace('this.layer.isEnabled = value && this.ready;','this.layer.isEnabled = !this.compositor && value && this.ready;\n        this.compositor?.setEnabled(value);')
s=s.replace('        this.exposure = value;','        this.exposure = value;\n        this.compositor?.setExposure(value);')
s=s.replace('        // Do not let asynchronous GPU submissions','        this.compositor?.prepareCamera(camera);\n        // Do not let asynchronous GPU submissions')
s=s.replace('''        if (active) {
            if (!this.pipeline''','''        if (active && this.compositor) {
            const volume=active===this.motionSky ? this.motionAerial! : this.settledAerial!;
            volume.encode(encoder,current);
            this.compositor.setFrame(active,volume,current);
            this.layer.isEnabled=false;this.ready=true;
        }
        if (active && !this.compositor) {
            if (!this.pipeline''')
s=s.replace('        this.motionSky.dispose();','        this.compositor?.dispose();\n        this.motionAerial?.dispose();this.settledAerial?.dispose();\n        this.motionSky.dispose();')
f.write_text(s,encoding='utf-8',newline='\n')
f=root/'packages/core/src/terrain/terrain-engine.ts';s=f.read_text(encoding='utf-8').replace('    wireframe: boolean;','''    wireframe: boolean;
    /** Emit linear, unclamped GPU color for a host HDR composition pipeline. Default false. */
    linearColorOutput?: boolean;''');f.write_text(s,encoding='utf-8',newline='\n')
f=root/'packages/core/src/terrain/gpu/gpu-terrain-engine.ts';s=f.read_text(encoding='utf-8').replace('                defines: [','                defines: [\n                    ...(inputs.linearColorOutput ? ["#define SCENE_LINEAR_COLOR"] : []),');f.write_text(s,encoding='utf-8',newline='\n')
for path,wgsl in [('packages/core/src/terrain/gpu/shaders/wgsl/instancedGrid.fragment.wgsl',True),('packages/core/src/terrain/gpu/shaders/instancedGrid.fragment.glsl',False)]:
    f=root/path;s=f.read_text(encoding='utf-8');marker='#ifdef AMBIENT_ONLY\n'
    if wgsl:
        block='''#if defined(SCENE_LINEAR_COLOR) && defined(IMAGERY)
    albedo=select(pow((albedo+vec3f(0.055))/1.055,vec3f(2.4)),albedo/12.92,albedo<=vec3f(0.04045));
#endif
'''
        s=s.replace(marker,block+marker,1).replace('    fragmentOutputs.color = vec4f(clamp(albedo * light, vec3f(0.0), vec3f(1.0)), 1.0);','''#ifdef SCENE_LINEAR_COLOR
    fragmentOutputs.color=vec4f(albedo*light,1.0);
#else
    fragmentOutputs.color = vec4f(clamp(albedo * light, vec3f(0.0), vec3f(1.0)), 1.0);
#endif''')
    else:
        block='''#if defined(SCENE_LINEAR_COLOR) && defined(IMAGERY)
    albedo=mix(pow((albedo+vec3(0.055))/1.055,vec3(2.4)),albedo/12.92,lessThanEqual(albedo,vec3(0.04045)));
#endif
'''
        s=s.replace(marker,block+marker,1).replace('gl_FragColor = vec4(clamp(albedo * light, vec3(0.0), vec3(1.0)), 1.0);','''#ifdef SCENE_LINEAR_COLOR
    gl_FragColor=vec4(albedo*light,1.0);
#else
    gl_FragColor = vec4(clamp(albedo * light, vec3(0.0), vec3(1.0)), 1.0);
#endif''')
    f.write_text(s,encoding='utf-8',newline='\n')
f=root/'packages/babylon-earth/src/earth-runtime.ts';s=f.read_text(encoding='utf-8').replace('sunlight.intensity = 1.5;','sunlight.intensity = atmosphereOptions?.aerialPerspective !== false && atmosphereOptions ? 1 / Math.PI : 1.5;').replace('ambient.intensity = 0.12;','ambient.intensity = atmosphereOptions?.aerialPerspective !== false && atmosphereOptions ? 0.03 : 0.12;').replace('                wireframe: false,','                wireframe: false,\n                linearColorOutput: Boolean(atmosphereOptions && atmosphereOptions.aerialPerspective !== false),');f.write_text(s,encoding='utf-8',newline='\n')
f=root/'packages/babylon-earth/tests/sky-motion.test.ts';s=f.read_text(encoding='utf-8').replace('makePhysicalScene({ dustTau: 0 }, [1, 0, 0]).model);','makePhysicalScene({ dustTau: 0 }, [1, 0, 0]).model, {aerialPerspective:false});');s='vi.mock("../src/atmosphere/scene-compositor",()=>({BabylonAtmosphereCompositor:class{}}));\n'+s;f.write_text(s,encoding='utf-8',newline='\n')
print('Installed HDR scene-depth composition and opt-in linear terrain output.')
