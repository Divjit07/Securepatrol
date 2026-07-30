"""Capture product screenshots for the marketing homepage from the dev harnesses.

Run with the repo venv while `npm run dev` is up:
    ./venv/bin/python scripts/shoot_portals.py

Writes raw PNGs to .shots/ — these get cropped/optimised into public/shots/ separately.
"""

import glob
import os
import pathlib
import sys

from playwright.sync_api import sync_playwright

BASE = "http://localhost:5173"
OUT = pathlib.Path(".shots")
OUT.mkdir(exist_ok=True)

# The venv interpreter is x86_64, so Playwright resolves a mac-x64 browser path
# that does not exist — the cached builds are arm64. Point it at one directly.
CACHE = os.path.expanduser("~/Library/Caches/ms-playwright")
CHROME = next(
    iter(sorted(glob.glob(f"{CACHE}/chromium-*/chrome-mac-*/*.app/Contents/MacOS/*"), reverse=True)),
    None,
)
if not CHROME:
    sys.exit(f"no cached chromium under {CACHE}")

TARGETS = [
    # name,              path,           width, height, scale, full_page
    ("client-laptop", "/dev/client", 1440, 900, 2, False),
    ("client-laptop-full", "/dev/client", 1440, 900, 2, True),
    ("client-mobile", "/dev/client", 390, 844, 3, False),
    ("admin-laptop", "/dev/admin", 1440, 900, 2, False),
    ("admin-laptop-full", "/dev/admin", 1440, 900, 2, True),
    ("roster-laptop", "/dev/roster", 1440, 900, 2, False),
]


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME)
        for name, path, w, h, scale, full in TARGETS:
            page = browser.new_page(
                viewport={"width": w, "height": h}, device_scale_factor=scale
            )
            page.goto(f"{BASE}{path}", wait_until="networkidle")
            page.wait_for_timeout(1800)
            dest = OUT / f"{name}.png"
            page.screenshot(path=str(dest), full_page=full)
            print(f"{dest}  {w}x{h}@{scale}x{'  full' if full else ''}")
            page.close()
        browser.close()


if __name__ == "__main__":
    sys.exit(main())
