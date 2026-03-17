import { ITile2DAddress, ITileMetrics } from "../tiles.interfaces";
import { ITileSelectionContextOptions, ITileView } from "../pipeline/tiles.pipeline.interfaces";
import { Nullable } from "../../types";
import { ITileNavigationState } from "../navigation";
import { IDisplay } from ".";
import { SourceBlock } from "../pipeline/tiles.pipeline.sourceblock";

export class TileViewBase extends SourceBlock<ITile2DAddress> implements ITileView {
    _activ: Map<string, ITile2DAddress> = new Map<string, ITile2DAddress>();

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

    /**
     * Clear the active tile address cache. This forces the next setContext call
     * to treat all tile addresses as new, triggering fresh tile requests.
     * Useful when the layer composition changes but navigation state stays the same.
     */
    public clearContext(): void {
        this._activ.clear();
    }

    protected _doClearContext(state: Nullable<ITileNavigationState>, activAddresses: Map<string, ITile2DAddress>, options?: ITileSelectionContextOptions): void {
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
        activAddresses: Map<string, ITile2DAddress>,
        options?: ITileSelectionContextOptions
    ): void {}
}
