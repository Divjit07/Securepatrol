#!/usr/bin/env python3
"""Build every Kratos brand asset from one source artwork.

The source is a tall portrait painting (rearing horse + rider). Logo slots in the
app are square, so the horse/rider is fitted into a square badge WITHOUT being
stretched or re-drawn — the artwork's proportions are preserved exactly, only
scaled and padded.

    python3 scripts/build_brand_assets.py path/to/rider.png [--treatment badge|cutout]

Writes:
    public/brand/kratos-rider.png   1024 master (transparent for cutout)
    public/logo.png                 512  (PDF/paystub/invoice + manifest)
    public/icons/icon-512.png       512  maskable (extra safe-area padding)
    public/icons/icon-192.png       192  maskable
    public/apple-touch-icon.png     180
    public/favicon-32.png           32   (simplified, high contrast)
    public/favicon.svg              svg wrapper around a 96px raster
"""
import argparse
import base64
import io
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"

# Dark Ops badge tokens (mirrors public/favicon.svg + src/index.css).
BADGE_BG = (20, 26, 20, 255)      # #141a14
BADGE_RING = (150, 238, 96)       # #96ee60
RADIUS_RATIO = 0.22               # squircle corner radius as a share of the side
TIGHT_TOP = 0.37                  # favicon crop: drop the flag, keep horse + rider


def has_alpha(img):
    """True when the source is already matted (build_rider_mask.py output)."""
    if img.mode != "RGBA":
        return False
    lo, hi = img.getchannel("A").getextrema()
    return lo < 250


def trim_border(img, tolerance=12):
    """Drop uniform letterboxing so the subject fills the frame. A matted source
    is trimmed by its alpha instead — its transparent pixels still carry the
    original RGB, so a colour-difference trim would read them as content."""
    if has_alpha(img):
        box = img.getchannel("A").point(lambda p: 255 if p > 8 else 0).getbbox()
        return img.crop(box) if box else img
    rgb = img.convert("RGB")
    bg = Image.new("RGB", rgb.size, rgb.getpixel((0, 0)))
    diff = ImageChops.difference(rgb, bg).convert("L").point(lambda p: 255 if p > tolerance else 0)
    box = diff.getbbox()
    return img.crop(box) if box else img


def cutout(img, tolerance=42, feather=1.4):
    """Knock out the sky/ground by flood-filling from the border colours.

    Deliberately conservative: it never touches pixels that differ strongly from
    the sampled background, so the horse and rider silhouette stays intact even
    where the ground tone comes close to the horse's coat.
    """
    img = img.convert("RGBA")
    w, h = img.size
    mask = Image.new("L", (w, h), 0)  # 0 = keep, 255 = erase
    work = img.convert("RGB")

    seeds = [(1, 1), (w - 2, 1), (w // 2, 1), (1, h // 2), (w - 2, h // 2)]
    filled = work.copy()
    for seed in seeds:
        ImageDraw.floodfill(filled, seed, (255, 0, 255), thresh=tolerance)

    magenta = Image.new("RGB", (w, h), (255, 0, 255))
    hit = ImageChops.difference(filled, magenta).convert("L").point(lambda p: 255 if p < 10 else 0)
    mask = ImageChops.lighter(mask, hit)
    mask = mask.filter(ImageFilter.GaussianBlur(feather))

    alpha = img.getchannel("A")
    alpha = ImageChops.subtract(alpha, mask)
    img.putalpha(alpha)
    return trim_border(img)


def squircle_mask(size, radius_ratio=RADIUS_RATIO, supersample=4):
    big = size * supersample
    mask = Image.new("L", (big, big), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, big - 1, big - 1], radius=int(big * radius_ratio), fill=255
    )
    return mask.resize((size, size), Image.LANCZOS)


def fit_contain(art, box):
    """Scale to fit inside box preserving aspect ratio — never crops or stretches."""
    art = art.copy()
    art.thumbnail((box, box), Image.LANCZOS)
    return art


def badge(art, size, pad_ratio=0.12, ring=True, bg=True):
    """Artwork centred on the Dark Ops squircle. Aspect ratio untouched."""
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    if bg:
        plate = Image.new("RGBA", (size, size), BADGE_BG)
        canvas.paste(plate, (0, 0), squircle_mask(size))

    inner = int(size * (1 - pad_ratio * 2))
    fitted = fit_contain(art, inner)
    canvas.alpha_composite(fitted, ((size - fitted.width) // 2, (size - fitted.height) // 2))

    if bg:
        canvas.putalpha(ImageChops.multiply(canvas.getchannel("A"), squircle_mask(size)))

    if ring and bg:
        ring_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        inset = max(1, int(size * 0.02))
        ImageDraw.Draw(ring_layer).rounded_rectangle(
            [inset, inset, size - inset - 1, size - inset - 1],
            radius=int(size * RADIUS_RATIO * 0.92),
            outline=BADGE_RING + (115,),
            width=max(1, int(size * 0.028)),
        )
        canvas.alpha_composite(ring_layer)

    return canvas


def save(img, path, size=None):
    out = img if size is None else img.resize((size, size), Image.LANCZOS)
    path.parent.mkdir(parents=True, exist_ok=True)
    out.save(path, "PNG", optimize=True)
    print(f"  {path.relative_to(ROOT)}  {out.width}x{out.height}  {path.stat().st_size // 1024}KB")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("source", type=Path)
    ap.add_argument("--treatment", choices=("badge", "cutout", "matted"), default="badge",
                    help="matted = source already carries an alpha channel")
    ap.add_argument("--tolerance", type=int, default=42, help="cutout background tolerance")
    args = ap.parse_args()

    if not args.source.exists():
        sys.exit(f"source not found: {args.source}")

    art = Image.open(args.source).convert("RGBA")
    art = trim_border(art)
    print(f"source {args.source.name}  {art.width}x{art.height}  treatment={args.treatment}")

    if args.treatment == "cutout":
        art = cutout(art, tolerance=args.tolerance)
        print(f"  cut out → {art.width}x{art.height}")

    # At 32px the full composition (flag included) collapses into a smudge, so the
    # favicon uses a tight crop of horse + rider that fills the tile instead. The
    # subject sits in the lower ~63% of the frame, below the flag.
    tight = art.crop((0, int(art.height * TIGHT_TOP), art.width, art.height))

    # Master: transparent, no plate, so it can sit on any surface.
    master = badge(art, 1024, pad_ratio=0.04, ring=False, bg=False)
    save(master, PUBLIC / "brand" / "kronus-rider.png")
    # Un-squared master too: the marketing lockup wants the true portrait ratio.
    tall = art.copy()
    tall.thumbnail((1024, 1024), Image.LANCZOS)
    save(tall, PUBLIC / "brand" / "kronus-rider-tall.png")

    plated = badge(art, 1024, ring=False)
    save(plated, PUBLIC / "logo.png", 512)
    save(plated, PUBLIC / "apple-touch-icon.png", 180)

    # Anything rendered at 48px or below (favicon, sidebar tile, the 18mm PDF
    # header block) gets the tight crop — at that size the full composition is
    # mostly flag and the horse disappears.
    tiny = badge(tight, 1024, pad_ratio=0.06, ring=False)
    save(tiny, PUBLIC / "brand" / "kronus-mark.png", 512)
    save(tiny, PUBLIC / "favicon-32.png", 32)

    # Maskable icons need the subject inside a 80% safe area.
    maskable = badge(art, 1024, pad_ratio=0.19, ring=False)
    save(maskable, PUBLIC / "icons" / "icon-512.png", 512)
    save(maskable, PUBLIC / "icons" / "icon-192.png", 192)

    # Alpha-only silhouettes. Used as a CSS mask so the mark takes `currentColor`
    # exactly like the outgoing eagle glyph did — lime on the dark masthead, ink
    # on the light paper documents, one asset for both.
    # White (not black) so the same file serves a CSS mask, which keys on alpha,
    # AND an SVG <mask>, which keys on luminance.
    for name, source in (("kronus-rider-mask.png", art), ("kronus-rider-mask-tight.png", tight)):
        sil = Image.new("RGBA", source.size, (255, 255, 255, 0))
        sil.putalpha(source.getchannel("A"))
        sil.thumbnail((512, 512), Image.LANCZOS)
        save(sil, PUBLIC / "brand" / name)

    buf = io.BytesIO()
    tiny.resize((96, 96), Image.LANCZOS).save(buf, "PNG", optimize=True)
    b64 = base64.b64encode(buf.getvalue()).decode()
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img" aria-label="Kratos">\n'
        f'  <image href="data:image/png;base64,{b64}" width="96" height="96"/>\n'
        "</svg>\n"
    )
    (PUBLIC / "favicon.svg").write_text(svg)
    print(f"  public/favicon.svg  {len(svg) // 1024}KB")


if __name__ == "__main__":
    main()
