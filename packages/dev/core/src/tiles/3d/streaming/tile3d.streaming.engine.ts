import { Nullable } from "dev/core/src/types";
import { ICameraState } from "../../navigation";
import { IDisplay } from "../../map";
import { IStreamingTileset } from "./tile3d.streaming.interfaces";
import { SourceBlock } from "../../pipeline/tiles.pipeline.sourceblock";

export class Tile3dStreamingEngine extends SourceBlock<IStreamingTileset> {
    _uri: string;

    public constructor(uri: string) {
        super();
        this._uri = uri;
    }

    public setContext(state: Nullable<ICameraState>, display: Nullable<IDisplay>): void {
        if (!state || !display) {
            this._doClearContext();
            return;
        }
        this._doValidateContext(state, display);
    }

    protected _doClearContext(): void {}

    protected _doValidateContext(state: Nullable<ICameraState>, display: Nullable<IDisplay>): void {
        if (state && display) {
        }
    }
}
