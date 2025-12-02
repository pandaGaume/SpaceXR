import { Cartesian3, ICartesian3 } from "../../geometry";
import { Nullable } from "../../types";
import { IVerticesData } from "./meshes.interfaces";

export class RibbonOptions {
    public path : Array<ICartesian3> = []
    public width : number | Array<number> = [1,1]; // left, right.
    public up: ICartesian3 = Cartesian3.UnitZ();  
    public close : boolean = false;
}

export class RibbonBuilder {

    _o?: RibbonOptions;

    public withOptions(o: RibbonOptions): RibbonBuilder {
        this._o = o;
        return this;
    }

    public withPath(path: Array<ICartesian3>): RibbonBuilder {
        if(!this._o) {
            this._o = new RibbonOptions();
        }
        this._o.path = path;
        return this;
    }

    public withWidth(width: number | Array<number>): RibbonBuilder {
        if(!this._o) {
            this._o = new RibbonOptions();
        }
        this._o.width = width;
        return this;
    }
   
    public withUp(up: ICartesian3): RibbonBuilder {
        if(!this._o) {
            this._o = new RibbonOptions();
        }           
        this._o.up = up;
        return this;
    }

    public withClosePath(closePath: boolean): RibbonBuilder {
        if(!this._o) {
            this._o = new RibbonOptions();
        }
        this._o.close = closePath;
        return this;
    }

    public reset(): RibbonBuilder {
        this._o = undefined;
        return this;
    }


    public build() : IVerticesData {

        const path = this._o?.path!;
        const lateralVectors = this._getLateralVectors(path, this._o?.up!);


        const positions : Array<number> = [];
        const indices : Array<number> = [];
        const uvs : Nullable<Array<number>> = null;
        const normals :Nullable<Array<number>> = [];

        const w = this._o?.width??1
        const widths : Array<number> =  Array.isArray(w) ? w : [w,w];
        const left = Math.abs(widths[0]);
        const right =  Math.abs(widths[1]);

        let a0 : Nullable<ICartesian3> = null;
        let a1 : Nullable<ICartesian3> = null;   
        let b0 : ICartesian3;
        let b1 : ICartesian3;
        const tmp = Cartesian3.Zero();
        const up  = this._o?.up!;

        for(let i = 0; i < path.length; i++) {

            b0 = left?  Cartesian3.Add(path[i], Cartesian3.MultiplyByFloatToRef(lateralVectors[i], left, tmp)) : path[i];
            b1 = right? Cartesian3.Subtract(path[i], Cartesian3.MultiplyByFloatToRef(lateralVectors[i], right, tmp)) : path[i];
            positions.push(b0.x, b0.y, b0.z,b1.x, b1.y, b1.z);
            normals.push(up.x, up.y, up.z,up.x, up.y, up.z);
            if(a0 && a1) {
                // we may build the quad 
                let k = positions.length / 3 - 4;
                indices.push(k, k+1, k+2,k, k+2, k+3);
            }
            a0 = b0;
            a1 = b1;
         }

        return { positions, indices, uvs, normals };
    }

    private _getLateralVectors(path: Array<ICartesian3>, up: ICartesian3) : Array<ICartesian3> {
        const lateralVectors : Array<ICartesian3> = [];
        const temp = Cartesian3.Zero();
        let alateral = null;
        let bforward = null;
        let blateral = null;
        for (let i = 0; i < path.length - 1; i++) {
            bforward = Cartesian3.SubtractToRef(path[i + 1], path[i], temp);
            blateral = Cartesian3.NormalizeInPlace(Cartesian3.Cross(bforward, up));
            if(alateral) {
                const medianLateral = this._getMedianLateralVector(blateral,alateral, temp)
                lateralVectors.push(medianLateral);
            } else {
                lateralVectors.push(blateral);
            }
            alateral = blateral;
        }
        lateralVectors.push(blateral!);

        if(this._o?.close) {
            const medianLateral = this._getMedianLateralVector(lateralVectors[lateralVectors.length - 1], lateralVectors[0], temp)
            lateralVectors[lateralVectors.length - 1] = medianLateral;
            lateralVectors[0] = medianLateral;
        }
        return lateralVectors;
    }

    private _getMedianLateralVector(a: ICartesian3, b: ICartesian3, temp: ICartesian3) : ICartesian3 {
        const medianLateral = Cartesian3.Normalize(Cartesian3.AddToRef(b,a, temp));
        const dot = Cartesian3.Dot(medianLateral, b);
        const scale = 1 / Math.max(dot, 1e-3) ; // clamp to avoid infinite scale
        Cartesian3.MultiplyByFloatInPlace(medianLateral, scale);
        return medianLateral;
    }
}