/* eslint-disable no-undef */
const path = require("path");
const fs = require("fs");
const config = require("./package.json");

const crawlShaders = true;

// used to get shader generated files which are not included
// into the index files
function* getFilesFromDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
        const res = path.resolve(dir, e.name);
        if (e.isDirectory()) {
            yield* getFilesFromDir(res);
        } else {
            if (res.match(/.*\.js$/)) {
                yield res;
            }
        }
    }
}

// return the files list of interest
function* getFiles() {
    yield path.resolve(__dirname, "./dist/index.js");
}

module.exports = [
    {
        entry: {
            stellar_landscape_ui_xr: Array.from(getFiles()),
        },
        devtool: "source-map",
        output: {
            library: ["SPACEXR", "GUI"],
            libraryTarget: "var",
            filename: "[name]." + config.version + ".js",
            path: path.resolve(__dirname, "bundles"),
        },
        optimization: {
            minimize: false,
        },
        resolve: {
            alias: {
                core: `${__dirname}/../core/dist`,
            },
        },
        externals: [
            ({ request }, callback) => {
                if (request.match("^@babylonjs/core")) {
                    return callback(null, "BABYLON");
                }
                callback();
            },
            ({ request }, callback) => {
                if (request.match("^@babylonjs/gui")) {
                    return callback(null, "BABYLON.GUI");
                }
                callback();
            },
        ],
    },
];
