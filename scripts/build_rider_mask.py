#!/usr/bin/env python3
"""Compose the final horse+rider+flag matte for the Kronus mark.

Vision's instance mask (scripts/subject_lift.swift) nails the horse and rider but
drops the Nishan Sahib: the flag is a separate object it does not consider part
of the subject, and the silver spear blade is the same value as the sky. So the
matte is a union of three passes:

  1. Vision subject mask      — horse, rider, saddle, sword, cape
  2. navy colour key          — the flag, with its light Khanda emblem holes filled
  3. dark-run trace           — the pole/spear silhouette above the flag

    python3 scripts/build_rider_mask.py source.jpg vision_mask.png out_rgba.png
"""
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

# Flag/pole geometry, measured off the 1792x2400 source.
FLAG_TOP, FLAG_BOTTOM = 600, 1180
POLE_TOP, POLE_BOTTOM = 452, 1180
POLE_HALF_WIDTH = 13


def pole_x(y):
    """The pole leans slightly right as it descends (measured at the flag edge)."""
    return 678 + (y - 650) * 0.036


def navy_key(src, lo=FLAG_TOP, hi=FLAG_BOTTOM, x_max=1420):
    """The flag's deep blue, which nothing in the sandstone background matches."""
    w, h = src.size
    out = Image.new("L", (w, h), 0)
    sp, op = src.load(), out.load()
    for y in range(lo, min(hi, h)):
        for x in range(560, min(x_max, w)):
            r, g, b = sp[x, y]
            if b - r > 6 and max(r, g, b) < 150:
                op[x, y] = 255
    return out


def pole_trace(src):
    """The pole and spear read as a dark NEUTRAL line. The neutrality test matters:
    where the pole crosses the dome, the sandstone behind it is a similar value but
    distinctly warm (r-b ≈ 33), and without it the dome's edge rides along as a
    tan ribbon beside the pole."""
    w, h = src.size
    out = Image.new("L", (w, h), 0)
    sp, op = src.load(), out.load()
    for y in range(POLE_TOP, min(POLE_BOTTOM, h)):
        cx = int(pole_x(y))
        for x in range(max(0, cx - POLE_HALF_WIDTH), min(w, cx + POLE_HALF_WIDTH)):
            r, g, b = sp[x, y]
            if max(r, g, b) < 170 and abs(r - b) < 24:
                op[x, y] = 255
    return out


def keep_large_components(mask, min_area=20000):
    """Drop islands — stray fragments of dome edge that survived the colour keys.
    The subject is one connected mass (pole touches flag touches rider touches
    horse), so anything small and detached is an artefact."""
    w, h = mask.size
    px = mask.load()
    seen = bytearray(w * h)
    out = Image.new("L", (w, h), 0)
    op = out.load()

    for sy in range(h):
        for sx in range(w):
            if seen[sy * w + sx] or px[sx, sy] <= 128:
                continue
            # Iterative flood fill; recursion would blow the stack at this size.
            stack = [(sx, sy)]
            seen[sy * w + sx] = 1
            blob = []
            while stack:
                x, y = stack.pop()
                blob.append((x, y))
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and px[nx, ny] > 128:
                        seen[ny * w + nx] = 1
                        stack.append((nx, ny))
            if len(blob) >= min_area:
                for x, y in blob:
                    op[x, y] = 255
    return out


def fill_holes(mask):
    """Close interior holes (the flag's light emblem) without touching the outline."""
    w, h = mask.size
    inv = ImageChops.invert(mask)
    flood = inv.copy()
    # Anything reachable from the border is genuine background.
    for seed in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        ImageDraw.floodfill(flood, seed, 0, thresh=8)
    holes = flood.point(lambda p: 255 if p > 128 else 0)
    return ImageChops.lighter(mask, holes)


def main():
    src_path, vision_path, out_path = (Path(p) for p in sys.argv[1:4])
    src = Image.open(src_path).convert("RGB")
    vision = Image.open(vision_path).convert("L").resize(src.size, Image.LANCZOS)

    flag = fill_holes(navy_key(src))
    # Knit the keyed flag together before filling so thin ripples stay connected.
    flag = flag.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5))
    flag = fill_holes(flag)

    pole = pole_trace(src)
    pole = pole.filter(ImageFilter.MaxFilter(3))

    combined = ImageChops.lighter(ImageChops.lighter(vision, flag), pole)
    combined = combined.filter(ImageFilter.MedianFilter(3))
    # Morphological opening drops stray specks the colour keys picked out of the
    # sky; the pole is wide enough to survive it.
    combined = combined.filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MaxFilter(5))
    combined = keep_large_components(combined)
    combined = combined.filter(ImageFilter.GaussianBlur(0.8))

    rgba = src.convert("RGBA")
    rgba.putalpha(combined)
    box = combined.point(lambda p: 255 if p > 8 else 0).getbbox()
    rgba = rgba.crop(box)
    rgba.save(out_path)
    print(f"matte → {out_path}  {rgba.width}x{rgba.height}  (crop {box})")


if __name__ == "__main__":
    main()
