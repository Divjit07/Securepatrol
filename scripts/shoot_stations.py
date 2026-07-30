"""Capture the guard and paperwork screens the Evidence Table stations need.

Run with the repo venv while `npm run dev` is up:
    ./venv/bin/python scripts/shoot_stations.py

Writes raw PNGs to .shots/ — optimised into public/shots/ separately.
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

PHONE = (380, 825, 3)
LAPTOP = (1440, 900, 2)

# The incident form is only worth a screenshot with something typed in it, so
# the guard's account of the night is filled the way a guard would fill it.
INCIDENT_TEXT = (
    "Loading dock roll-up door found unsecured on round 3 — latch had not engaged and it "
    "was sitting about four inches open. Swept the dock and the corridor, nothing "
    "disturbed, no persons on site. Closed it and re-scanned the dock checkpoint."
)

TARGETS = [
    # name, path, viewport, fill(selector, text), scroll_to(selector)
    ("guard-dashboard", "/dev/guard", PHONE, None, None),
    ("guard-incident", "/dev/guard?view=incident", PHONE, INCIDENT_TEXT, None),
    ("report-scans", "/dev/reports", LAPTOP, None, None),
    ("report-hours", "/dev/reports?view=hours", LAPTOP, None, None),
    ("client-incident", "/dev/reports?view=incident", LAPTOP, None, None),
]


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME)
        for name, path, (w, h, scale), fill, _ in TARGETS:
            page = browser.new_page(
                viewport={"width": w, "height": h},
                device_scale_factor=scale,
                color_scheme="dark",
            )
            page.goto(f"{BASE}{path}", wait_until="networkidle")
            page.wait_for_timeout(1200)
            if fill:
                page.fill("textarea", fill)
                # fill() leaves the caret at the end, which scrolls the first
                # lines of the report out of the box.
                page.eval_on_selector("textarea", "el => { el.scrollTop = 0 }")
                page.wait_for_timeout(500)
            dest = OUT / f"{name}.png"
            page.screenshot(path=str(dest))
            print(f"{dest}  {w}x{h}@{scale}x")
            page.close()
        browser.close()


if __name__ == "__main__":
    sys.exit(main())
