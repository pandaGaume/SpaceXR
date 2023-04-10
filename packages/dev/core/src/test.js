import { createRequire } from "module";
const require = createRequire();
var fs = require("fs");

function readModuleFile(path, callback) {
    try {
        var filename = require.resolve(path);
        fs.readFile(filename, "utf8", callback);
    } catch (e) {
        callback(e);
    }
}

readModuleFile("./words.txt", function (err, words) {
    console.log(words);
});
