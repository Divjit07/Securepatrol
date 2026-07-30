"""Screenshot the homepage's no-canvas path: narrow viewport and reduced motion.

    ./venv/bin/python scripts/shoot_home_fallback.py

Below `lg`, with `prefers-reduced-motion`, or with no WebGL, the evidence table
renders as ordinary markup — same screenshots, same documents, same words. That
path carries the whole story for those readers, so it gets looked at too.
"""

import glob
import os
import pathlib
import sys

from playwright.sync_api import sync_playwright

BASE = "http://localhost:5173/"
OUT = pathlib.Path(".shots/home")
OUT.mkdir(parents=True, exist_ok=True)

CACHE = os.path.expanduser("~/Library/Caches/ms-playwright")
CHROME = next(
    iter(sorted(glob.glob(f"{CACHE}/chromium-*/chrome-mac-*/*.app/Contents/MacOS/*"), reverse=True)),
    None,
)

CASES = [
    ("mobile", {"width": 430, "height": 932}, "no-preference"),
    ("reduced", {"width": 1440, "height": 900}, "reduce"),
]


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=CHROME,
            args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
        )
        for name, viewport, motion in CASES:
            page = browser.new_page(viewport=viewport, reduced_motion=motion)
            errors = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto(BASE, wait_until="networkidle")
            page.wait_for_timeout(2500)

            # The fallback list is the only place the paper stations exist as
            # real DOM, so frame the shot on those two documents.
            page.evaluate(
                """() => {
                  const sheets = document.querySelectorAll('#operations [aria-label*="incident report"]');
                  const el = sheets[sheets.length - 1];
                  if (el) el.scrollIntoView({ block: 'center' });
                }"""
            )
            page.wait_for_timeout(1200)
            page.screenshot(path=str(OUT / f"fallback-{name}.png"))
            print(f"{OUT}/fallback-{name}.png")

            for e in dict.fromkeys(errors):
                print("  ⚠", e[:220])
            page.close()
        browser.close()


if __name__ == "__main__":
    sys.exit(main())
