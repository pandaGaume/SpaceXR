import { EventState, Observable, Observer } from "../../events/events.observable";
import { ITileAddress } from "../tiles.interfaces";
import { ITileView } from "./tiles.interfaces.pipeline";
import { ITileMapApi } from "../api/tiles.interfaces.api";
import { Nullable } from "../../types";
export declare class TileView implements ITileView {
    _id?: string;
    _addressAddedObservable?: Observable<Array<ITileAddress>>;
    _addressRemovedObservable?: Observable<Array<ITileAddress>>;
    _activ: Map<string, ITileAddress>;
    _api: Nullable<ITileMapApi>;
    _observer: Nullable<Observer<ITileMapApi>>;
    constructor(id: string, model?: ITileMapApi);
    get api(): Nullable<ITileMapApi>;
    set api(api: Nullable<ITileMapApi>);
    get id(): string | undefined;
    dispose(): void;
    get addressAddedObservable(): Observable<Array<ITileAddress>>;
    get addressRemovedObservable(): Observable<Array<ITileAddress>>;
    protected _onViewChanged(eventData: ITileMapApi, eventState: EventState): void;
    protected _doValidateContext(api: ITileMapApi, dispatchEvent?: boolean): void;
    protected _doClearContext(api: ITileMapApi, dispatchEvent?: boolean): void;
    protected _onAddressAddedObserverAdded(observer: Observer<Array<ITileAddress>>): void;
    protected _onAddressRemovedObserverAdded(observer: Observer<Array<ITileAddress>>): void;
}
