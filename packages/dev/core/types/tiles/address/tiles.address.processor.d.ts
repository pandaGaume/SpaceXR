import { ICartesian3 } from "../../geometry/geometry.interfaces";
import { ITileAddress, ITileAddressProcessor, ITileMetrics, ITileSection } from "../tiles.interfaces";
export declare class OffsetAddressProcessor implements ITileAddressProcessor {
    _offset: ICartesian3;
    constructor(offset: ICartesian3);
    process(address: ITileAddress, metrics?: ITileMetrics): ITileAddress[] | ITileSection;
}
