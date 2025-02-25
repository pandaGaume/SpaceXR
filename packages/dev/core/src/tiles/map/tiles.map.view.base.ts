import { ITileAddress2, ITileMetrics } from "../tiles.interfaces";
import { ITileSelectionContextOptions, ITileView } from "../pipeline/tiles.pipeline.interfaces";
import { Nullable } from "../../types";
import { ITileNavigationState } from "../navigation";
import { IDisplay } from ".";
import { SourceBlock } from "../pipeline/tiles.pipeline.sourceblock";

export class TileViewBase extends SourceBlock<ITileAddress2> implements ITileView {
    _activ: Map<string, ITileAddress2> = new Map<string, ITileAddress2>();

    public constructor() {
        super();
    }

    public setContext(state: Nullable<ITileNavigationState>, display: Nullable<IDisplay>, metrics: ITileMetrics, options?: ITileSelectionContextOptions): void {
        if (!state || !display) {
            this._doClearContext(state, this._activ, options);
            return;
        }
        this._doValidateContext(state, display, metrics, this._activ, options);
    }

    protected _doClearContext(state: Nullable<ITileNavigationState>, activAddresses: Map<string, ITileAddress2>, options?: ITileSelectionContextOptions): void {
        if (state) {
            let deleted = Array.from(activAddresses.values());
            activAddresses.clear();

            if (options?.dispatchEvent ?? true) {
                if (deleted.length && this._removedObservable?.hasObservers()) {
                    this._removedObservable.notifyObservers(deleted, -1, this, this);
                }
            }
        }
    }

    protected _doValidateContext(
        state: Nullable<ITileNavigationState>,
        display: Nullable<IDisplay>,
        metrics: ITileMetrics,
        activAddresses: Map<string, ITileAddress2>,
        options?: ITileSelectionContextOptions
    ): void {}
}
