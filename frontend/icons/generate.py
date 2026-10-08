#!/usr/bin/env python3
"""Generate PWA icons for the NBA frontend from assets/logo.js (base64 JPEG).

Usage:  python3 generate.py        # run from frontend/icons/
Output: icon-192.png, icon-512.png, maskable-512.png, apple-touch-icon.png
Requires: Pillow (pip install Pillow) + numpy
"""
import base64
import io
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
FRONTEND = HERE.parent


def load_logo():
    s = (FRONTEND / 'assets' / 'logo.js').read_text(encoding='utf-8')
    m = re.search(r'data:image/\w+;base64,([A-Za-z0-9+/=]+)', s)
    if not m:
        sys.exit('logo data URI not found in assets/logo.js')
    from PIL import Image
    return Image.open(io.BytesIO(base64.b64decode(m.group(1)))).convert('RGB')


def trim_white(img):
    import numpy as np
    from PIL import Image
    a = np.asarray(img.convert('L'))
    ys, xs = __import__('numpy').where(a < 245)
    return img.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))


def fit_square(img, size, bg=(255, 255, 255), pad=0.12):
    from PIL import Image
    c = Image.new('RGB', (size, size), bg)
    w = int(size * (1 - pad * 2))
    r = img.copy()
    r.thumbnail((w, w), Image.LANCZOS)
    c.paste(r, ((size - r.width) // 2, (size - r.height) // 2))
    return c


def main():
    from PIL import Image, ImageDraw
    mark = trim_white(load_logo())
    fit_square(mark, 192).save(HERE / 'icon-192.png')
    fit_square(mark, 512).save(HERE / 'icon-512.png')
    fit_square(mark, 180).save(HERE / 'apple-touch-icon.png')
    s = 512
    bg = Image.new('RGB', (s, s), (30, 107, 56))
    tile = int(s * 0.72)
    mask = Image.new('L', (tile, tile), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, tile, tile], radius=int(tile * 0.24), fill=255)
    inner = fit_square(mark, tile, pad=0.14)
    bg.paste(inner, ((s - tile) // 2, (s - tile) // 2), mask)
    bg.save(HERE / 'maskable-512.png')
    print('icons written to', HERE)


if __name__ == '__main__':
    main()
