"""Decode one NASA SLDEM2015 JPEG2000 elevation image to little-endian Float32."""

from __future__ import annotations

import os
import sys

import numpy as np
from PIL import Image


def main() -> None:
    if len(sys.argv) != 7:
        raise SystemExit("usage: sldem2015-decode.py input.jp2 output.f32 width height scale offset")
    source, destination, width_text, height_text, scale_text, offset_text = sys.argv[1:]
    width, height = int(width_text), int(height_text)
    scale = float(scale_text)
    offset = float(offset_text)
    with Image.open(source) as image:
        image.load()
        values = np.asarray(image)
    if values.ndim != 2 or values.shape != (height, width):
        raise ValueError(f"Expected a {width}x{height} single-band raster, got {values.shape}")
    if values.dtype.kind not in ("i", "u", "f"):
        raise TypeError(f"Unsupported JPEG2000 sample dtype: {values.dtype}")
    output = np.asarray(values, dtype=np.float32) * np.float32(scale) + np.float32(offset)
    output = output.astype("<f4", copy=False)
    if not np.isfinite(output).all():
        raise ValueError("SLDEM2015 source contains non-finite height samples")
    with open(destination, "wb") as stream:
        output.tofile(stream)
        stream.flush()
        os.fsync(stream.fileno())


if __name__ == "__main__":
    main()
