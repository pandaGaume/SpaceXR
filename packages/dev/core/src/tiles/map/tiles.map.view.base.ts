import { Observable } from "../../events";
import { ITileAddress, ITileMetrics } from "../tiles.interfaces";
import { ILinkOptions, IPipelineMessageType, ITargetBlock, ITilePipelineLink, ITileSelectionContextOptions, ITileView } from "../pipeline/tiles.pipeline.interfaces";
import { Nullable } from "../../types";
import { ITileNavigationState } from "../navigation";
import { TilePipelineLink } from "../pipeline/tiles.pipeline.link";
import { IDisplay } from ".";

export class TileViewBase implements ITileView {
    _addedObservable?: Observable<IPipelineMessageType<ITileAddress>>;
    _removedObservable?: Observable<IPipelineMessageType<ITileAddress>>;
    _updatedObservable?: Observable<IPipelineMessageType<ITileAddress>>;

    _activ: Map<string, ITileAddress> = new Map<string, ITileAddress>();

    // internal pipeline links
    _links: Array<ITilePipelineLink<ITileAddress>> = [];

    public dispose(): void {
        // dispose the links
        for (const l of this._links) {
            l.dispose();
        }
        this._links = [];
    }

    public get addedObservable(): Observable<IPipelineMessageType<ITileAddress>> {
        this._addedObservable = this._addedObservable || new Observable<IPipelineMessageType<ITileAddress>>();
        return this._addedObservable!;
    }

    public get removedObservable(): Observable<IPipelineMessageType<ITileAddress>> {
        this._removedObservable = this._removedObservable || new Observable<IPipelineMessageType<ITileAddress>>();
        return this._removedObservable!;
    }

    public get updatedObservable(): Observable<IPipelineMessageType<ITileAddress>> {
        this._updatedObservable = this._updatedObservable || new Observable<IPipelineMessageType<ITileAddress>>();
        return this._updatedObservable!;
    }

    public linkTo(target: ITargetBlock<ITileAddress>, options?: ILinkOptions<ITileAddress>): void {
        // a view may be linked to several targets, so we need to keep track of them.
        if (this._links.findIndex((l) => l.target === target) === -1) {
            const link = new TilePipelineLink(this, target, options);
            this._links.push(link);
        }
    }

    public unlinkFrom(target: ITargetBlock<ITileAddress>): ITilePipelineLink<ITileAddress> | undefined {
        const i = this._links.findIndex((l) => l.target === target);
        if (i !== -1) {
            const l = this._links.splice(i)[0];
            l.dispose();
            return l;
        }
        return undefined;
    }

    public setContext(state: Nullable<ITileNavigationState>, display: Nullable<IDisplay>, metrics: ITileMetrics, options?: ITileSelectionContextOptions): void {
        if (!state || !display) {
            this._doClearContext(state, this._activ, options);
            return;
        }
        this._doValidateContext(state, display, metrics, this._activ, options);
    }

    protected _doClearContext(state: Nullable<ITileNavigationState>, activAddresses: Map<string, ITileAddress>, options?: ITileSelectionContextOptions): void {
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
        activAddresses: Map<string, ITileAddress>,
        options?: ITileSelectionContextOptions
    ): void {}
}
