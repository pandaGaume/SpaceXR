import { IDemInfos } from "../dem";
import { IVerticesData, IVerticesDataBuilder } from "../geometry";
import { ITileContentProvider, ITileSelectionContext } from "../tiles";


export interface IBaseConfiguration{
    height:number;
}

export interface ITerrainBlocBuilder {
    withGridBuilder(builder:IVerticesDataBuilder):ITerrainBlocBuilder;
    withDemSource(client: ITileContentProvider<IDemInfos>):ITerrainBlocBuilder;    
    withSelectionContext(context:ITileSelectionContext):ITerrainBlocBuilder;    
    withBaseInfos(config:IBaseConfiguration):ITerrainBlocBuilder;
    build():IVerticesData;
}