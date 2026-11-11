const path = require("path");

module.exports = (env, argv) => {
    const isProd = argv.mode === "production";
    return {
        entry: "./src/index.ts",
        output: {
            filename: "spikypanda-core.js",
            path: path.resolve(__dirname, "bundle"),
            library: "SpikypandaCore",
            libraryTarget: "umd",
            globalObject: "globalThis",
        },
        target: "web",
        devtool: isProd ? "source-map" : "inline-source-map",
        resolve: {
            extensions: [".ts", ".tsx", ".js"],
            fallback: {
                fs: false,
                path: false,
                zlib: false,
                https: false,
            },
        },
        module: {
            rules: [
                {
                    test: /\.tsx?$/,
                    loader: "ts-loader",
                    exclude: /node_modules/,
                    options: {
                        transpileOnly: true,
                        configFile: "tsconfig.build.json",
                        compilerOptions: {
                            experimentalDecorators: true,
                            emitDecoratorMetadata: true,
                        },
                    },
                },
            ],
        },
        externals: {},
    };
};
