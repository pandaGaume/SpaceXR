from pathlib import Path
a=Path('C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-atmosphere');r=Path('C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-rendering')
depth='''// Canonical volume coordinate shared by native material readers. Scaled ECEF origin, ray per km, distance in km.
fn atmosphere_aerialDepth(origin:vec3f,ray:vec3f,scale:f32,distance:f32)->f32 {
    let a=dot(ray,ray);let b=dot(origin,ray);let c=dot(origin,origin)-scale*scale;
    let delta=b*b-a*c;if delta<0.0{return 0.0;}
    let root=sqrt(max(0.0,delta));let start=max(0.0,(-b-root)/a);let end=(-b+root)/a;
    if end<=start{return 0.0;}return sqrt(clamp((distance-start)/(end-start),0.0,1.0));
}
'''
(a/'webgpu/shaders/aerial-read.wgsl').write_text(depth,encoding='utf-8')
p=a/'scripts/build-shaders.mjs';s=p.read_text(encoding='utf-8').replace('"multiple"]','"multiple", "aerial-read"]');p.write_text(s,encoding='utf-8')
p=a/'webgpu/index.ts';s=p.read_text(encoding='utf-8');s='import aerialDepth from "./generated/aerial-read";\n/** Renderer-independent volume depth coordinate in WGSL. */\nexport const atmosphereAerialDepthWgsl=aerialDepth;\n'+s;p.write_text(s,encoding='utf-8')
p=a/'webgpu/aerial.ts';s=p.read_text(encoding='utf-8').replace('    /** Texel dimensions of both 3D textures. */','    /** Borrowed native texture for renderer material bindings. Never destroy or modify it. */ readonly radianceResource:GPUTexture;\n    /** Borrowed native texture for renderer material bindings. Never destroy or modify it. */ readonly transmissionResource:GPUTexture;\n    /** Texel dimensions of both 3D textures. */')
s=s.replace('return t.createView({ dimension: "3d" });','return t;').replace('            const radiance = texture(),\n                transmission = texture();','            const radianceResource=texture(),transmissionResource=texture();\n            const radiance=radianceResource.createView({dimension:"3d"}),transmission=transmissionResource.createView({dimension:"3d"});').replace('                dimensions: size,','                dimensions: size,\n                radianceResource,transmissionResource,');p.write_text(s,encoding='utf-8')
p=r/'packages/core/src/terrain/gpu/shaders/wgsl/instancedGrid.fragment.wgsl';s=p.read_text(encoding='utf-8').replace('fragmentOutputs.color=vec4f(albedo*light,1.0);','var surfaceColor = albedo * light;\n    // TERRAIN_FRAGMENT_COLOR\n    fragmentOutputs.color = vec4f(surfaceColor, 1.0);');assert 'TERRAIN_FRAGMENT_COLOR' in s;p.write_text(s,encoding='utf-8')
(r/'packages/babylon-earth/src/atmosphere/native-surface.ts').write_text(Path('.cache/native-surface.ts').read_text(encoding='utf-8'),encoding='utf-8')
(r/'packages/babylon-earth/src/atmosphere/surface.wgsl').write_text(Path('.cache/native-surface.wgsl').read_text(encoding='utf-8'),encoding='utf-8')
p=r/'packages/babylon-earth/scripts/build-shader.mjs';s=p.read_text(encoding='utf-8').replace('["display","composite","present"]','["display","surface"]');p.write_text(s,encoding='utf-8')
p=r/'packages/babylon-earth/src/atmosphere/babylon-sky.ts';s=p.read_text(encoding='utf-8');s=s.replace('import { atmosphereWhitePoint } from "./display-color";\n','').replace('import { BabylonAtmosphereCompositor } from "./scene-compositor";','import {BabylonAtmosphereSurface} from "./native-surface";\nimport type {ShaderMaterial} from "@babylonjs/core/Materials/shaderMaterial.js";');s=s.replace('private compositor: BabylonAtmosphereCompositor | undefined;', 'private surface:BabylonAtmosphereSurface|undefined;');s=s.replace('        this.compositor?.prepareCamera(camera);\n','')
start=s.index('            if (options.aerialPerspective !== false)\n                bridge.compositor =');end=s.index('            return bridge;',start);s=s[:start]+s[end:]
s=s.replace('this.layer.isEnabled = !this.compositor && value && this.ready;','this.layer.isEnabled = value && this.ready;').replace('this.compositor?.setEnabled(value);','this.surface?.setEnabled(value);').replace('        this.compositor?.setExposure(value);\n','')
start=s.index('        if (active && this.compositor) {');end=s.index('            if (!this.pipeline && !this.compiling)',start)
s=s[:start]+'''        if(active&&this.surface){const volume=active===this.motionSky?this.motionAerial!:this.settledAerial!;volume.encode(encoder,current);this.surface.update(volume,current,camera,this.exposure);}
        if (active) {
'''+s[end:]
s=s.replace('this.compositor?.dispose();','this.surface?.dispose();')
pos=s.index('    public setEnabled(value: boolean): void {');s=s[:pos]+'''    public attachTerrain(material:ShaderMaterial):void {
        if(this.options.aerialPerspective===false)return;
        if(this.surface)throw new Error("Atmosphere surface is already attached");
        this.surface=new BabylonAtmosphereSurface(this.scene,this.engine,material,this.model,this.options.quality);
        this.surface.setEnabled(this.enabled);
    }
'''+s[pos:]
s=s.replace('const width = this.options.width ?? 768;','const width = this.options.width ?? this.engine.getRenderWidth();')
s=s.replace('width: 32,\n            hemisphereRows: 16,\n            viewSteps: 24,','width: 16,\n            hemisphereRows: 8,\n            viewSteps: 16,')
s=s.replace('motion.createAerialVolume(options.aerialQuality)','motion.createAerialVolume({width:16,height:9,depth:24,segmentSteps:2,...options.aerialQuality})').replace('settled.createAerialVolume({ depth: 24, segmentSteps: 3,','settled.createAerialVolume({ depth: 32, segmentSteps: 2,')
p.write_text(s,encoding='utf-8')
p=r/'packages/babylon-earth/src/earth-runtime.ts';s=p.read_text(encoding='utf-8').replace('sunlight.intensity = atmosphereOptions?.aerialPerspective !== false && atmosphereOptions ? 1 / Math.PI : 1.5;','sunlight.intensity = 1.5;').replace('ambient.intensity = atmosphereOptions?.aerialPerspective !== false && atmosphereOptions ? 0.03 : 0.12;','ambient.intensity = 0.12;').replace('linearColorOutput: Boolean(atmosphereOptions && atmosphereOptions.aerialPerspective !== false),','linearColorOutput: false,')
s=s.replace('        polarCaps = options.polarCaps', '        if(sky&&terrain instanceof GpuTerrainEngine)sky.attachTerrain(terrain.material);\n        polarCaps = options.polarCaps')
s=s.replace('                sky = replacement;','                sky = replacement;\n                if(sky&&terrain instanceof GpuTerrainEngine)sky.attachTerrain(terrain.material);');p.write_text(s,encoding='utf-8')
# Remove the rejected scene post-processing implementation.
for name in ['scene-compositor.ts','composite.wgsl','present.wgsl','generated/composite.ts','generated/present.ts']:
 p=r/'packages/babylon-earth/src/atmosphere'/name
 if p.exists():p.unlink()
# Watch the backend sources directly instead of retaining stale node_modules transformations in Vite.
p=r/'examples/babylon-earth/vite.config.ts';s=p.read_text(encoding='utf-8').replace('        alias: {','        alias: {\n            "@spacexr/atmosphere/webgpu":fileURLToPath(new URL("../../../spacexr-atmosphere/webgpu/index.ts",import.meta.url)),\n            "@spacexr/atmosphere":fileURLToPath(new URL("../../../spacexr-atmosphere/src/index.ts",import.meta.url)),');p.write_text(s,encoding='utf-8')
