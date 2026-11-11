from pathlib import Path
root=Path('C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-rendering/packages/babylon-earth')
f=root/'src/atmosphere/babylon-sky.ts';s=f.read_text(encoding='utf-8').replace('private motionBaked: IAtmosphereCamera | undefined;','private motionBuilding: IAtmosphereCamera | undefined;')
s=s.replace('if (!samePosition(this.motionBaked)) this.motionSky.update(current);','''if (!this.motionBuilding || (this.motionReady && !samePosition(this.motionBuilding))) {
            this.motionSky.update(current); this.motionBuilding=current;
        }''').replace('this.motionReady = true; this.motionBaked = current;','''this.motionReady = true;
            if (!samePosition(this.motionBuilding)) {
                this.motionSky.update(current); this.motionSky.encode(encoder,4096); this.motionBuilding=current;
            }''')
f.write_text(s,encoding='utf-8',newline='\n')
print('Prevented startup bake starvation while the pointer is moving.')
