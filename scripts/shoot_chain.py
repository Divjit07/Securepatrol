"""Screenshot the chain-of-custody section as it scrolls, for visual iteration.

    ./venv/bin/python scripts/shoot_chain.py

Writes .shots/home/chain-{0..3}.png at four depths through the section and
reports which nodes have set, so the scrubbed line and the `is-on` toggles can
be checked without clicking through the page by hand.
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

DEPTHS = [0.0, 0.28, 0.56, 0.84]


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=CHROME,
            args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
        )
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))

        page.goto(BASE, wait_until="networkidle")
        page.wait_for_timeout(2000)

        top = page.evaluate(
            "() => document.querySelector('#record').getBoundingClientRect().top + window.scrollY"
        )
        height = page.evaluate("() => document.querySelector('#record').offsetHeight")
        print(f"chain section: {height}px")

        for i, frac in enumerate(DEPTHS):
            page.evaluate(f"window.scrollTo(0, {top} + {frac} * {height})")
            page.wait_for_timeout(1600)
            page.screenshot(path=str(OUT / f"chain-{i}.png"))
            print(f"{OUT}/chain-{i}.png   depth={frac:.2f}")

        lit = page.evaluate(
            """() => [...document.querySelectorAll('[data-chain-link]')]
                 .map((l) => l.classList.contains('is-on'))"""
        )
        print("nodes set:", lit)

        for e in dict.fromkeys(errors):
            print("  ⚠", e[:220])
        browser.close()


if __name__ == "__main__":
    sys.exit(main())
