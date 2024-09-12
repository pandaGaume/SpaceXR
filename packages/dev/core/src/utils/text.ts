export class TextUtils {
    public static DEFAULT_SEPARATOR = ".";

    public static BuildNameWithSuffix(name: string, suffix: string, separator?: string): string {
        return `${name}${separator ?? TextUtils.DEFAULT_SEPARATOR}${suffix}`;
    }
}
