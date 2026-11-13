/**
 * Every word on the public homepage, in one place.
 *
 * Written for a security company owner who is NOT technical. Short sentences,
 * everyday words, the outcome first. Benchmark: guardowlco.com — one plain
 * promise, one-line features, pains the owner already has.
 *
 * Buzzwords are allowed only when true: guard tour, GPS tracking, real-time,
 * live, smart alerts, automated reports, all-in-one, paperless. "AI" is never
 * used — there is no AI in the product (owner's call: "smart" / "automated").
 *
 * HONESTY RULE: only claim what the product does today. No accounting-software
 * sync (payroll is a CSV), deductions are CPP + EI only, GPS comes from each
 * clock-in/out (geofence) and the live map's check-in positions — a patrol is
 * proven by the TAP, never "GPS-validated" (owner's rule). No continuous
 * in-vehicle tracking between stops.
 *
 * The FAQ also feeds the FAQPage structured data, so the rich result and the
 * visible answer can never drift apart.
 */

export const SITE = {
  name: 'Kronus',
  url: 'https://kronus.space',
  // TODO(owner): confirm this inbox receives mail before launch.
  email: 'hello@kronus.space',
  city: 'Toronto',
  region: 'Ontario',
  country: 'CA',
  title: 'Security Guard Software & Guard Tour App | Kronus Canada',
  description:
    'All-in-one security guard software: guard tour app, GPS tracking, smart alerts, scheduling, incident reports and payroll. Made in Toronto. Book a free demo.',
  ogTitle: 'Kronus — prove every patrol, keep every contract',
  ogDescription:
    'Guard tour app, GPS tracking, scheduling, incident reports and payroll in one simple app for Canadian security companies.',
  ogImage: '/og-image.png',
}

export const NAV = [
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Try a patrol', href: '#patrol' },
  { label: 'Product', href: '#tour' },
  { label: 'GPS tracking', href: '#gps' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
]

export const HERO = {
  eyebrow: 'Made in Toronto · Prices in Canadian dollars',
  kicker: 'Security guard software',
  titleA: 'Prove every patrol.',
  titleB: 'Keep every contract.',
  lede: 'Kronus is the all-in-one app for security companies. Guards scan checkpoints with their phone. Your clients see every patrol live. Hours go straight to payroll.',
  primary: 'Book a free demo',
  secondary: 'See how it works',
  assurances: ['Free 7-day trial', 'No credit card', 'Set up the same day'],
}

/** The keyword strip under the hero — every item jumps to where it's shown. */
export const MODULES = [
  { label: 'Guard tour app', href: '#how-it-works' },
  { label: 'GPS tracking', href: '#gps' },
  { label: 'Smart alerts', href: '#tour' },
  { label: 'Client portal', href: '#tour' },
  { label: 'Incident reports', href: '#tour' },
  { label: 'Scheduling', href: '#tour' },
  { label: 'Timesheets & payroll', href: '#tour' },
]

/** The live demo in the hero: one night at one building. Sample data. */
export const DEMO_SITE = {
  name: '800 Bay Street',
  guard: 'Marcus R.',
  checkpoints: [
    { name: 'Main entrance', floor: 'Ground', method: 'NFC' },
    { name: 'Parkade P2', floor: 'Basement', method: 'QR' },
    { name: 'East stairwell', floor: '4th floor', method: 'NFC' },
    { name: 'Mail room', floor: 'Ground', method: 'NFC' },
    { name: 'Loading dock', floor: 'Ground', method: 'QR' },
    { name: 'West stairwell', floor: '8th floor', method: 'NFC' },
    { name: 'Gym & pool', floor: '2nd floor', method: 'NFC' },
    { name: 'Rooftop door', floor: 'Roof', method: 'QR' },
    { name: 'Mechanical room', floor: 'Penthouse', method: 'NFC' },
  ],
  startMinutes: 22 * 60 + 14,
  // An office-side alert (clients never see other sites or internal alerts).
  alert: {
    lateTitle: 'Smart alert · to your office',
    late: 'No patrol scan at 800 Bay Street in 40 min',
    fixedTitle: 'Back on schedule',
    fixed: 'Marcus R. scanned the rooftop door',
  },
}

/** "One night at 800 Bay Street" — the photo story. Photos are illustrative. */
export const NIGHT = {
  title: 'One night at 800 Bay Street',
  intro: 'Scroll through the night. On the left, what your guard lives through. On the right, what your office and your client see at that exact moment.',
  moments: [
    { proof: { who: 'Your office', title: 'Marcus R. clocked in', lines: ['800 Bay Street · 22:02', 'Inside the site’s GPS geofence ✓'] }, t: '22:02', title: 'Clock in, on site', body: 'Marcus clocks in at the building. GPS confirms he’s actually there — not in the car down the street.', img: '/marketing/night-tag.webp', alt: 'A guard’s gloved hand at a checkpoint tag on a concrete wall' },
    { proof: { who: 'Client portal', title: 'East stairwell · 4th floor', lines: ['23:07 · NFC tap ✓', 'Checkpoints tonight: 4/9'] }, t: '23:07', title: 'Tap, and it’s on record', body: 'Checkpoint 4, east stairwell. One tap on the tag. No signal down here, so it saves and syncs later.', img: '/marketing/night-scan.webp', alt: 'A guard tapping an NFC checkpoint tag in a dark corridor, the tag glowing green' },
    { proof: { who: 'Guard app', title: 'Scanned ✓ CP-04', lines: ['No signal — saved on the phone', 'Synced 23:09, time kept as 23:07'] }, t: '23:07', title: 'Proof in his pocket', body: 'The phone confirms the scan. The moment it finds signal, it’s in your client’s portal — still stamped 23:07.', img: '/marketing/night-phone.webp', alt: 'A phone showing a green check: checkpoint CP-04 checked at 23:07' },
    { proof: { who: 'Client portal', title: 'Round 3 complete', lines: ['9/9 checkpoints · 03:21', 'Nothing missed'] }, t: '02:58', title: 'The 3 a.m. round', body: 'The parkade is empty and cold. The round still gets walked — and every tag still gets tapped.', img: '/marketing/night-parkade.webp', alt: 'A lone guard checking his phone in an empty underground parkade at night' },
    { day: true, proof: { who: 'Client portal', title: 'Patrol report downloaded', lines: ['Last night: 27 scans, 3 rounds', 'PDF · 3 pages'] }, t: '08:40', title: 'Your client checks in', body: 'The property manager opens last night’s patrols in their portal and downloads the PDF. No phone call needed.', img: '/marketing/day-client.webp', alt: 'A property manager at a desk reading a printed patrol report beside a laptop' },
    { day: true, proof: { who: 'Client portal', title: 'Incident · Side door open', lines: ['Filed 01:40 by Marcus R.', '2 photos · door secured 01:46'] }, t: '09:15', title: 'The incident is already written up', body: 'The side door found open at 01:40? Filed on the spot, with photos, before anyone asked.', img: '/marketing/day-incident.webp', alt: 'A printed incident report with photos on a desk' },
    { day: true, proof: { who: 'Your office', title: 'Paystub ready · Marcus R.', lines: ['40.5 h from 5 clock-ins', 'CPP and EI calculated'] }, t: 'Friday', title: 'Payroll, without the texts', body: 'Hours come straight from the clock-ins. Nobody retypes a thing.', img: '/marketing/day-payroll.webp', alt: 'A tablet showing a guard paystub on an office desk' },
  ],
}

/** "Walk the round" — the flashlight patrol. Tag x/y are % of the photo. */
export const PATROL = {
  title: 'It’s 3 a.m. in the parkade. Walk the round.',
  intro: 'This is your guard’s night. Move your flashlight — or drag your finger — and tap each checkpoint tag. Watch your client’s screen fill up.',
  tags: [
    { id: 'a', name: 'Pillar A', x: 12, y: 42 },
    { id: 'c', name: 'Pillar C', x: 29.5, y: 39 },
    { id: 'ramp', name: 'Ramp to P3', x: 55, y: 37 },
    { id: 'stairs', name: 'Stairwell B door', x: 83.6, y: 41 },
    { id: 'elec', name: 'Electrical room', x: 97.2, y: 34.5 },
  ],
  startMinutes: 2 * 60 + 51,
  done: 'Round complete. Your client just watched every tap land — live.',
}

/** "Your client asks…" — the questions owners dread, answered from the record. */
export const ASKS = {
  title: 'When a client asks, you answer in seconds.',
  intro: 'Tap a question your clients really ask. The answer comes straight from the record — no digging, no guessing.',
  who: 'Property manager · 800 Bay Street',
  items: [
    {
      id: 'parkade',
      q: 'Was anyone checking the parkade at 3 a.m. last night?',
      a: 'Yes — here are the scans:',
      kind: 'scans',
      rows: [
        ['02:58', 'Parkade P2 · Pillar A', 'NFC'],
        ['03:04', 'Parkade P2 · Pillar C', 'NFC'],
        ['03:11', 'Ramp to P3', 'QR'],
      ],
      note: 'Also in your portal under Patrols.',
    },
    {
      id: 'door',
      q: 'Why was the side door open on Tuesday?',
      a: 'Marcus found it at 22:58 and filed this on the spot:',
      kind: 'incident',
      title: 'Incident · Door found open',
      meta: 'Tue 22:58 · Side door, ground floor · Marcus R.',
      body: 'Latch jammed. Door secured at 23:04, maintenance told. Photos attached.',
      note: 'In your portal under Incidents, with the PDF.',
    },
    {
      id: 'hours',
      q: 'How many hours did your guard actually work last week?',
      a: '40.5 hours — every clock-in checked by GPS on site:',
      kind: 'hours',
      rows: [
        ['Mon', '22:00 – 06:04', '8.0 h'],
        ['Tue', '21:58 – 06:00', '8.0 h'],
        ['Wed', '22:01 – 06:31', '8.5 h'],
        ['Thu', '22:00 – 06:02', '8.0 h'],
        ['Fri', '22:03 – 06:00', '8.0 h'],
      ],
      note: 'Raw clock times can’t be edited.',
    },
  ],
}

export const BEFORE_AFTER = {
  title: 'Still running guards on paper and WhatsApp?',
  intro: 'Flip the switch to see what changes the day you move to Kronus.',
  oldLabel: 'The old way',
  newLabel: 'With Kronus',
  rows: [
    {
      topic: 'Proof of patrol',
      old: 'A paper log. Your client has to take your word for it.',
      next: 'Every checkpoint scan is time-stamped. Your client sees it live.',
    },
    {
      topic: 'No-shows',
      old: 'You find out when an angry client calls you.',
      next: 'Smart alerts tell you within minutes, before the client notices.',
    },
    {
      topic: 'Daily reports',
      old: 'A supervisor types them up after every shift.',
      next: 'An automated summary lands in your inbox every morning.',
    },
    {
      topic: 'Incidents',
      old: 'Written up the next day. Photos lost in a group chat.',
      next: 'Filed on the spot with photos. Your client can read it that night.',
    },
    {
      topic: 'Payroll',
      old: 'Hours sent by text. Monday spent fixing spreadsheets.',
      next: 'Hours come from real clock-ins, ready for payroll.',
    },
    {
      topic: 'Renewals',
      old: 'Your word against a complaint.',
      next: 'Months of patrol records to show at renewal time.',
    },
  ],
}

export const STEPS = {
  title: 'How the Kronus guard tour app works',
  intro: 'Three steps, no IT team. Try them yourself: put up the tags, walk the round, send the proof.',
  // Checkpoint spots on the building cutaway, as % of its 420×440 drawing.
  spots: [
    { id: 'roof', name: 'Rooftop door', floor: 'Roof', method: 'QR', x: 73.6, y: 10 },
    { id: 'stairs', name: 'East stairwell', floor: '8th floor', method: 'NFC', x: 77.4, y: 24 },
    { id: 'lobby', name: 'Lobby desk', floor: 'Ground', method: 'NFC', x: 40.5, y: 67 },
    { id: 'p2', name: 'Parkade P2', floor: 'Basement', method: 'NFC', x: 61.9, y: 83 },
  ],
  guardStart: { x: 26.7, y: 69 },
  startMinutes: 22 * 60 + 14,
  items: [
    {
      title: 'Put up checkpoint tags',
      body: 'Print QR codes from Kronus or stick on NFC tags at the doors, stairwells, parkades and rooftops you protect.',
    },
    {
      title: 'Guards scan as they patrol',
      body: 'One tap on their phone records who, where and when. It even works with no cell signal.',
    },
    {
      title: 'Your client sees the proof',
      body: 'Patrols, incidents and hours show up live in your client’s portal, and they can download a PDF report for any day.',
    },
  ],
}

export const TOUR = {
  title: 'Guard scheduling, client portal and payroll in one app',
  intro: 'Your office, your clients and your guards each get the screen they need.',
  tabs: [
    {
      id: 'office',
      tab: 'Owner & office',
      title: 'See every site on one screen',
      points: [
        'Who is on duty right now, at every site',
        'Smart alerts for late guards, no-shows and missed rounds',
        'A live map of where every guard checked in',
      ],
      image: { src: '/marketing/admin-overview.webp', w: 2160, h: 1350, mobile: { src: '/marketing/admin-overview-m.webp', w: 1740, h: 1080 }, alt: 'Kronus dashboard showing coverage, guards on duty, late and no-show alerts across five sites' },
      frame: 'browser',
      url: 'kronus.space/admin',
    },
    {
      id: 'clients',
      tab: 'Your clients',
      title: 'Give clients proof, not promises',
      points: [
        'Their own login to watch patrols live',
        'Patrol and hours reports as a PDF, for any day',
        'Incident reports with photos, in their portal the same night',
      ],
      image: { src: '/marketing/client-portal.webp', w: 2160, h: 1350, mobile: { src: '/marketing/client-portal-m.webp', w: 1740, h: 1080 }, alt: 'Kronus client portal showing the guard on duty, patrol rounds and checkpoints completed' },
      frame: 'browser',
      url: 'kronus.space/client',
    },
    {
      id: 'guards',
      tab: 'Your guards',
      title: 'So simple every guard gets it',
      points: [
        'Two big buttons: scan a checkpoint, report an incident',
        'Clock‑in only works on site, checked by GPS',
        'They see their schedule and can pick up open shifts',
      ],
      image: { src: '/marketing/guard-dashboard.webp', w: 780, h: 1688, alt: 'Kronus guard app on a phone showing a guard clocked in on shift' },
      frame: 'phone',
    },
    {
      id: 'payroll',
      tab: 'Scheduling & payroll',
      title: 'Schedule in minutes, pay without the spreadsheet',
      points: [
        'Drag-and-drop schedule; guards get calendar invites',
        'Timesheets built from real clock-ins, not memory',
        'Paystubs with CPP and EI, plus a payroll CSV',
      ],
      image: { src: '/marketing/roster.webp', w: 1992, h: 1062, mobile: { src: '/marketing/roster-m.webp', w: 1250, h: 1062 }, alt: 'Kronus weekly guard schedule with open shifts and double-booking warnings' },
      frame: 'browser',
      url: 'kronus.space/admin/roster',
    },
  ],
}

export const GPS = {
  title: 'GPS tracking for site and mobile patrols',
  intro:
    'The tap on the tag proves the patrol. GPS shows you the route: where every guard checked in, in what order and when, on one live map.',
  points: [
    { title: 'Geofenced clock-in', body: 'Guards can only clock in and out when they are actually on site.' },
    { title: 'Live guard map', body: 'See where each guard last checked in, at every site.' },
    { title: 'Breadcrumb trail', body: 'Check-ins join up in order, so you see the whole patrol route.' },
    { title: 'Mobile patrols', body: 'One guard, many sites. Every stop lands on the same map.' },
    { title: 'Coverage heat map', body: 'Spot the corners of a site that never get checked.' },
  ],
  // Illustrative patrol for the map. x/y are in the SVG's 640×440 space.
  sites: [
    { id: 'lv', name: 'Liberty Village Lofts', x: 118, y: 262, r: 46 },
    { id: 'kw', name: 'King West Tower', x: 300, y: 178, r: 44 },
    { id: 'bay', name: '800 Bay Street', x: 508, y: 112, r: 50 },
  ],
  stops: [
    { t: '22:02', site: 'lv', label: 'Clock in · front gate', x: 100, y: 240, kind: 'clock' },
    { t: '22:31', site: 'lv', label: 'Parking lot', x: 140, y: 290, method: 'NFC' },
    { t: '23:05', site: 'lv', label: 'Rear doors', x: 150, y: 236, method: 'QR' },
    { t: '23:48', site: 'kw', label: 'Lobby', x: 286, y: 190, method: 'NFC' },
    { t: '00:20', site: 'kw', label: 'Parkade P1', x: 318, y: 162, method: 'NFC' },
    { t: '01:16', site: 'bay', label: 'Main entrance', x: 490, y: 128, method: 'NFC' },
    { t: '01:44', site: 'bay', label: 'Loading dock', x: 530, y: 96, method: 'QR' },
    { t: '02:39', site: 'kw', label: 'Rooftop door', x: 306, y: 196, method: 'NFC' },
    { t: '03:58', site: 'lv', label: 'Bike room', x: 108, y: 296, method: 'NFC' },
    { t: '05:56', site: 'lv', label: 'Clock out · side gate', x: 80, y: 268, kind: 'clock' },
  ],
}

export const CALC = {
  title: 'How much office time would you save?',
  intro: 'Move the sliders to match your company. It’s an estimate from your own numbers, not a promise.',
  guards: { label: 'Guards', min: 1, max: 150, value: 25 },
  sites: { label: 'Sites', min: 1, max: 60, value: 8 },
  assumptions: [
    { id: 'minGuard', label: 'Minutes per guard each week on timesheets and shift texts', value: 15, min: 0, max: 120 },
    { id: 'minSite', label: 'Minutes per site each day writing patrol reports', value: 10, min: 0, max: 120 },
    { id: 'rate', label: 'What an hour of office time costs you ($)', value: 28, min: 0, max: 200 },
  ],
  planName: 'Max',
  planPrice: '199.99',
}

export const INDUSTRIES = {
  title: 'Built for every site you guard',
  items: [
    { icon: 'House', title: 'Condo & residential security' },
    { icon: 'Building2', title: 'Office & commercial buildings' },
    { icon: 'HardHat', title: 'Construction site security' },
    { icon: 'Store', title: 'Retail & loss prevention' },
    { icon: 'CircleParking', title: 'Parking garages' },
    { icon: 'Warehouse', title: 'Warehouses & industrial' },
    { icon: 'Car', title: 'Mobile patrol routes' },
    { icon: 'Hospital', title: 'Hospitals & campuses' },
  ],
}

/**
 * Annual = 12 × monthly less 20%. The headline stays a monthly figure on both
 * tabs so plans compare at a glance; the annual total sits underneath.
 */
export const PLANS = [
  {
    id: 'standard',
    name: 'Standard',
    tagline: 'Proof of patrol for your first sites',
    monthly: '99.99',
    annualMonthly: '79.99',
    annualTotal: '959.90',
    saving: '240',
    features: [
      'Guard tour app (NFC and QR scanning)',
      'GPS-checked clock-in and clock-out',
      'Client portal with live patrol history',
      'Monthly patrol report as a PDF',
      'Incident reports with photos',
      'Late and missed-patrol email alerts',
      'Email support',
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    tagline: 'Run every site in real time',
    monthly: '149.99',
    annualMonthly: '119.99',
    annualTotal: '1,439.90',
    saving: '360',
    featured: true,
    inherits: 'Everything in Standard, plus',
    features: [
      'Scheduling with calendar invites and open shifts',
      'Live GPS map and coverage dashboard',
      'Guard hours log, to the minute',
      'No-show alerts',
      'Automated morning summary email',
      'Incident categories with photos and notes',
      'Phone and email support',
    ],
  },
  {
    id: 'max',
    name: 'Max',
    tagline: 'Payroll and invoicing built in',
    monthly: '199.99',
    annualMonthly: '159.99',
    annualTotal: '1,919.90',
    saving: '480',
    inherits: 'Everything in Premium, plus',
    features: [
      'Timesheets with 15-minute rounding and overtime',
      'Paystubs with CPP and EI calculated',
      'Payroll and hours CSV for your bookkeeper',
      'Invoices for extra coverage and call‑outs',
      'Priority same-day support',
    ],
  },
]

export const PRICING = {
  title: 'Simple pricing. Per company, never per guard.',
  intro: 'Every plan includes the guard app and the client portal. Hire ten more guards and your bill stays the same. Prices in Canadian dollars.',
  note: 'Every plan: free 7-day trial · no credit card · cancel any time',
}

export const FAQS = [
  {
    q: 'How long does it take to get started?',
    a: 'Most companies are scanning the same day. Add a site, print QR checkpoint labels from Kronus, put them up and add your guards. You can swap the QR labels for NFC tags later. We walk you through it on the demo call.',
  },
  {
    q: 'Is it hard for guards to learn?',
    a: 'No. The guard app has two big buttons: scan a checkpoint and report an incident. Most guards get it in a couple of minutes, and it runs on the phone they already have — iPhone or Android.',
  },
  {
    q: 'Does Kronus have GPS tracking?',
    a: 'Yes. Clock-in and clock-out only work inside the site’s GPS boundary. The live map also shows where each guard checked in through the night and joins those stops into a trail, so you can see the order they patrolled in — across one site or a whole mobile patrol route. The patrol itself is proven by the tap on the tag, not by GPS.',
  },
  {
    q: 'What happens when there’s no cell signal?',
    a: 'Scans are saved on the phone and upload when it reconnects. The time recorded is the moment of the scan, so a basement or parkade round still counts.',
  },
  {
    q: 'Can a guard fake a patrol?',
    a: 'Checkpoints are physical tags fixed on site, so a scan means standing at that tag. Clock-in is checked by GPS, and original clock times can’t be edited — any correction is recorded on top, so the original is always there. For high-risk spots we recommend NFC tags, which can’t be copied with a photo.',
  },
  {
    q: 'What can my clients see?',
    a: 'Only their own sites: who is on duty, patrol scans, incidents and reports. They never see pay rates or any other client’s sites.',
  },
  {
    q: 'Is it really priced per company, not per guard?',
    a: 'Yes. Your plan covers your whole company. Add guards and the price stays the same.',
  },
  {
    q: 'Is there a contract?',
    a: 'No. Pay monthly and cancel any time, or pay yearly and save 20%. Every plan starts with a free 7-day trial and no credit card.',
  },
  {
    q: 'Does Kronus do payroll?',
    a: 'Kronus works out the hours — 15-minute rounding, overtime and stat holidays — from real clock-ins. On the Max plan it makes paystubs with CPP and EI and a payroll CSV for your bookkeeper. It does not send remittances to the CRA for you.',
  },
  {
    q: 'Is Kronus Canadian?',
    a: 'Yes. Kronus is made in Toronto for Canadian security companies, with prices in Canadian dollars and payroll that handles CPP and EI.',
  },
]

export const DEMO = {
  title: 'Book a free 20‑minute demo',
  body: 'On a video call or by phone. We’ll show you what your guards, your office and your clients would each see, and answer every question.',
  points: ['A live product tour, not a slide deck', 'Pricing questions answered on the spot', 'Start your free trial the same day'],
  guardOptions: ['1–10', '11–25', '26–50', '51–100', '100+'],
  submit: 'Book my demo',
  success: 'Thanks! We’ll email you within one business day to pick a time.',
  privacy: 'We only use your details to set up the demo. No mailing lists.',
}

export const FOOTER = {
  blurb: 'Security guard software for Canadian companies: guard tour app, GPS tracking, scheduling, incident reports and payroll in one.',
}

/** schema.org graph for the homepage: who we are, what we sell, and the FAQ. */
export function structuredData() {
  const org = {
    '@type': 'Organization',
    '@id': `${SITE.url}/#org`,
    name: SITE.name,
    url: SITE.url,
    logo: `${SITE.url}/logo.png`,
    email: SITE.email,
    address: {
      '@type': 'PostalAddress',
      addressLocality: SITE.city,
      addressRegion: 'ON',
      addressCountry: SITE.country,
    },
    areaServed: { '@type': 'Country', name: 'Canada' },
  }
  const app = {
    '@type': 'SoftwareApplication',
    '@id': `${SITE.url}/#software`,
    name: 'Kronus',
    applicationCategory: 'BusinessApplication',
    applicationSubCategory: 'Security guard management software',
    operatingSystem: 'Web, iOS, Android',
    description: SITE.description,
    url: SITE.url,
    image: `${SITE.url}${SITE.ogImage}`,
    publisher: { '@id': `${SITE.url}/#org` },
    offers: PLANS.map((p) => ({
      '@type': 'Offer',
      name: p.name,
      price: p.monthly,
      priceCurrency: 'CAD',
      category: 'subscription',
      url: `${SITE.url}/#pricing`,
    })),
    featureList: [
      'Guard tour app with NFC and QR checkpoint scanning',
      'GPS tracking: geofenced clock-in and clock-out, live guard map with breadcrumb trails',
      'Smart alerts for late guards, no-shows and missed patrols',
      'Client portal with live patrol history',
      'Incident reports with photos',
      'Guard scheduling with open shifts',
      'Timesheets, paystubs (CPP and EI) and payroll CSV',
    ],
  }
  const site = {
    '@type': 'WebSite',
    '@id': `${SITE.url}/#website`,
    url: SITE.url,
    name: SITE.name,
    inLanguage: 'en-CA',
    publisher: { '@id': `${SITE.url}/#org` },
  }
  const faq = {
    '@type': 'FAQPage',
    '@id': `${SITE.url}/#faq`,
    mainEntity: FAQS.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  }
  return { '@context': 'https://schema.org', '@graph': [org, site, app, faq] }
}
