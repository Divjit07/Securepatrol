/**
 * Keyword landing pages. Each page owns ONE search intent and is written for
 * a non-technical guard-company owner: the keyword in the title, H1 and first
 * sentence, a plain "what is it" answer Google can lift as a featured snippet,
 * six true benefits, one hands-on demo, and an FAQ that becomes FAQPage data.
 *
 * Same honesty rule as content.js: the TAP on a tag proves a patrol; GPS only
 * checks clock-in/out and places check-ins on the live map; there are no
 * incident categories; payroll deductions are CPP + EI only; no "AI".
 *
 * Slugs here must match vercel.json rewrites and sw.js MARKETING_PATHS.
 */
import { PLANS, SITE } from './content.js'

export const PAGES = [
  {
    slug: 'guard-tour-app',
    title: 'Guard Tour App & Guard Tour System | Kronus',
    description:
      'Guard tour app with NFC and QR checkpoints, offline scanning, missed-patrol alerts and live proof of patrol for your clients. Free 7-day trial.',
    crumb: 'Guard tour app',
    kicker: 'Guard tour system',
    h1: 'The guard tour app that proves every round',
    lede: 'Put NFC or QR checkpoint tags on site. Guards tap them with the phone they already own. Every tap is time-stamped, shows up live for your client and turns into a patrol report on its own — no paper logs, no hardware to buy.',
    visual: 'phone',
    what: {
      title: 'What is a guard tour system?',
      body: [
        'A guard tour system proves that a security guard actually walked their patrol. Checkpoints — small tags or labels — are fixed at key spots like doors, stairwells, parkades and rooftops. The guard scans each one on the way past, and the system records who scanned it and exactly when.',
        'Old guard tour systems used a wand and a docking station. Kronus is a guard tour app instead: guards use their own iPhone or Android phone, scans go straight to the cloud, and your client can check the patrol history in their own portal the same night.',
      ],
      points: ['Proof of patrol your client can check', 'No wands, docks or special phones', 'NFC tags or free printable QR codes'],
    },
    features: [
      { title: 'NFC and QR checkpoints', body: 'Stick NFC tags at high-risk spots and print QR labels from Kronus for the rest. Android phones tap NFC; any phone can scan QR.' },
      { title: 'Offline patrol mode', body: 'No signal in the basement or parkade? Scans save on the phone and upload later, still stamped with the time of the tap.' },
      { title: 'Missed-patrol alerts', body: 'Kronus checks every site every ten minutes and flags late guards, no-shows and rounds that go stale — on your dashboard and by email.' },
      { title: 'Live client portal', body: 'Each client gets a read-only login for their own sites: who is on duty, every checkpoint scan, incidents and reports.' },
      { title: 'Automatic patrol reports', body: 'Patrol and hours reports build themselves from the scans. Download a PDF or CSV for any date range.' },
      { title: 'Built for real buildings', body: 'Set checkpoints floor by floor with per-site hours, so a 30-storey tower and a fenced yard each get the right round.' },
    ],
    demo: 'sim',
    faqs: [
      { q: 'Do I need special hardware for a guard tour system?', a: 'No. Kronus runs on the phones your guards already have. You only need checkpoint tags: print free QR labels from Kronus, or buy NFC tags and tamper-evident mounts from the Kronus shop.' },
      { q: 'NFC or QR checkpoints — which should I use?', a: 'NFC tags are fast to tap and can’t be faked with a photo, so use them at high-risk spots. QR labels cost nothing to print and work on every phone. Most companies use both.' },
      { q: 'Does the guard tour app work on iPhone?', a: 'Yes. Kronus runs in the browser on iPhone and Android. iPhones scan QR checkpoints with the camera; Android phones can also tap NFC tags.' },
      { q: 'What happens if a guard misses a checkpoint?', a: 'Kronus flags it. If a site goes too long without a patrol scan, you get a missed-patrol alert on your dashboard and by email while there’s still time to fix it.' },
      { q: 'Can my client see the guard tour reports?', a: 'Yes. Clients log in to their own portal to watch patrol scans live and download reports for any day. They only ever see their own sites.' },
    ],
    related: ['gps-guard-tracking', 'incident-reporting-software', 'security-guard-scheduling-software', 'security-guard-software-toronto'],
  },
  {
    slug: 'gps-guard-tracking',
    title: 'GPS Guard Tracking & Mobile Patrol Software | Kronus',
    description:
      'GPS guard tracking with geofenced clock-in, a live map of guard check-ins and breadcrumb trails for site and mobile patrols. Made in Canada.',
    crumb: 'GPS guard tracking',
    kicker: 'GPS guard tracking software',
    h1: 'Site and mobile patrols on one live map',
    lede: 'Know your guards are where they should be. Clock-in only works inside the site’s GPS boundary, and a live map shows where every guard checked in — in order, with the time — across one building or a whole mobile patrol route.',
    visual: 'map',
    what: {
      title: 'How does GPS guard tracking work?',
      body: [
        'Every site in Kronus has a GPS boundary, called a geofence. When a guard clocks in or out, the app checks the phone’s location against it — so a clock-in from the car down the street simply doesn’t count.',
        'During the shift, the patrol itself is proven by tapping checkpoint tags. Each check-in lands on a live map, and Kronus joins them in order into a breadcrumb trail, so you can see the route a guard actually walked or drove.',
      ],
      points: ['Geofenced clock-in and clock-out', 'Live map of guard check-ins', 'A breadcrumb trail for every patrol'],
    },
    features: [
      { title: 'Geofenced clock-in', body: 'Clock-in and clock-out only count inside the site boundary. No more “I was there” from the parking lot.' },
      { title: 'Live guard map', body: 'See where each guard last checked in, across every site, on one screen.' },
      { title: 'Breadcrumb trails', body: 'Check-ins join up in time order, so you see the patrol route — and spot tags hit out of sequence.' },
      { title: 'Mobile patrol routes', body: 'One guard, many sites in a night. Every stop lands on the same map, ready to show each client.' },
      { title: 'Coverage heat map', body: 'See which parts of a site get checked the most, and the corners that never do.' },
      { title: 'Hours you can trust', body: 'Because clock-ins are checked on site, timesheets and payroll start from real hours.' },
    ],
    demo: 'patrol',
    faqs: [
      { q: 'Does Kronus track guards all the time?', a: 'No. Kronus is not a 24/7 tracker. GPS is checked when a guard clocks in or out, and each checkpoint check-in is placed on the live map. Guards aren’t followed between check-ins.' },
      { q: 'What is a geofence?', a: 'A geofence is a GPS boundary drawn around a site. Kronus uses it to make sure guards clock in and out only when they’re actually there.' },
      { q: 'Does GPS tracking work for mobile patrols?', a: 'Yes. A mobile patrol guard can cover many sites in one shift. Every check-in shows on the same map with a trail between stops, so each client gets proof their site was visited.' },
      { q: 'Is GPS what proves the patrol?', a: 'No — the tap on the checkpoint tag proves the patrol. GPS confirms clock-in and clock-out and shows you the route. Together they give you proof that holds up.' },
      { q: 'Will it drain my guards’ batteries?', a: 'No more than normal phone use. Kronus reads the location when a guard clocks in or out and when they check in, not continuously in the background.' },
    ],
    related: ['guard-tour-app', 'security-guard-scheduling-software', 'incident-reporting-software', 'security-guard-software-toronto'],
  },
  {
    slug: 'security-guard-scheduling-software',
    title: 'Security Guard Scheduling Software & Payroll | Kronus',
    description:
      'Schedule security guards in minutes: drag-and-drop shifts, calendar invites, open shifts, no-show alerts, timesheets and payroll with CPP and EI.',
    crumb: 'Guard scheduling & payroll',
    kicker: 'Security guard scheduling software',
    h1: 'Guard scheduling and payroll without the spreadsheet',
    lede: 'Build the week in minutes, publish it, and every guard gets a calendar invite. Hours come from real clock-ins, so payroll becomes a quick review instead of a Monday spent fixing texts and spreadsheets.',
    visual: 'roster',
    what: {
      title: 'What should security guard scheduling software do?',
      body: [
        'Security scheduling is harder than most shift work: posts run around the clock, guards cover several sites, and one no-show leaves a client unprotected. Good guard scheduling software has to stop double-bookings, fill open shifts fast and tell you the moment someone doesn’t show.',
        'Kronus does all three, then carries the same shifts through to timesheets and payroll — so the hours you pay are the hours guards actually worked on site.',
      ],
      points: ['Catches double-bookings before they happen', 'Open shifts guards can claim', 'Timesheets straight from clock-ins'],
    },
    features: [
      { title: 'Drag-and-drop roster', body: 'Build the week on one screen with templates and repeating shifts. Kronus warns you before you double-book a guard.' },
      { title: 'Publish with calendar invites', body: 'Draft the schedule privately, then publish. Every guard gets an email with calendar invites for their own shifts.' },
      { title: 'Open shifts', body: 'Post a shift nobody has and guards can claim it from their phone. Only one guard can take it.' },
      { title: 'No-show alerts', body: 'If a guard hasn’t clocked in when the shift starts, you hear about it within minutes — before the client does.' },
      { title: 'Timesheets from real clock-ins', body: '15-minute rounding and overtime are worked out for you, and the original clock times can’t be edited.' },
      { title: 'Payroll with CPP and EI', body: 'On the Max plan, Kronus makes paystubs with CPP and EI and exports a payroll CSV for your bookkeeper.' },
    ],
    demo: 'calc',
    faqs: [
      { q: 'Can guards see their schedule on their phone?', a: 'Yes. Guards see their own shifts in the guard app and get calendar invites when you publish, so the schedule lands in the calendar they already use.' },
      { q: 'How do open shifts work?', a: 'Mark a shift as open and guards can claim it from their phone. The first guard to claim it gets it — two guards can’t both take the same shift.' },
      { q: 'Does Kronus calculate overtime?', a: 'Yes. Kronus rounds hours to 15 minutes and splits regular and overtime hours for the pay period. Stat holiday hours are added as adjustments.' },
      { q: 'Does Kronus run payroll for me?', a: 'Kronus prepares it: timesheets, paystubs with CPP and EI, and a payroll CSV for your bookkeeper or payroll provider. It does not send remittances to the CRA.' },
      { q: 'Can I bill clients for extra shifts?', a: 'Yes. On the Max plan you can create invoices for extra coverage and call-outs as a PDF.' },
    ],
    related: ['guard-tour-app', 'gps-guard-tracking', 'incident-reporting-software', 'security-guard-software-toronto'],
  },
  {
    slug: 'incident-reporting-software',
    title: 'Security Incident Report App with Photos | Kronus',
    description:
      'Security incident report app: guards file reports with photos from the scene, your office is emailed right away and clients read them in their portal.',
    crumb: 'Incident reporting',
    kicker: 'Security incident reporting software',
    h1: 'Security incident reports, filed on the spot',
    lede: 'Guards write the incident report on their phone the moment it happens and attach photos from the scene. Your office gets the email right away, and your client can read it in their portal that night.',
    visual: 'incident',
    what: {
      title: 'What is security incident reporting software?',
      body: [
        'Incident reporting software replaces the paper incident form. Instead of writing up what happened at the end of the shift — or the next day — the guard files the report on their phone while they’re still standing there, with photos attached.',
        'Every report is tied to the guard, the site and the time it was filed. Your office is notified straight away, and the report is ready to share with your client as a PDF.',
      ],
      points: ['Up to 5 photos or files per report', 'Emailed to your office right away', 'In the client portal, with a PDF'],
    },
    features: [
      { title: 'Photos from the scene', body: 'Guards attach up to five photos — or a PDF or Word file — straight from the phone, so the report shows exactly what they saw.' },
      { title: 'Instant email to your office', body: 'The moment a report is filed, your office gets an email, so a serious incident never waits until morning.' },
      { title: 'Client portal', body: 'Clients read the incident reports for their own sites in their portal, without calling you.' },
      { title: 'PDF in one click', body: 'Download any incident report as a clean PDF to send to a client, a property manager or your insurer.' },
      { title: 'Guard, site and time', body: 'Every report records who filed it, where and when — a record you can stand behind.' },
      { title: 'Part of every patrol', body: 'Incidents sit next to the night’s patrol scans and clock-ins, so you see the whole story of a shift in one place.' },
    ],
    demo: 'asks',
    faqs: [
      { q: 'Can guards add photos to incident reports?', a: 'Yes. Guards can attach up to five photos, PDFs or Word files to each report, straight from their phone.' },
      { q: 'Who gets notified when an incident is filed?', a: 'Your office gets an email as soon as the guard submits the report. It also appears on your dashboard and in the client portal for that site.' },
      { q: 'Can clients see incident reports?', a: 'Yes — only for their own sites. They can read each report and download it as a PDF.' },
      { q: 'Do I need a separate incident report app?', a: 'No. Incident reporting is built into the Kronus guard app on every plan, next to patrol scanning and clock-in.' },
      { q: 'Does it replace paper incident forms?', a: 'Yes. Guards file reports on their phone with photos, so there’s nothing to retype, scan or lose.' },
    ],
    related: ['guard-tour-app', 'gps-guard-tracking', 'security-guard-scheduling-software', 'security-guard-software-toronto'],
  },
  {
    slug: 'security-guard-software-toronto',
    title: 'Security Guard Software in Toronto & the GTA | Kronus',
    description:
      'Security guard software made in Toronto: guard tour app, GPS clock-in, scheduling, incident reports and payroll for GTA and Ontario guard companies.',
    crumb: 'Toronto',
    kicker: 'Toronto · GTA · Ontario',
    h1: 'Security guard software made in Toronto',
    lede: 'Kronus is built in Toronto for guard companies across the GTA and Ontario. Patrol proof for your clients, scheduling, incident reports and payroll with CPP and EI — in one app, priced in Canadian dollars.',
    visual: 'live',
    what: {
      title: 'Why Toronto guard companies switch to Kronus',
      body: [
        'Guarding in the GTA means condo boards that want proof, property managers juggling a portfolio of towers, construction sites that run all night and underground parkades with no signal. Kronus was designed around exactly that.',
        'It runs on the phones your guards already carry, prices in Canadian dollars per company rather than per guard, and handles Canadian payroll with CPP and EI.',
      ],
      points: ['Made in Toronto', 'Canadian dollars, per company', 'CPP and EI on paystubs'],
    },
    features: [
      { title: 'Condos and property managers', body: 'Give every condo board and property manager a portal with live patrols, incidents and PDF reports.' },
      { title: 'Underground parkades', body: 'Scans save on the phone with no signal and sync later — the 3 a.m. parkade round still counts.' },
      { title: 'Construction sites', body: 'Geofenced clock-in proves guards are on site through the night, and missed rounds raise an alert.' },
      { title: 'Mobile patrols across the GTA', body: 'One guard covering sites from Etobicoke to Scarborough — every stop on one live map.' },
      { title: 'Canadian payroll', body: 'Paystubs with CPP and EI, 15-minute rounding, overtime and stat holiday adjustments.' },
      { title: 'Priced per company', body: `From $${PLANS[0].monthly} a month in Canadian dollars. Hire more guards and your bill stays the same.` },
    ],
    cities: [
      'Toronto', 'North York', 'Scarborough', 'Etobicoke', 'Mississauga', 'Brampton', 'Vaughan', 'Markham',
      'Richmond Hill', 'Oakville', 'Burlington', 'Hamilton', 'Pickering', 'Ajax', 'Oshawa', 'Milton',
    ],
    demo: 'tour',
    faqs: [
      { q: 'Is Kronus a Canadian company?', a: 'Yes. Kronus is made in Toronto, with prices in Canadian dollars and payroll that handles CPP and EI.' },
      { q: 'Do you work with guard companies outside Toronto?', a: 'Yes. Kronus runs in the browser, so it works anywhere in Canada. We’re based in Toronto and know the GTA market well.' },
      { q: 'Are prices in Canadian dollars?', a: `Yes. Plans start at $${PLANS[0].monthly} a month CAD, per company — not per guard — with a free 7-day trial and no credit card.` },
      { q: 'Does payroll handle Canadian deductions?', a: 'Yes. On the Max plan, paystubs include CPP and EI, and you get a payroll CSV for your bookkeeper. Kronus does not remit to the CRA for you.' },
      { q: 'How do I get a demo?', a: 'Book a free 20-minute demo below, by video call or phone. We’ll show you what your guards, office and clients would each see.' },
    ],
    related: ['guard-tour-app', 'gps-guard-tracking', 'security-guard-scheduling-software', 'incident-reporting-software'],
  },
]

export const PAGE_BY_SLUG = Object.fromEntries(PAGES.map((p) => [p.slug, p]))

/** schema.org graph for a landing page: page, breadcrumbs, FAQ, product link. */
export function pageStructuredData(page) {
  const url = `${SITE.url}/${page.slug}`
  const graph = [
    {
      '@type': 'WebPage',
      '@id': `${url}#webpage`,
      url,
      name: page.title,
      description: page.description,
      inLanguage: 'en-CA',
      isPartOf: { '@id': `${SITE.url}/#website` },
      about: { '@id': `${SITE.url}/#software` },
      breadcrumb: { '@id': `${url}#breadcrumb` },
      primaryImageOfPage: `${SITE.url}${SITE.ogImage}`,
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${url}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Kronus', item: `${SITE.url}/` },
        { '@type': 'ListItem', position: 2, name: page.crumb, item: url },
      ],
    },
    {
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      mainEntity: page.faqs.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
    {
      '@type': 'SoftwareApplication',
      '@id': `${SITE.url}/#software`,
      name: 'Kronus',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web, iOS, Android',
      url: SITE.url,
      offers: { '@type': 'Offer', price: PLANS[0].monthly, priceCurrency: 'CAD', url: `${SITE.url}/#pricing` },
    },
    {
      '@type': 'Organization',
      '@id': `${SITE.url}/#org`,
      name: SITE.name,
      url: SITE.url,
      logo: `${SITE.url}/logo.png`,
      address: { '@type': 'PostalAddress', addressLocality: SITE.city, addressRegion: 'ON', addressCountry: SITE.country },
      areaServed: page.cities
        ? page.cities.map((c) => ({ '@type': 'City', name: c }))
        : { '@type': 'Country', name: 'Canada' },
    },
  ]
  return { '@context': 'https://schema.org', '@graph': graph }
}
