# The SpaceXR Project

## Overview

Welcome to the SpaceXR Project - an innovative venture into the realm of 3D terrain rendering within the WebXR environment. Our mission is to revolutionize the way we interact with geographic data by bringing a comprehensive, immersive, and holographic approach to both 2D and 3D mapping.

## Building

1. First install the dependencies of the root package.

```bash
npm install
```

2. Link package @dev/buildTools to the local version. This only has to be done once, for fresh copies of the project.

```bash
cd packages/dev/babylon
npm link ../buildTools
```

3. Then navigate back to the root folder and build the buildTools.

```bash
npm run build:buildTools
```
4. Build the core package.

```
npm run build:core
```

5. Finally, build the babylon package.
```
npm run build:babylon
```

Alternatively, you may use `npm run build:all` to execute all the commands above in the main folder. You'll still have
to proceed to the link phase before the first build.

## Features

-   **Worldwide 3D Terrain Rendering**: Leveraging cutting-edge WebXR technology, SpaceXR renders detailed and accurate 3D representations of terrain across the globe.
-   **2D and 3D Mapping**: Our platform supports both traditional 2D mapping and advanced 3D models, providing a versatile toolkit for various applications, from education to professional GIS analysis.
-   **Holographic Content**: SpaceXR introduces an innovative "holographic" content approach, allowing users to engage with 3D terrain models in an interactive and immersive manner.
-   **Immersive World Experience**: Experience a true-to-life representation of the world in a fully immersive environment, where you can explore, analyze, and interact with the terrain like never before.

## Technologies

-   **WebXR**: Utilizing the latest WebXR standards for high performance and cross-platform compatibility.
-   **3D Rendering**: Advanced 3D rendering techniques to accurately represent terrain contours and features (using, but not limited to, Babylonjs)
-   **Data Integration**: Seamless integration with Data source such OSM for accurate and comprehensive mapping data.
-   **WEB Maps**: use of any available 2D and 3D web map's

## Documentations

**Introduction to the Web Tile Interface Pipeline**

In the realm of modern web mapping, the efficiency and precision of how map data is handled and displayed are paramount. Our web tile interface pipeline stands as a testament to this, embodying a sophisticated system that ensures seamless and dynamic map rendering. This pipeline is a complex orchestration of various components, each with its unique role in the process of fetching, processing, and displaying map tiles. From the foundational Tile Metrics, which define the geographic and resolution parameters, to the TileConsumer, responsible for the final rendering of the map data, each component works in harmony to create an intuitive and responsive user experience. We invite you to explore a detailed overview of each component in our [pipeline](./docs/tile_pipeline.md), where the intricate functionalities and interactions are elaborated.

## Contributing

Contributions to the SpaceXR project are welcome! If you're interested in contributing, please read our [contributing guidelines](./contributing.md) to learn more about how to get started.

## Contact

For more information or inquiries about the SpaceXR project, please contact us at [gaume.pelletier@gmail.com].
