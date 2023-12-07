import { ICartesian3 } from "../geometry/geometry.interfaces";
import { TileAddress } from "./tiles.address";
import { ITileAddress, ITileAddressProcessor, ITileMetrics, ITileSection } from "./tiles.interfaces";
import { TileSection } from "./tiles.section";

/// <summary>
/// The TileAddressProcessor is mainly used to support increase zoom levels in layered Digital Elevation Model (DEM) applications.
/// It is also adaptable for various other use cases.
/// </summary>
export class OffsetAddressProcessor implements ITileAddressProcessor {
    _offset: ICartesian3;

    constructor(offset: ICartesian3) {
        this._offset = offset;
    }

    public process(address: ITileAddress, metrics?: ITileMetrics): ITileAddress[] | ITileSection {
        const x = address.x + this._offset.x ?? 0;
        const y = address.y + this._offset.y ?? 0;

        const k = TileAddress.TileXYToQuadKey(x, y, address.levelOfDetail);
        if (this._offset.z > 0) {
            let keys: string[] = [k];
            // which mean we zoom in
            for (let i = 0; i < this._offset.z; i++) {
                keys = keys.map((k) => TileAddress.ToChildsKey(k)).flat();
            }
            return keys
                .map((k) => {
                    const a = TileAddress.QuadKeyToTileXY(k);
                    return metrics ? (TileAddress.IsValidAddress(a, metrics) ? a : null) : a;
                })
                .filter((a) => a !== null) as ITileAddress[];
        }

        return TileSection.ToParentSection(k, Math.abs(this._offset.z));
    }
}
