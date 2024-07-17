/* eslint-disable no-undef */
const path = require("path");
const config = require("./package.json");

module.exports = [
    {
        entry: {
            spacexr_vector: path.resolve(__dirname, "./dist/index.js"),
        },
        devtool: "source-map",
        output: {
            library: "SPACEXR_MAPBOX",
            libraryTarget: "var",
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
