/* eslint-disable no-undef */
const path = require("path");
const config = require("./package.json");

module.exports = [
    {
        entry: {
            shelly: path.resolve(__dirname, "dist/index.js"),
        },
        mode: "development",
        devtool: "source-map",
        output: {
            library: "SHELLY",
            libraryTarget: "var",
            filename: "[name]." + config.version + ".js",
            path: path.resolve(__dirname, "bundles"),
        },
        optimization: {
            minimize: true,
        },
    },
];
