"""Screenshot the Evidence Table at each station, for visual iteration.

    ./venv/bin/python scripts/shoot_home.py [n_frames] [only_frame ...]

`only_frame` indices are 1-based and let you re-shoot a single station while
tuning its camera, which under SwiftShader is the difference between 15 seconds
and 90.
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


def main():
    frames = int(sys.argv[1]) if len(sys.argv) > 1 else 6
    only = {int(a) for a in sys.argv[2:]}
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=CHROME,
            args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
        )
        page = browser.new_page(
            viewport={"width": 1440, "height": 900}, device_scale_factor=1
        )
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on(
            "console",
            lambda m: errors.append(f"console.{m.type}: {m.text}")
            if m.type in ("error", "warning")
            else None,
        )

        page.goto(BASE, wait_until="networkidle")
        page.wait_for_timeout(2500)
        page.screenshot(path=str(OUT / "00-hero.png"))

        box = page.evaluate(
            """() => {
              const t = document.querySelector('[data-evidence-track]');
              if (!t) return null;
              const r = t.getBoundingClientRect();
              return { top: r.top + window.scrollY, height: t.offsetHeight };
            }"""
        )
        if not box:
            print("!! evidence track not found (WebGL gate off?)")
        else:
            # The canvas only mounts once the track is near, and the first frame
            # after that pays for every shader compile in the room.
            page.evaluate(f"window.scrollTo(0, {box['top']})")
            page.wait_for_timeout(6000)
            for i in range(frames):
                if only and (i + 1) not in only:
                    continue
                t = i / (frames - 1) if frames > 1 else 0
                # Re-measure every frame: fonts and the fallback images settle
                # after the first read and push the track down by a screenful.
                page.evaluate(
                    """(t) => {
                      const el = document.querySelector('[data-evidence-track]');
                      const top = el.getBoundingClientRect().top + window.scrollY;
                      const span = el.offsetHeight - window.innerHeight;
                      window.scrollTo(0, top + t * span);
                    }""",
                    t,
                )
                # The stage eases toward the scroll position rather than
                # tracking it, and under SwiftShader gsap's lag smoothing makes
                # that take seconds — so wait on the eased value, not a clock.
                page.wait_for_timeout(600)
                try:
                    page.wait_for_function(
                        """(t) => {
                             const el = document.querySelector('[data-evidence-track]');
                             if (Math.abs(+el.dataset.p - t) > 0.004) return false;
                             return [...document.querySelectorAll('.kr-caption')].filter((c) => {
                               const cs = getComputedStyle(c.parentElement);
                               return cs.visibility !== 'hidden' && +cs.opacity > 0.995;
                             }).length === 1;
                           }""",
                        arg=t,
                        timeout=30000,
                    )
                except Exception:
                    print("      !! stage never settled on this station")
                # The paper stations repaint a 1000x1414 sheet and re-upload it
                # as a texture; under SwiftShader that runs seconds behind the
                # scrub, so give the document time to finish writing itself.
                page.wait_for_timeout(3000)
                state = page.evaluate(
                    """() => {
                      const t = document.querySelector('[data-evidence-track]');
                      const span = t.offsetHeight - window.innerHeight;
                      const p = -t.getBoundingClientRect().top / span;
                      const layers = [...document.querySelectorAll('.kr-caption')]
                        .map((c) => {
                          const cs = getComputedStyle(c.parentElement);
                          return { c, o: cs.visibility === 'hidden' ? 0 : +cs.opacity };
                        })
                        .filter((l) => l.o > 0.01)
                        .sort((a, b) => b.o - a.o);
                      const top = layers[0];
                      const cr = top && top.c.getBoundingClientRect();
                      const rail = [...document.querySelectorAll('#operations ol li span')]
                        .filter((s) => s.textContent.trim())
                        .map((s) => (s.style.background !== 'transparent' ? `[${s.textContent}]` : s.textContent))
                        .join(' ');
                      return {
                        p: +p.toFixed(3),
                        card: top ? top.c.querySelector('h3').textContent : 'MISSING',
                        box: cr
                          ? `${Math.round(cr.x)},${Math.round(cr.y)} ${Math.round(cr.width)}x${Math.round(cr.height)} op=${top.o.toFixed(2)} showing=${layers.length}`
                          : '-',
                        rail,
                      };
                    }"""
                )
                page.screenshot(path=str(OUT / f"{i + 1:02d}-station.png"))
                print(f"{OUT}/{i + 1:02d}-station.png   t={t:.2f}  p={state['p']}")
                print(f"      card: {state['card']}   {state['box']}")

        for e in dict.fromkeys(errors):
            print("  ⚠", e[:220])
        browser.close()


if __name__ == "__main__":
    sys.exit(main())
