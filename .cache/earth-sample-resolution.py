from pathlib import Path
base=Path('C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-rendering')
f=base/'examples/babylon-earth/src/main.ts';s=f.read_text(encoding='utf-8');old='const { engine, renderer } = await createGeospatialRendererEngine(canvas, query.get("renderer") === "webgl" ? "webgl" : "webgpu");';assert old in s
s=s.replace(old,'''const dpr=Number(query.get("dpr") ?? 1);
    if (!Number.isFinite(dpr) || dpr<0.5 || dpr>2) throw new RangeError("dpr must be between 0.5 and 2.");
    const { engine, renderer } = await createGeospatialRendererEngine(canvas, query.get("renderer") === "webgl" ? "webgl" : "webgpu", {
        webgpu:{adaptToDeviceRatio:false},webgl:{adaptToDeviceRatio:false},
    });
    engine.setHardwareScalingLevel(1/dpr);''');f.write_text(s,encoding='utf-8',newline='\n')
f=base/'examples/babylon-earth/README.md';s=f.read_text(encoding='utf-8');s+='''
The sample renders one physical pixel per CSS pixel by default, regardless of display scaling, to avoid automatically multiplying terrain and antialiasing work on high-DPI screens. `?dpr=1.5` or `?dpr=2` opts into higher resolution; `?dpr=0.75` reduces it. This is a sample engine setting, not a change imposed on applications borrowing their own engine.
''';f.write_text(s,encoding='utf-8',newline='\n')
f=base/'examples/babylon-implicit-grid-mapzen/tests/providers.test.ts';s=f.read_text(encoding='utf-8');s='import { Ellipsoid, GeodeticSystem } from "@spacexr/geodesy";\n'+s
s=s.replace('describe("DEM presets", () => {','''describe("DEM presets", () => {
    it("uses the explicit surface supplied by an application composition", () => {
        const system=new GeodeticSystem(Ellipsoid.fromAxes("Explicit surface",1000,900));
        const {source,encoding}=createMapzenTerrariumSource({geodeticSystem:system});
        expect(source.metrics.geodeticSystem).toBe(system);
        expect(encoding).toBe("terrarium");
        expect(source.urlOf({lod:3,x:4,y:2})).toBe("https://s3.amazonaws.com/elevation-tiles-prod/terrarium/3/4/2.png");
    });''');f.write_text(s,encoding='utf-8',newline='\n')
print('Bounded sample pixel density and tested the reused Mapzen surface configuration.')
