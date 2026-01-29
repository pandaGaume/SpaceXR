
import { Observable } from "core/events";
import { GeodeticSystem } from "core/geodesy";
import { IGeo3 } from "core/geography";
import { ICartesian3 } from "core/geometry";
import { Range } from "core/math";
import { ICameraViewState } from "core/tiles";
import { ReadonlyDeep } from "core/types";


export interface IPlaneteryCamera {

    onStateChanged: Observable<IPlaneteryCamera>

    ecefPosition : ReadonlyDeep<ICartesian3> ;
    ecefTarget:ReadonlyDeep<ICartesian3>;
    ecefDirectionN:ReadonlyDeep<ICartesian3>;
    location:ReadonlyDeep<IGeo3>;
    targetLocation:ReadonlyDeep<IGeo3>;
    state:ICameraViewState;

    altitudeRange?:Range;
    geoSystem:GeodeticSystem;

    setLocation(location:IGeo3):IPlaneteryCamera;
    setTargetLocation(location:IGeo3):IPlaneteryCamera;
    
    setEcefPosition(position:ICartesian3):IPlaneteryCamera;
    setEcefTarget(position:ICartesian3):IPlaneteryCamera;
}