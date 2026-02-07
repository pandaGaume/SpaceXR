import type { ST_ResourceID } from "./3mf.interfaces";

/**
 *
 */
export interface IResourceIdFactory {
    next(): ST_ResourceID;
    reset(): IResourceIdFactory;
}

/**
 *
 */
export class IncrementalIdFactory implements IResourceIdFactory {
    /**
     *
     */
    _from: number;
    /**
     *
     */
    _to: number;
    /**
     *
     */
    _step: number;

    /**
     *
     */
    _i: number;

    /**
     *
     * @param from
     * @param to
     * @param step
     */
    public constructor(from: number = 0, to: number = Number.MIN_SAFE_INTEGER, step: number = 1) {
        this._from = from;
        this._to = to;
        this._step = step;
        this._i = from;
    }

    /**
     *
     * @returns
     */
    public next(): ST_ResourceID {
        if (this._i < this._to) {
            throw new Error("ST_ResourceID out of bound");
        }
        const v = this._i;
        this._i += this._step;
        return v;
    }

    /**
     *
     * @returns
     */
    public reset(): IResourceIdFactory {
        this._i = this._from;
        return this;
    }
}
