import { MeshTerrainEngine, metadataTileAddress, type BabylonRasterPages, type IBabylonRasterPage, type IBabylonGeodesicGridHandle } from "@spacexr/3d-tiles-babylon";
import type { IEcefSpatialState, ITileActivationContext, ITileDeactivationContext, ITilePresentationContext } from "@spacexr/3d-tiles-runtime";

type Activation=ITileActivationContext<IEcefSpatialState,IBabylonGeodesicGridHandle,never>;
type Presentation=ITilePresentationContext<IEcefSpatialState,IBabylonGeodesicGridHandle,never>;
/** Couples imagery residency to the terrain cut. Selection remains exclusively in TileRuntime. */
export class EarthTerrainAdapter {
    private readonly pagesByHandle=new Map<IBabylonGeodesicGridHandle,IBabylonRasterPage>();
    public constructor(private readonly terrain: MeshTerrainEngine,private readonly pages: BabylonRasterPages | undefined) {}
    public async activate(context: Activation): Promise<void> {
        if(!this.pages) return this.terrain.activate(context);
        const address=metadataTileAddress(context.tile);
        let page: IBabylonRasterPage | undefined;
        let retained=false;
        try {
            page=await this.pages.load(address);
            if(!page) throw new Error("No imagery serves the selected terrain tile.");
            const loaded=page;
            await this.terrain.activate({...context,readiness:{...context.readiness,ready:async(id,resource)=>{
                const accepted=await context.readiness.ready(id,resource);
                if(accepted) { this.pagesByHandle.set(resource.handle,loaded); retained=true; }
                return accepted;
            }}});
        } catch(error) {
            for(const content of context.pendingContents) {
                if(context.signal.aborted) await context.readiness.cancelled(content.id);
                else await context.readiness.failed(content.id,error);
            }
        } finally {
            if(page && !retained) this.pages.release(page.address);
        }
    }
    public deactivate(context: ITileDeactivationContext<IEcefSpatialState,IBabylonGeodesicGridHandle,never>): void { this.terrain.deactivate(context); }
    public present(context: Presentation): void {
        for(const resource of context.resources) { const page=this.pagesByHandle.get(resource.handle); if(page) this.pages!.present(page.address); }
        this.terrain.present(context);
    }
    public hide(context: Presentation): void {
        this.terrain.hide(context);
        for(const resource of context.resources) { const page=this.pagesByHandle.get(resource.handle); if(page) this.pages!.hide(page.address); }
    }
    public release(context: Presentation): void {
        this.terrain.release(context);
        for(const resource of context.resources) {
            const page=this.pagesByHandle.get(resource.handle);
            if(page) { this.pages!.release(page.address); this.pagesByHandle.delete(resource.handle); }
        }
    }
}
