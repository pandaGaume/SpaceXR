import type { Config } from "jest";

/**
 * Root Jest configuration (referenced by the packages' "test" scripts as
 * `jest -c ../../../jest.config.ts`). Tests live in `packages/x/y/test/`
 * and import sources through relative paths.
 */
const config: Config = {
    preset: "ts-jest",
    testEnvironment: "node",
    roots: ["<rootDir>/packages"],
    testMatch: ["**/test/**/*.test.ts"],
    transform: {
        "^.+\\.ts$": [
            "ts-jest",
            {
                tsconfig: {
                    module: "commonjs",
                    target: "es2021",
                    moduleResolution: "node",
                    esModuleInterop: true,
                    skipLibCheck: true,
                    strict: true,
                    experimentalDecorators: true,
                },
            },
        ],
    },
};

export default config;
