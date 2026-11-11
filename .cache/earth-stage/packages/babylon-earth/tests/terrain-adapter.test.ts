import {describe,it,expect,vi} from "vitest";
import type {MeshTerrainEngine,BabylonRasterPages,IBabylonGeodesicGridHandle} from "@spacexr/3d-tiles-babylon";
import {EarthTerrainAdapter} from "../src/terrain-adapter";

function fixture(accepted:boolean) {
    const handle={} as IBabylonGeodesicGridHandle;
    const address={lod:1,x:0,y:0};const page={address,layer:0};
    const pages={load:vi.fn(async()=>page),release:vi.fn(),present:vi.fn(),hide:vi.fn()};
    const terrain={activate:vi.fn(async(context:Parameters<EarthTerrainAdapter['activate']>[0])=>{
        await context.readiness.ready('content',{kind:'renderable',handle});
    }),deactivate:vi.fn(),present:vi.fn(),hide:vi.fn(),release:vi.fn()};
    const adapter=new EarthTerrainAdapter(terrain as unknown as MeshTerrainEngine,pages as unknown as BabylonRasterPages);
    const context={signal:new AbortController().signal,pendingContents:[{id:'content'}],
        tile:{id:'tile',source:{metadata:{properties:{lod:1,x:0,y:0}}}},
        readiness:{ready:vi.fn(async()=>accepted),failed:vi.fn(),cancelled:vi.fn()},
        resources:[{handle}],
    } as unknown as Parameters<EarthTerrainAdapter['activate']>[0] & Parameters<EarthTerrainAdapter['present']>[0];
    return {adapter,pages,terrain,context};
}
describe('shared terrain and imagery lifecycle',()=>{
    it('keeps accepted imagery until the single runtime releases its terrain handle',async()=>{
        const {adapter,pages,terrain,context}=fixture(true);
        await adapter.activate(context);expect(pages.release).not.toHaveBeenCalled();
        adapter.present(context);expect(pages.present).toHaveBeenCalledOnce();expect(terrain.present).toHaveBeenCalledOnce();
        adapter.hide(context);expect(pages.hide).toHaveBeenCalledOnce();expect(pages.release).not.toHaveBeenCalled();
        adapter.release(context);expect(pages.release).toHaveBeenCalledOnce();
        adapter.release(context);expect(pages.release).toHaveBeenCalledOnce();
    });
    it('releases imagery when tile readiness rejects the terrain resource',async()=>{
        const {adapter,pages,context}=fixture(false);await adapter.activate(context);
        expect(pages.release).toHaveBeenCalledOnce();
    });
    it('reports failed imagery and does not publish untextured terrain',async()=>{
        const {adapter,pages,terrain,context}=fixture(false);pages.load.mockRejectedValueOnce(new Error('image unavailable'));
        await adapter.activate(context);expect(context.readiness.failed).toHaveBeenCalled();expect(terrain.activate).not.toHaveBeenCalled();
    });
});
