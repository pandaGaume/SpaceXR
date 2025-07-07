/* eslint-disable no-undef */
const path = require("path");
const config = require("./package.json");

module.exports = [
    {
        entry: {
            spacexr_cesium: path.resolve(__dirname, "./dist/index.js"),
        },
        devtool: "source-map",
        output: {
            library: ["SPACEXR", "Cesium"],
            libraryTarget: "assign", // <-- clé ici
            filename: "[name]." + config.version + ".js",
            path: path.resolve(__dirname, "bundles"),
        },
        optimization: {
            minimize: false,
        },
        externals: [
            ({ request }, callback) => {
                if (request.startsWith("core")) {
                    return callback(null, "SPACEXR");
                }
                callback();
            },
        ],
    },
];
