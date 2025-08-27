export class PathUtils {
    public static SplitRootAndFile(url: string): { rootUrl: string; fileName: string } {
        const u = new URL(url);
        const i = u.pathname.lastIndexOf("/");
        const dir = i >= 0 ? u.pathname.substring(0, i + 1) : "/";
        const file = u.pathname.substring(i + 1);
        return { rootUrl: u.origin + dir, fileName: file + u.search + u.hash };
    }

    public static EndsWith(u: string, ...pattern: string[]): u is string {
        if (!u) return false;
        const path = u.split(/[?#]/)[0].toLowerCase();
        for (const p in pattern) {
            if (path.endsWith(p)) {
                return true;
            }
        }
        return false;
    }
    public static IsRelativeUrl(u: string): boolean {
        try {
            // If it can be parsed without a base, it's absolute
            new URL(u);
            return false;
        } catch {
            // If parsing fails, it's relative
            return true;
        }
    }

    public static GetBaseUrl(absoluteUrl: string): string {
        const url = new URL(absoluteUrl);
        // Remove the last segment (the file name)
        url.pathname = url.pathname.replace(/\/[^/]*$/, "/");
        return url.toString();
    }

    // Utility: normalize/resolve a possibly relative URI against a base URL.
    public static ResolveUri(baseUrl: string, uri: string): string {
        try {
            return new URL(uri, baseUrl).toString();
        } catch {
            // Fallback: naive join
            const sep = baseUrl.endsWith("/") ? "" : "/";
            return baseUrl + sep + uri;
        }
    }
}
