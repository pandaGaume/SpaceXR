export class TextUtils {
    public static DEFAULT_SEPARATOR = ".";

    public static BuildNameWithSuffix(name: string, suffix: string, separator?: string): string {
        return `${name}${separator ?? TextUtils.DEFAULT_SEPARATOR}${suffix}`;
    }

    public static GetUriExtension(uri: string): string | null {
        const lastDot = uri.lastIndexOf(".");
        return lastDot !== -1 ? uri.substring(lastDot + 1) : null;
    }
}
