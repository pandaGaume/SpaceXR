import { Observable } from "./events";
import { IDisposable, IValidable } from "./types";
export declare class ValidableBase implements IValidable, IDisposable {
    static readonly VALID_PROPERTY_NAME: string;
    _validationObservable?: Observable<boolean>;
    _valid: boolean;
    get isValid(): boolean;
    get validationObservable(): Observable<boolean>;
    invalidate(): void;
    validate(force?: boolean): void;
    revalidate(): void;
    protected _doInvalidateInternal(): void;
    protected _doValidateInternal(): void;
    dispose(): void;
    protected _beforeInvalidate(): void;
    protected _doInvalidate(): void;
    protected _afterInvalidate(): void;
    protected _beforeValidate(): void;
    protected _doValidate(): void;
    protected _afterValidate(): void;
}
