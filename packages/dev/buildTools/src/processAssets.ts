import * as glob from "glob";
import * as path from "path";
import { checkArgs } from "./utils";
import { buildShaders } from "./buildShaders";

const KnownAssetsExtensions = ["glsl", "wgsl", "fx"];

export async function processAssets(options: { extensions: string[] } = { extensions: KnownAssetsExtensions }): Promise<number> {
    // select file extensions
    const fileTypes = checkArgs(["--file-types", "-ft"], false, true);
    const extensions = fileTypes && typeof fileTypes === "string" ? fileTypes.split(",") : options.extensions;
    const pathPrefix = (checkArgs("--path-prefix", false, true) as string) || "";
    const isVerbose = checkArgs("--verbose", true);

    // Match files using the patterns the shell uses.
    const globDirectory = pathPrefix + `./src/**/*.+(${extensions.join("|")})`;

    const paths = await glob.glob(globDirectory);
    isVerbose && console.log(`founds ${paths.length} files(s) to process within ${globDirectory} from ${process.cwd()}`);
    paths.forEach((path) => {
        processFile(path);
    });

    return Promise.resolve(0);
}

export function processFile(file: string) {
    var ext = path.extname(file);
    if (ext.startsWith(".")) {
        ext = ext.slice(1);
    }
    if (KnownAssetsExtensions.includes(ext)) {
        buildShaders(file);
    }
}
