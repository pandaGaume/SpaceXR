import { Engine } from "@babylonjs/core/Engines/engine";
declare module "@babylonjs/core/Engines/engine" {
    export interface Engine {
        addDemTile(): void;
        removeDemTile(): void;
    }
}

Engine.prototype.addDemTile = function () {};
Engine.prototype.removeDemTile = function () {};
