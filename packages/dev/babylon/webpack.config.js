/* eslint-disable no-undef */
const path = require("path");
const config = require("./package.json");

module.exports = [
    {
        entry: {
            stellar_landscape_xr: path.resolve(__dirname, "./dist/index.js"),
        },
        mode: "development",
        devtool: "source-map",
        output: {
            library: "SPACEXR",
            libraryTarget: "var",
            filename: "[name]." + config.version + ".js",
            path: path.resolve(__dirname, "bundles"),
        },
        optimization: {
            minimize: false,
        },
        resolve: {
            alias: {
                "@dev/core/src": `${__dirname}/../core/dist`,
            },
        },
        externals: [
            ({ request }, callback) => {
                if (request.match("^@babylonjs/core")) {
                    return callback(null, "BABYLON");
                }
                callback();
            },
        ],
    },
];
