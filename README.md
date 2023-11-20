# The SpaceXR Project

## Overview

Welcome to the SpaceXR Project - an innovative venture into the realm of 3D terrain rendering within the WebXR environment. Our mission is to revolutionize the way we interact with geographic data by bringing a comprehensive, immersive, and holographic approach to both 2D and 3D mapping.

## Installation

The step for the intallation is important soplease follow the guideline below.npm install

```bash
npm install

cd packages/dev/buildTools

npm run build:build-tools

cd ..

npm run build:babylon:assets

npm run publish:babylon:dev

cd ../core

npm run build:core:dev

cd ../../..
```

Or if you prefer, you can write `npm run install:all` to execute all the commands above.

### Common Issues

> ERROR in export * from "./tilePoolTexture";

To resume this error, we must rename the file TilePoolTexture.ts to [tilePoolTexture.tsx](packages\dev\babylon\src\materials\textures).

> ERROR in export * from "./mapControl";

To resume this error, we must rename the file MapControl.ts to [mapControl.tsx](packages\dev\babylon\src\gui\2D\).

> ERROR in npm run install:babylon
> npm ERR!   in workspace: spacexr-babylon@1.0.0
> npm ERR!   at location: D:\DotVision\Documents\SpaceXR\packages\dev\babylon

To resume this error, we must run the command in the folder packages/dev/babylon : `npm install path-scurry`

## Features

- **Worldwide 3D Terrain Rendering**: Leveraging cutting-edge WebXR technology, SpaceXR renders detailed and accurate 3D representations of terrain across the globe.
- **2D and 3D Mapping**: Our platform supports both traditional 2D mapping and advanced 3D models, providing a versatile toolkit for various applications, from education to professional GIS analysis.
- **Holographic Content**: SpaceXR introduces an innovative "holographic" content approach, allowing users to engage with 3D terrain models in an interactive and immersive manner.
- **Immersive World Experience**: Experience a true-to-life representation of the world in a fully immersive environment, where you can explore, analyze, and interact with the terrain like never before.

## Technologies

- **WebXR**: Utilizing the latest WebXR standards for high performance and cross-platform compatibility.
- **3D Rendering**: Advanced 3D rendering techniques to accurately represent terrain contours and features (using, but not limited to, Babylonjs)
- **Data Integration**: Seamless integration with Data source such OSM for accurate and comprehensive mapping data.
- **WEB Maps**: use of any available 2D and 3D web map's

## Contributing

Contributions to the SpaceXR project are welcome! If you're interested in contributing, please read our contributing guidelines (link to guidelines).

## Contact

For more information or inquiries about the SpaceXR project, please contact us at [gaume.pelletier@gmail.com].
