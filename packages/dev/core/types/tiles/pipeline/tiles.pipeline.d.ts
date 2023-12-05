import { ITilePipelineComponent } from "./tiles.pipeline.interfaces";
export declare class TilePipelineComponent implements ITilePipelineComponent {
    _id: string;
    constructor(id: string);
    get id(): string;
    dispose(): void;
}
