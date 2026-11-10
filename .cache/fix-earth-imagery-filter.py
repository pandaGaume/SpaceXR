from pathlib import Path
p=Path('C:/Users/GuillaumePelletier/Documents/GitHub/Gaume/spacexr-rendering/examples/babylon-earth/src/imagery.ts')
s=p.read_text(encoding='utf-8').replace('import { createRasterGrid }','import { createRasterGrid, sampleRasterBilinear }')
s=s.replace('    const tileSize = 128;', '''    // Wrap the equirectangular source across the dateline before using the shared area-registered sampler.
    const paddedWidth = image.width + 2;
    const padded = new Uint8ClampedArray(paddedWidth * image.height * 4);
    for (let y = 0; y < image.height; y++) {
        const row = y * image.width * 4;
        const target = y * paddedWidth * 4;
        padded.set(source.data.subarray(row + (image.width - 1) * 4, row + image.width * 4), target);
        padded.set(source.data.subarray(row, row + image.width * 4), target + 4);
        padded.set(source.data.subarray(row, row + 4), target + (paddedWidth - 1) * 4);
    }
    const raster = createRasterGrid(paddedWidth, image.height, 4, padded);
    const tileSize = 128;''')
s=s.replace('                const sy = Math.min(image.height - 1, Math.max(0, Math.floor((0.5 - latitude / Math.PI) * image.height)));','                const v = 0.5 - latitude / Math.PI;')
a=s.index('                    const sx = Math.floor(');b=s.index('                    data[to + 3] = 255;',a)
s=s[:a]+'''                    const longitude = (address.x + (x + 0.5) / tileSize) / scale;
                    const u = (((longitude % 1) + 1) % 1 * image.width + 1) / paddedWidth;
                    const to = (y * tileSize + x) * 4;
                    for (let channel = 0; channel < 3; channel++)
                        data[to + channel] = Math.round(sampleRasterBilinear(raster, u, v, channel, "area"));
'''+s[b:]
p.write_text(s,encoding='utf-8')
p=p.parent.parent/'README.md';s=p.read_text(encoding='utf-8');s+='\nThe offline orbital map is 2048 by 1024 pixels. Reprojection uses the shared raster bilinear sampler with area registration and wrapped dateline neighbors. Higher tile LODs interpolate that source continuously; they do not create additional geographic detail.\n';p.write_text(s,encoding='utf-8')
