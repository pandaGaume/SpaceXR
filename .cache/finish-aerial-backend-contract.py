from pathlib import Path
root=Path('C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-atmosphere')
f=root/'src/spectrum.ts';s=f.read_text(encoding='utf-8').replace('export interface ISpectralIntegrationOptions {','''export interface ISpectralIntegrationOptions {
    /** Optional opaque-surface distance in metres from the eye. Zero is a vacuum-length path. */
    maxDistanceMeters?: number;''').replace('{ steps = 256, solarSteps = 96 }: ISpectralIntegrationOptions = {}','{ steps = 256, solarSteps = 96, maxDistanceMeters }: ISpectralIntegrationOptions = {}')
marker='    direction = normalize(direction);\n    const m = scene.model,'
s=s.replace(marker,'''    if (maxDistanceMeters !== undefined && (!Number.isFinite(maxDistanceMeters) || maxDistanceMeters < 0)) throw new RangeError("Invalid surface distance");
    direction = normalize(direction);
    const m = scene.model,''')
s=s.replace('        interval = atmosphericInterval(m, origin, direction),','        fullInterval = atmosphericInterval(m, origin, direction),\n        interval = fullInterval && maxDistanceMeters !== undefined ? {...fullInterval,end:Math.min(fullInterval.end,maxDistanceMeters)} : fullInterval,')
s=s.replace('    if (interval) {\n        const ds = (interval.end - interval.start) / steps;','    if (interval && interval.end > interval.start) {\n        const ds = (interval.end - interval.start) / steps;');f.write_text(s,encoding='utf-8',newline='\n')
f=root/'webgpu/aerial.ts';s=f.read_text(encoding='utf-8').replace('source:()=>IAtmosphereSkyBindings','source:(camera:IAtmosphereCamera)=>IAtmosphereSkyBindings').replace('const source=this.source();','const source=this.source(camera);');f.write_text(s,encoding='utf-8',newline='\n')
f=root/'webgpu/index.ts';s=f.read_text(encoding='utf-8').replace('() => this.bindings(), options','''(camera) => {
            copyCamera(camera,this.model.ellipsoid);
            if(!this.camera || camera.positionEcefMeters.some((v,i)=>Math.abs(v-this.camera!.positionEcefMeters[i])>0.001)) throw new Error("Aerial camera must match the encoded sky position");
            return this.bindings();
        }, options''');f.write_text(s,encoding='utf-8',newline='\n')
print('Added finite-distance CPU reference and protected the aerial/sky snapshot contract.')
