# spacexr

Support for space and terrain rendering.

## Building

1. Build the build-tools by running the following command from packages/dev/build-tools

`npm run build:build-tools`

2. Link @dev/build-tools to the local package (from packages/dev/build-tools again).

`npm link @dev/build-tools`

3. Build the core package.

`npm run build:core:dev`

4. Build the babylon package.

`npm run publish:babylon:dev`
