import { ICartesian2, ISize2 } from "../geometry/geometry.interfaces";
import { ITileAddress, ITileSection } from "./tiles.interfaces";
export declare class TileSection implements ITileSection {
    offset?: ICartesian2 | undefined;
    size?: ISize2 | undefined;
    private static _ToNormalizedParentSection;
    static ToParentSection(key: string, n?: number): ITileSection;
    private _k?;
    private _a;
    private _o?;
    private _s?;
    constructor(address: ITileAddress, offset?: ICartesian2 | undefined, size?: ISize2 | undefined);
    get address(): ITileAddress;
    get x(): number;
    get y(): number;
    get width(): number;
    get height(): number;
    get key(): string;
}
