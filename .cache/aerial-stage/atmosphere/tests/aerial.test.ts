import {describe,it,expect} from "vitest";
import {makePhysicalScene,integrateSpectral} from "../src/spectrum";
import {geodeticPosition} from "../src/geometry";
import {horizonMetadata} from "../webgpu/camera";

describe("finite-distance atmosphere",()=>{
    const scene=makePhysicalScene({dustTau:0},[1,0,0]);
    const eye=geodeticPosition(scene.model.ellipsoid,0,0,1000);
    it("returns zero path radiance and vacuum transmission before traversing air",()=>{
        const zero=integrateSpectral(scene,eye,[0,1,0],{maxDistanceMeters:0,steps:16,solarSteps:16});
        expect(zero.spectralRadiance.every(v=>v===0)).toBe(true);
        const tiny=integrateSpectral(scene,eye,[0,1,0],{maxDistanceMeters:0.001,steps:16,solarSteps:16});
        for(let i=0;i<3;i++)expect(tiny.transmittance[i]).toBeCloseTo(zero.transmittance[i]!,5);
    });
    it("increases scattered light and reduces transmission as surface distance grows",()=>{
        const near=integrateSpectral(scene,eye,[0,1,0],{maxDistanceMeters:1000,steps:64,solarSteps:64});
        const far=integrateSpectral(scene,eye,[0,1,0],{maxDistanceMeters:20000,steps:128,solarSteps:64});
        expect(far.spectralRadiance.every((v,i)=>v>near.spectralRadiance[i]!)).toBe(true);
        for(let i=0;i<3;i++)expect(far.transmittance[i]).toBeLessThan(near.transmittance[i]!);
        expect(()=>integrateSpectral(scene,eye,[0,1,0],{maxDistanceMeters:-1})).toThrow(/distance/);
    });
    it("focuses external sky samples between ground and atmospheric tangencies",()=>{
        const axes={semiMajorAxis:1000,semiMinorAxis:1000};
        const metadata=horizonMetadata(axes,[1500,0,0],16,100);
        for(let x=0;x<16;x++){
            expect(metadata.horizon[x]).toBeCloseTo(-Math.acos(1000/1500),6);
            expect(metadata.upperHorizon[x]).toBeCloseTo(-Math.acos(1100/1500),6);
            expect(metadata.upperHorizon[x]).toBeLessThan(0);
        }
    });
});
