# Chain of Custody — image prompts

Six photographs for the `#record` section of the marketing homepage
(`src/pages/Home.jsx`). Each link alternates text/image across a centre spine.

**Save to:** `public/chain/` with these exact names — the paths are already wired
into `CHAIN` in `src/components/home/reportData.js`:

| # | File | Layout |
|---|------|--------|
| 01 | `01-sticker.jpg` | text left · image right |
| 02 | `02-scan.jpg` | image left · text right |
| 03 | `03-gps.jpg` | text left · image right |
| 04 | `04-punch.jpg` | image left · text right |
| 05 | `05-hours.jpg` | text left · image right |
| 06 | `06-report.jpg` | image left · text right |

**Aspect ratio: whatever the shot wants.** The frame has no fixed ratio — each
image renders at its own shape, so nothing is cropped to fit. Export **1200 px
wide** at any height: the frame renders 600 CSS px at every viewport, so 1200 is
exactly 2× retina and anything larger is download cost with no visible gain.
JPEG quality ~90, progressive. Re-encode from the original, never from an
already-compressed intermediate.

The five night shots came back portrait 3:4 and 03 came back landscape 4:3; both
are fine, and the mixed shapes read as a photo essay rather than a rigid grid.

**Consistency:** generate 01 first, then use it as a style/ingredient reference
for 02–06 so the six read as one set rather than six stock photos.

---

## Shared style block

Prepend this to every one of the six scene prompts.

```
Documentary evidence photography, not advertising. Full-frame camera, 35mm lens
at f/2, shallow but honest depth of field. Near-black environment in cold
green-black, deep shadows with retained detail, one dominant practical light
source in frame. A single accent of electric lime green (#96EE60) from a phone
screen or small LED — the only saturated colour anywhere in the picture.
Everything else desaturated: cool grey concrete, dull steel, warm sodium spill,
bone white. Fine 35mm grain, slight halation on the highlights, natural handheld
imperfection. Unglamorous, restrained, real.

Negative: no text, no lettering, no signage, no numbers, no logos, no
watermarks, no user-interface graphics, no screen content, no visible faces, no
lens flare, no HDR, no teal-and-orange grade, no stock-photo smiling, no
security-camera crosshair overlays, no futuristic hologram effects.
```

---

## 01 — STICKER · *An NTAG sticker goes on the wall*

```
A gloved hand presses a small matte-white NFC tag onto the painted cinderblock
wall of a commercial building stairwell. The tag is a plain unmarked white
square, slightly bigger than a coin. Cold overhead fluorescent light from above
and behind, raking across the block texture and the layers of grey institutional
paint. Steel handrail out of focus in the lower left. The hand enters from the
right edge of frame and works toward the left, so the picture opens to the left.
Tight composition, wall texture dominant, quiet negative space on the left third.
```

## 02 — SCAN · *The guard has to be standing there*

```
A security guard holds a phone flat against a small white tag on a corridor
wall, mid-tap, at two in the morning. The phone screen throws electric lime
green light up across the hand and the wall — the only bright thing in a very
dark corridor. Guard in a plain unbranded black softshell jacket, seen from
behind and to the side, head out of frame, no face visible. Long empty corridor
falling away into darkness behind. Subject placed left of centre and oriented
toward the right of frame.
```

## 03 — GPS · *The scan is validated against the tag*

> **Reshot.** The first take was a high wide angle with the guard at ~8% of frame
> height and **no tag anywhere in the picture** — so a step about validating a
> scan *against the tag* showed neither the tag nor any measured relationship.
> The replacement makes the distance itself the subject: tag sharp in the
> foreground, guard back across the deck, painted bay lines doing the measuring.
> Shipped take came back landscape; kept landscape, uncropped.

```
Documentary evidence photography, shot as if for a security company's own case
file — not advertising. Underground concrete parkade, level P2 of a Canadian
office tower, a little after two in the morning, empty of cars.

FOREGROUND, sharp and dominant on the left: a rigid checkpoint label the size of
a playing card, fixed at chest height to the rough grey concrete of a square
structural column. Bone-white stock, saturated lime-green header band, one short
alphanumeric code set large and clearly legible. Laminate sheen, a weathered
corner, concrete grit along the bottom edge — it has been there a year.

MIDGROUND, right third: a security guard in a plain navy-black softshell duty
jacket, twelve metres back beside the next column in the grid, phone held up in
both hands, head tipped down to it, seen three-quarter from behind, face not
visible. The screen throws hard electric lime-green light up onto his hands and
jaw — the brightest thing in the frame. Body angled back toward the foreground
column so the two subjects visibly belong to each other.

BETWEEN THEM, treated as a subject: painted white parking bay lines running in
strict perpendicular rows from the base of the foreground column to the guard's
feet, four to five full bay widths of empty concrete receding in perspective.
Faded yellow curb paint, a cast-iron drain grate, tyre scuffs, a dried water
stain. The lines must be crisp and countable — they are what makes the gap read
as a measured distance rather than vague depth.

CAMERA: full-frame, 85mm at f/2.8, held at 1.4 m and level, not angled down.
Telephoto compression pulls guard and column into a tight relationship. Focus
locked on the foreground label; the guard falls slightly soft but stays readable;
the far wall dissolves to black.

LIGHT: one failing fluorescent batten far back on the ceiling throwing a weak,
cold, faintly green pool across the middle distance — the only ambient source and
deliberately not enough. A second fixture dead and unlit. The label lit by spill
and bounce, dim and raking across the aggregate. Everything else near-black with
shadow detail retained: deep and clean, never crushed, never milky.

PALETTE: cold and desaturated — wet-grey concrete, dull galvanised steel, black
shadow with a faint green cast (#0F1209), bone white in the paint and label
stock. Exactly one saturated colour in the frame: electric lime (#96EE60) on the
phone screen and the label's header band. No warm sodium wash.

RENDERING: fine 35mm grain, heavier in the shadows. Slight halation off the phone
screen and the tube. Natural vignetting, real optical imperfection, slightly
imperfect handheld framing. Unretouched, cold, quiet, plausible as a real
photograph from a real night shift.

NEGATIVE: no dense small print, no garbled lettering, no signage, no wayfinding
numbers on columns, no logos beyond the label's header band, no watermarks, no
captions burned into the image, no UI graphics, no map overlays, no HUD, no
crosshairs, no radius circles or arcs drawn on the floor, no dotted measurement
lines, no glowing tech effects, no holograms, no visible face, no second person,
no cars, no lens flare, no HDR, no teal-and-orange grade, no advertising gloss.
```

## 04 — PUNCH · *The raw record is written once*

```
A guard taps a phone to a small tag mounted beside the glass doors of an office
lobby at the start of the night shift. Warm interior lobby light spills out onto
wet dark pavement; cold blue night and empty street behind. The phone screen
adds a small lime-green highlight on the hand. Shot from outside looking in
through the glass, reflections of the street doubling in the pane. Guard seen
from behind, no face. Figure at the left, action carrying toward the right.
```

## 05 — HOURS · *Payroll is derived, never retyped*

```
A signed paper timesheet lies on a scratched office desk under a single warm
desk lamp just before dawn. A ballpoint pen rests across it, a mechanical
keyboard sits half out of frame, a cold cup of coffee behind. The window beyond
shows first grey light. One small lime-green LED on a monitor edge or dock is
the only saturated colour. Overhead top-down angle onto the desk surface. Paper
warm ivory, not bright white. Documents weighted to the right of frame, desk
surface open on the left.
```

## 06 — REPORT · *Your client reads the same record you billed from*

```
A printed multi-page report sits squared on the clean desk of a building
manager's office in flat, even morning daylight. Warm ivory stock, crisp folds,
a paper clip, a pair of reading glasses set down beside it. Bright calm room,
completely unlike the night that produced it — this is the one image in the set
that is not dark. Muted greys and warm neutrals, one small lime-green accent on
a desk object. Shallow overhead angle. Report placed left of centre, room
opening to the right.
```

---

## Notes

- **06 is deliberately the bright one.** The set runs 01→05 through a single
  night and lands in daylight on the client's desk. That tonal turn is the
  argument the section is making; don't let a generator "fix" it into
  consistency.
- **No legible text, ever.** Generators garble lettering, and a fake report with
  fake words undercuts a page whose whole claim is that the record is real. The
  real words live in the HTML beside the picture.
- **No faces**, both to dodge AI face artifacts and because the page is about a
  record, not a person.
- These are staged illustrations. The homepage already carries
  `SYNTHETIC DATA, NOT A CUSTOMER RECORD` disclosure; keep it.
