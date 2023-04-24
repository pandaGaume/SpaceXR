import * as fs from "fs";
import * as crypto from "crypto";

const filterDashes = (str: string) => {
    let index = 0;
    while (str[index] === "-") {
        index++;
    }
    return str.substring(index);
};

export const checkArgs = (testArgument: string | string[], checkOnly = false, requiredIfSet = false): string | boolean => {
    const args = process.argv.slice(2);
    const index = typeof testArgument === "string" ? args.indexOf(testArgument) : testArgument.map((arg) => args.indexOf(arg)).find((idx) => idx !== -1);
    const envValue =
        typeof testArgument === "string"
            ? process.env[filterDashes(testArgument).toUpperCase().replace(/-/g, "_")]
            : testArgument.map((arg) => process.env[filterDashes(arg).toUpperCase().replace(/-/g, "_")]).filter((str) => !!str)[0];
    if (index === -1 || index === undefined) {
        // is it defined in the .env file?
        if (envValue) {
            return envValue;
        }
        return checkOnly ? false : "";
    } else {
        if (!checkOnly) {
            const returnValue = args[index + 1] && args[index + 1][0] !== "-" ? args[index + 1] : "";
            if (requiredIfSet && !returnValue) {
                return false;
            } else {
                return returnValue || true;
            }
        } else {
            return true;
        }
    }
};

export function checkDirectorySync(directory: string) {
    try {
        fs.statSync(directory);
    } catch (e) {
        fs.mkdirSync(directory, { recursive: true });
    }
}

export const getHashOfFile = (filePath: string) => {
    const content = fs.readFileSync(filePath, "utf8");
    return getHashOfContent(content);
};

export const getHashOfContent = (content: string) => {
    const md5sum = crypto.createHash("md5");
    md5sum.update(content);
    return md5sum.digest("hex");
};
