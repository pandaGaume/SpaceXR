import { ST_ResourceID } from "./3mf.interfaces";

export interface  IRessourceIdFactory {
    next():ST_ResourceID; 
    reset():IRessourceIdFactory
}

export class IncrementalIdFactory implements IRessourceIdFactory{

    _from:number ;
    _to:number;
    _step:number ;

    _i:number;

    public constructor(from:number=0,to:number= Number.MIN_SAFE_INTEGER,step:number= 1){
        this._from = from;
        this._to = to;
        this._step = step;
        this._i = from;
    }

    public next():ST_ResourceID {
        if( this._i < this._to){
            throw new Error("ST_ResourceID out of bound") ;
        }
        const v = this._i;
        this._i += this._step;
        return v;
    }

    public reset():IRessourceIdFactory{
        this._i = this._from;
        return this;
    }
}
