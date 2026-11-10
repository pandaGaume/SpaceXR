from pathlib import Path
p=Path('C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-atmosphere/tests/webgpu.test.ts')
s=p.read_text(encoding='utf-8').replace('createBindGroupLayout: vi.fn(() => ({})),','createBindGroupLayout: vi.fn(() => ({})),\n        createPipelineLayout: vi.fn(() => ({})),')
needle='    it("cleans partial creation and reports device loss", async () => {'
test='''    it("bounds finite-volume rebuilds and preserves its borrowed sky", async () => {
        const g = gpu();
        const sky = await AtmosphereSky.create(g.device, model, { width: 8, hemisphereRows: 4, viewSteps: 8, solarSteps: 8 });
        sky.update(camera);
        sky.encode(g.encoder, 4096);
        const skyResources = [...g.buffers, ...g.textures];
        const volume = await sky.createAerialVolume({ width: 8, height: 4, depth: 4 });
        expect(() => volume.bindings()).toThrow(/Encode/);
        const count = g.dispatch.mock.calls.length;
        volume.encode(g.encoder, camera);
        expect(g.dispatch).toHaveBeenCalledTimes(count + 1);
        volume.encode(g.encoder, camera);
        expect(g.dispatch).toHaveBeenCalledTimes(count + 1);
        volume.encode(g.encoder, { ...camera, halfWidthTangent: 0.8 });
        expect(g.dispatch).toHaveBeenCalledTimes(count + 2);
        expect(() => volume.encode(g.encoder, { ...camera, positionEcefMeters: [6378140, 0, 0] })).toThrow();
        expect(volume.bindings().dimensions).toEqual([8, 4, 4]);
        expect(g.raw.queue.submit).not.toHaveBeenCalled();
        volume.dispose();
        volume.dispose();
        expect(skyResources.every(r => r.destroy.mock.calls.length === 0)).toBe(true);
        expect(() => volume.bindings()).toThrow(/Encode/);
        expect(sky.bindings()).toBeDefined();
        sky.dispose();
        expect([...g.buffers, ...g.textures].every(r => r.destroy.mock.calls.length === 1)).toBe(true);
    });
'''
assert needle in s
p.write_text(s.replace(needle,test+needle),encoding='utf-8')
