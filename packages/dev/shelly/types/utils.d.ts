export declare class Utils {
    static DEBUG: boolean;
    static Assert(condition: boolean, opt_message: string): void;
    static Format(text: string, ...substitutions: string[]): string;
    static CreateCanvas(width: number, height: number): HTMLCanvasElement | undefined;
}
