import { IVerticesData } from "../Meshes/meshes.interfaces";
import { ICartesian } from "../Geography/geography.interfaces";

export interface IFactories {
    createVerticesData(): IVerticesData;
    createCartesian(): ICartesian;
}

export enum FALErrorCode {
    nullFactories = 1,
    unableToCreateObject = 2,
}

export class FAL {
    public static FALErrorString = ["Error while using the FAL.", "Factory is not initialized. Use FAL.Factories = {...}.", "Unable to create object."];
    public static Factories: IFactories;
    public static CreateException(code: FALErrorCode, ...args: string[]): Error {
        return new Error(FAL.BuildExceptionMessage(code, ...args));
    }
    public static BuildExceptionMessage(code: FALErrorCode, ...args: string[]): string {
        const mess = code > 0 && code < FAL.FALErrorString.length ? FAL.FALErrorString[code] : "";
        const a = [FAL.FALErrorString[0], mess];
        a.push(...args);
        return a.join(" ");
    }
}
