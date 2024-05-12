/* eslint-disable no-undef */
const path = require("path");
const config = require("./package.json");

module.exports = [
    {
        entry: {
            spacexr_babylon_ext: path.resolve(__dirname, "./dist/index.js"),
        },
        devtool: "source-map",
        output: {
            library: ["BABYLON", "EXT"],
            libraryTarget: "var",
            filename: "[name]." + config.version + ".js",
            path: path.resolve(__dirname, "bundles"),
        },
        optimization: {
            minimize: false,
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
