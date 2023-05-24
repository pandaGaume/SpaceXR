/* eslint-disable no-undef */
const path = require("path");
const config = require("./package.json");

module.exports = [
    {
        entry: {
            spacexr: path.resolve(__dirname, "./dist/index.js"),
        },
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
    },
];
