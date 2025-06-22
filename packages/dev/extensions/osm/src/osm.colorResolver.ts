import { RGBAColor } from "core/math";

export class ColorResolver {
    constructor(public readonly defaultColor: RGBAColor, public readonly colorMap: Map<string, string>) {}

    /// <summary>
    /// Returns a <b>new instance</b> of <c>RGBAColor</c> for a given key.
    /// </summary>
    /// <param name="key">The color key. This can be a color name, a hexadecimal color code, or a reference to another key.</param>
    /// <remarks>
    /// <list type="bullet">
    /// <item>
    /// If the key starts with <c>#</c>, it is treated as a hex color code.
    /// </item>
    /// <item>
    /// If the key starts with <c>@</c>, it is treated as a reference to another color key.
    /// </item>
    /// <item>
    /// If the key is not found in the color map, the default color is returned.
    /// </item>
    /// </list>
    /// </remarks>
    getColor(key: string): RGBAColor {
        let v = this.colorMap.get(key);
        if (v) {
            switch (v[0]) {
                case "#":
                    return RGBAColor.Parse(v);
                case "@":
                    return this.getColor(v.substring(1));
                default:
                    return new RGBAColor(RGBAColor.CSSMap.get(v) ?? this.defaultColor);
            }
        }
        return new RGBAColor(this.defaultColor);
    }
}
