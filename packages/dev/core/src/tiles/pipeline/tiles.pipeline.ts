import { ITilePipelineComponent } from "./tiles.pipeline.interfaces";

export class TilePipelineComponent implements ITilePipelineComponent {
    _id: string;

    public constructor(id: string) {
        this._id = id;
    }

    public get id(): string {
        return this._id;
    }

    public dispose(): void {}
}
