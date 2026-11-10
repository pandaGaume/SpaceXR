from pathlib import Path
p=Path('C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-rendering/packages/babylon-earth/tests/sky-motion.test.ts')
s=p.read_text(encoding='utf-8').replace('vi.mock("../src/atmosphere/scene-compositor", () => ({ BabylonAtmosphereCompositor: class {} }));','''vi.mock("../src/atmosphere/scene-compositor", () => ({ BabylonAtmosphereCompositor: class {
    constructor(...args:unknown[]){state.compositorExposures.push(args[4] as number);}
    setExposure(value:number){state.compositorExposures.push(value);}
    dispose(){}
} }));''')
s=s.replace('    skies: [] as Array<', '    compositorExposures:[] as number[],\n    skies: [] as Array<')
s=s.replace('        static async create() {','        async createAerialVolume(){return {encode(){},dispose(){}};}\n        static async create() {')
s=s.replace('    state.skies.length = 0;','    state.compositorExposures.length=0;\n    state.skies.length = 0;')
s=s.replace('describe("atmosphere motion regressions", () => {','''describe("atmosphere motion regressions", () => {
    it("uses the same HDR exposure at startup and after an explicit exposure update",async()=>{
        const {scene}=fixture();const sky=await BabylonEarthSky.create(scene,makePhysicalScene({dustTau:0},[1,0,0]).model);
        expect(state.compositorExposures).toEqual([4]);sky.setExposure(4);expect(state.compositorExposures).toEqual([4,4]);sky.dispose();
        const custom=await BabylonEarthSky.create(scene,makePhysicalScene({dustTau:0},[1,0,0]).model,{exposure:2});
        expect(state.compositorExposures.at(-1)).toBe(2);custom.dispose();
    });''')
p.write_text(s,encoding='utf-8')
