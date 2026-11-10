from pathlib import Path
f=Path('C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-rendering/packages/babylon-earth/src/atmosphere/babylon-sky.ts')
s=f.read_text();old='''        this.texture = new BaseTexture(
            this.scene,
            this.engine.wrapWebGPUTexture(this.output),
        );'''
assert old in s
s=s.replace(old,'''        const internal = this.engine.wrapWebGPUTexture(this.output);
        (internal._hardwareTexture as WebGPUHardwareTexture).createView({ dimension: "2d" });
        this.engine.updateTextureSamplingMode(2, internal);
        this.texture = new BaseTexture(this.scene, internal);''');f.write_text(s)
