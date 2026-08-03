/**
 * Kronus supply catalogue.
 *
 * Deliberately excluded: handcuffs, batons, OC spray and ballistic armour. Those
 * are restricted or permit-controlled in Canadian provinces and must not sit in
 * a self-serve request flow — they belong to a licensed, verified order path.
 *
 * No prices live here on purpose. Trade pricing moves with volume and account,
 * and inventing a number would be inventing a commercial claim. Every line is
 * quoted per account from a submitted requisition.
 */

export const CATEGORIES = [
  {
    id: 'vests',
    name: 'Vests & hi-vis',
    blurb: 'Load-bearing and visibility layers — what the guard wears over the uniform.',
  },
  {
    id: 'uniform',
    name: 'Uniform',
    blurb: 'Shirts, polos and duty trousers cut for a full shift on foot.',
  },
  {
    id: 'outerwear',
    name: 'Outerwear',
    blurb: 'Night shifts, loading docks and parkade patrols in a Canadian winter.',
  },
  {
    id: 'accessories',
    name: 'Duty accessories',
    blurb: 'The belt kit and carry that turns a uniform into working equipment.',
  },
  {
    id: 'checkpoints',
    name: 'Checkpoint hardware',
    blurb:
      'The physical layer the platform verifies against — the tag on the wall is what makes a patrol provable.',
  },
]

/**
 * `image` is intentionally null on every line: no product photography exists yet.
 * The card renders a spec plate instead, and drops a photo into the same slot
 * the moment a real shot is added — no layout change required.
 */
export const PRODUCTS = [
  // ---- Vests & hi-vis -----------------------------------------------------
  {
    sku: 'KR-V100',
    category: 'vests',
    name: 'Load-bearing duty vest',
    summary: 'MOLLE front panel, radio loops and a load-spreading yoke for belt-free carry.',
    specs: ['600D ripstop shell', 'Radio + mic loops', 'Adjustable side cinch'],
    sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL'],
    image: null,
  },
  {
    sku: 'KR-V210',
    category: 'vests',
    name: 'Hi-vis safety vest, Class 2',
    summary: 'Site-compliant visibility layer for lots, docks and anywhere vehicles move.',
    specs: ['ANSI/ISEA 107 Class 2', '50mm reflective tape', 'Breakaway front'],
    sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'],
    image: null,
  },
  {
    sku: 'KR-V150',
    category: 'vests',
    name: 'Covert utility vest',
    summary: 'Worn under the shirt where a visible rig would read wrong to a client.',
    specs: ['Moisture-wicking mesh', 'Low-profile pockets', 'Shoulder padding'],
    sizes: ['S', 'M', 'L', 'XL', '2XL'],
    image: null,
  },

  // ---- Uniform ------------------------------------------------------------
  {
    sku: 'KR-S310',
    category: 'uniform',
    name: 'Long-sleeve duty shirt',
    summary: 'The standard front-of-house shirt — holds a press through a twelve-hour shift.',
    specs: ['Poly-cotton twill', 'Epaulettes + badge tab', 'Two pleated chest pockets'],
    sizes: ['14.5', '15', '15.5', '16', '16.5', '17', '17.5', '18', '19'],
    sizeLabel: 'Neck',
    image: null,
  },
  {
    sku: 'KR-S300',
    category: 'uniform',
    name: 'Short-sleeve duty shirt',
    summary: 'Same cut and badge tab as the long sleeve, for summer posts.',
    specs: ['Poly-cotton twill', 'Epaulettes + badge tab', 'Wrinkle-resistant finish'],
    sizes: ['14.5', '15', '15.5', '16', '16.5', '17', '17.5', '18', '19'],
    sizeLabel: 'Neck',
    image: null,
  },
  {
    sku: 'KR-S120',
    category: 'uniform',
    name: 'Performance patrol polo',
    summary: 'Mobile patrol and overnight posts where a twill shirt is more than the job needs.',
    specs: ['Moisture-wicking knit', 'Mic loops at shoulder', 'Reinforced placket'],
    sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'],
    image: null,
  },
  {
    sku: 'KR-P400',
    category: 'uniform',
    name: 'Cargo duty trouser',
    summary: 'Eight pockets and a gusseted crotch — built for stairs, not for a desk.',
    specs: ['Ripstop weave', 'Gusseted crotch', 'Cargo + phone pockets'],
    sizes: ['28', '30', '32', '34', '36', '38', '40', '42', '44', '46'],
    sizeLabel: 'Waist',
    image: null,
  },

  // ---- Outerwear ----------------------------------------------------------
  {
    sku: 'KR-J500',
    category: 'outerwear',
    name: '3-in-1 duty parka',
    summary: 'Waterproof shell with a zip-out liner, so one coat covers October through March.',
    specs: ['Waterproof shell', 'Zip-out insulated liner', 'Badge tab + radio pass-through'],
    sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'],
    image: null,
  },
  {
    sku: 'KR-J320',
    category: 'outerwear',
    name: 'Softshell patrol jacket',
    summary: 'The shoulder-season layer that still looks like a uniform to a client.',
    specs: ['Wind + water resistant', 'Fleece-backed', 'Badge tab'],
    sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'],
    image: null,
  },

  // ---- Duty accessories ---------------------------------------------------
  {
    sku: 'KR-A110',
    category: 'accessories',
    name: 'Nylon duty belt + 4 keepers',
    summary: 'Two-inch web belt with keepers, sized to be worn over the uniform trouser.',
    specs: ['50mm nylon web', 'Hook-and-loop lining', 'Four keepers included'],
    sizes: ['30', '32', '34', '36', '38', '40', '42', '44', '46', '48'],
    sizeLabel: 'Waist',
    image: null,
  },
  {
    sku: 'KR-A140',
    category: 'accessories',
    name: 'Radio holder & mic clip',
    summary: 'Universal cradle that keeps the handset on the belt and the mic on the shoulder.',
    specs: ['Fits most handhelds', 'Belt loop + clip', 'Retention strap'],
    sizes: [],
    image: null,
  },
  {
    sku: 'KR-A160',
    category: 'accessories',
    name: 'ID badge holder + retractor',
    summary: 'Rigid holder on a steel-cord retractor — the licence stays visible and stays attached.',
    specs: ['Rigid card holder', 'Steel-cord retractor', 'Belt clip'],
    sizes: [],
    image: null,
  },
  {
    sku: 'KR-A220',
    category: 'accessories',
    name: 'Rechargeable patrol flashlight',
    summary: 'Runs a full night shift and charges off the same cable as the phone.',
    specs: ['1200 lumens', 'USB-C, ~6h runtime', 'Anodised aluminium'],
    sizes: [],
    image: null,
  },
  {
    sku: 'KR-A250',
    category: 'accessories',
    name: 'Cut-resistant patrol gloves',
    summary: 'Touchscreen-capable, so a guard scans a checkpoint without taking them off.',
    specs: ['EN388 cut level C', 'Touchscreen fingertips', 'Reinforced palm'],
    sizes: ['S', 'M', 'L', 'XL'],
    image: null,
  },
  {
    sku: 'KR-A180',
    category: 'accessories',
    name: 'Weatherproof field notebook, 3-pack',
    summary: 'Notes taken in rain that still transcribe into an incident report.',
    specs: ['96 weatherproof pages', 'Pocket format', 'Three per pack'],
    sizes: [],
    image: null,
  },

  // ---- Checkpoint hardware ------------------------------------------------
  {
    sku: 'KR-C010',
    category: 'checkpoints',
    name: 'NTAG 213 checkpoint tag, 10-pack',
    summary:
      'The tag that gets mounted at the checkpoint. A scan only counts because this cannot move.',
    specs: ['NTAG 213, 25mm', 'Weatherproof adhesive', 'Ten per pack'],
    sizes: [],
    image: null,
  },
  {
    sku: 'KR-C020',
    category: 'checkpoints',
    name: 'Printed QR checkpoint label, 10-pack',
    summary: 'For posts where NFC will not reach — same checkpoint, camera instead of a tap.',
    specs: ['Laminated, UV-stable', 'Site + floor printed', 'Ten per pack'],
    sizes: [],
    image: null,
  },
  {
    sku: 'KR-C030',
    category: 'checkpoints',
    name: 'Tamper-evident checkpoint mount, 10-pack',
    summary: 'Screw-and-adhesive mount that shows if a tag has been lifted off the wall.',
    specs: ['Screw + adhesive fixing', 'Tamper-evident seal', 'Ten per pack'],
    sizes: [],
    image: null,
  },
]

export function productsIn(categoryId) {
  return PRODUCTS.filter((p) => p.category === categoryId)
}

export function findProduct(sku) {
  return PRODUCTS.find((p) => p.sku === sku)
}
