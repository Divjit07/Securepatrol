/**
 * Progressive enhancement for the homepage. Runs over already-rendered markup —
 * the prerendered static HTML on kronus.space, or React's DOM in the app — and
 * returns a cleanup function (React StrictMode mounts effects twice).
 *
 * Everything is optional: with JS off the page still reads top to bottom, the
 * demos show a complete frame, prices show monthly, FAQs open natively and the
 * form falls back to email. Motion stops under prefers-reduced-motion, when a
 * demo is off screen, and when the tab is hidden.
 */
import { DEMO, DEMO_SITE, GPS, NIGHT, PATROL, SITE, STEPS } from './content.js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const pad = (n) => String(n).padStart(2, '0')
const clock = (mins) => `${pad(Math.floor(mins / 60) % 24)}:${pad(mins % 60)}`

export function enhance(root) {
  if (!root || typeof window === 'undefined') return () => {}
  const off = []
  const on = (el, ev, fn, opts) => {
    if (!el) return
    el.addEventListener(ev, fn, opts)
    off.push(() => el.removeEventListener(ev, fn, opts))
  }
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const observe = (el, cb, opts) => {
    if (!el || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver((entries) => entries.forEach(cb), opts)
    io.observe(el)
    off.push(() => io.disconnect())
  }

  // The static page's head script hides the highlighter until we're ready to
  // draw it, so it lands once instead of flashing in, out and back.
  const html = document.documentElement
  if (html.classList.contains('mk-arrive')) {
    requestAnimationFrame(() => requestAnimationFrame(() => html.classList.remove('mk-arrive')))
  }

  header(root, on, observe)
  liveShift(root, on, observe, off, reduce)
  beforeAfter(root, on, observe, off, reduce)
  guardTourSim(root, on, off)
  nightStory(root, on, off, reduce)
  patrolGame(root, on, observe, off, reduce)
  tourTabs(root, on)
  clientAsks(root, on, observe, reduce)
  patrolMap(root, on, observe, off, reduce)
  calculator(root, on, reduce)
  billing(root, on)
  demoForm(root, on)

  return () => off.forEach((fn) => fn())
}

/* ---------- Header, nav position, mobile menu ----------------------------- */
function header(root, on, observe) {
  const head = root.querySelector('[data-mk-header]')
  const links = [...root.querySelectorAll('[data-mk-navlink]')]
  const onScroll = () => {
    head?.classList.toggle('is-scrolled', window.scrollY > 8)
    // Back at the top, nothing is "current" any more.
    if (window.scrollY < 300) links.forEach((l) => l.classList.remove('is-current'))
  }
  onScroll()
  on(window, 'scroll', onScroll, { passive: true })

  links.forEach((a) => {
    const target = root.querySelector(a.getAttribute('href'))
    observe(
      target,
      (e) => {
        if (!e.isIntersecting) return
        links.forEach((l) => l.classList.toggle('is-current', l === a))
      },
      { rootMargin: '-45% 0px -50% 0px' },
    )
  })

  const menu = root.querySelector('[data-mk-menu]')
  if (menu) {
    on(menu, 'click', (e) => {
      if (e.target.closest('a')) menu.open = false
    })
    on(document, 'click', (e) => {
      if (menu.open && !menu.contains(e.target)) menu.open = false
    })
    on(document, 'keydown', (e) => {
      if (e.key === 'Escape' && menu.open) {
        menu.open = false
        menu.querySelector('summary')?.focus()
      }
    })
  }
}

/* ---------- Hero: the live shift ------------------------------------------ */
function liveShift(root, on, observe, off, reduce) {
  const el = root.querySelector('[data-mk-live]')
  if (!el) return
  const $ = (s) => el.querySelector(s)
  const feed = $('[data-live-feed]')
  const phone = $('[data-live-phone]')
  const stateEl = $('[data-live-state]')
  const cpEl = $('[data-live-cp]')
  const metaEl = $('[data-live-meta]')
  const countEl = $('[data-live-count]')
  const roundEl = $('[data-live-round]')
  const bar = $('[data-live-bar]')
  const alertEl = $('[data-live-alert]')
  const alertTitle = $('[data-live-alert-title]')
  const alertText = $('[data-live-alert-text]')
  const toggle = $('[data-live-toggle]')
  const toggleLabel = $('[data-live-toggle-label]')
  const okIcon = feed.querySelector('.mk-feed-ok')
  const cps = DEMO_SITE.checkpoints

  let idx = feed.children.length // next checkpoint to scan
  let count = idx
  let round = 1
  let minutes = DEMO_SITE.startMinutes + (idx - 1) * 9
  let ticks = 0
  let visible = false
  let paused = reduce
  let running = false
  let timers = []
  const later = (fn, ms) => timers.push(setTimeout(fn, ms))

  const setCount = (n) => {
    count = n
    countEl.textContent = n
    bar.style.transform = `scaleX(${n / cps.length})`
  }

  const row = (cp, t) => {
    const li = document.createElement('li')
    li.className = 'is-new'
    const time = document.createElement('time')
    time.textContent = t
    const name = document.createElement('span')
    name.className = 'mk-feed-cp'
    name.append(cp.name)
    const floor = document.createElement('small')
    floor.textContent = cp.floor
    name.append(floor)
    const chip = document.createElement('span')
    chip.className = 'mk-chip'
    chip.textContent = cp.method
    li.append(time, name, chip, okIcon.cloneNode(true))
    return li
  }

  const raiseAlert = () => {
    alertEl.dataset.kind = 'late'
    alertTitle.textContent = DEMO_SITE.alert.lateTitle
    alertText.textContent = DEMO_SITE.alert.late
    alertEl.hidden = false
    later(() => {
      alertEl.dataset.kind = 'fixed'
      alertTitle.textContent = DEMO_SITE.alert.fixedTitle
      alertText.textContent = DEMO_SITE.alert.fixed
      alertEl.style.animation = 'none'
      void alertEl.offsetWidth
      alertEl.style.animation = ''
    }, 2800)
    later(() => (alertEl.hidden = true), 5000)
  }

  const step = () => {
    if (!running) return
    const cp = cps[idx % cps.length]
    minutes += 6 + ((idx * 5) % 7)
    const t = clock(minutes)
    phone.dataset.state = 'scanning'
    stateEl.textContent = 'Hold near tag…'
    cpEl.textContent = cp.name
    metaEl.textContent = `${cp.floor} · ${cp.method}`

    later(() => {
      phone.dataset.state = 'done'
      stateEl.textContent = 'Scanned'
      metaEl.textContent = `${t} · ${cp.method} tap ✓`
      feed.prepend(row(cp, t))
      while (feed.children.length > 5) feed.lastElementChild.remove()
      setCount(count + 1)
      if (count >= cps.length) {
        later(() => {
          round += 1
          roundEl.textContent = round
          setCount(0)
        }, 1500)
      }
      ticks += 1
      if (ticks % 6 === 2) raiseAlert()
    }, 1150)

    idx += 1
    later(step, 3300)
  }

  const start = () => {
    if (running || paused || !visible || document.hidden) return
    running = true
    later(step, 600)
  }
  const stop = () => {
    running = false
    timers.forEach(clearTimeout)
    timers = []
    phone.dataset.state = 'done'
    stateEl.textContent = 'Scanned'
  }
  off.push(stop)

  observe(el, (e) => {
    visible = e.isIntersecting
    visible ? start() : stop()
  }, { threshold: 0.25 })
  on(document, 'visibilitychange', () => (document.hidden ? stop() : start()))

  on(toggle, 'click', () => {
    paused = !paused
    toggle.setAttribute('aria-pressed', String(paused))
    toggleLabel.textContent = paused ? 'Play demo' : 'Pause demo'
    paused ? stop() : start()
  })
  if (reduce) {
    toggle.setAttribute('aria-pressed', 'true')
    toggleLabel.textContent = 'Play demo'
  }
}

/* ---------- Old way vs Kronus --------------------------------------------- */
function beforeAfter(root, on, observe, off, reduce) {
  const sec = root.querySelector('[data-mk-ba]')
  if (!sec) return
  const buttons = [...sec.querySelectorAll('[data-ba-set]')]
  let touched = false
  const set = (v) => {
    sec.dataset.ba = v
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.baSet === v)))
  }
  buttons.forEach((b) =>
    on(b, 'click', () => {
      touched = true
      set(b.dataset.baSet)
    }),
  )
  // Flip it once for people who never touch the switch: the change is the point.
  if (!reduce) {
    let timer
    observe(sec, (e) => {
      clearTimeout(timer)
      if (e.isIntersecting && !touched && sec.dataset.ba === 'old') {
        timer = setTimeout(() => !touched && set('new'), 2200)
      }
    }, { threshold: 0.55 })
    off.push(() => clearTimeout(timer))
  }
}

/* ---------- Tabs (shared by How it works and the product tour) ----------- */
function tabs(list, panels, on, onSelect) {
  const items = [...list.querySelectorAll('[role="tab"]')]
  const select = (i, focus) => {
    items.forEach((t, j) => {
      t.setAttribute('aria-selected', String(j === i))
      t.tabIndex = j === i ? 0 : -1
    })
    panels.forEach((p, j) => (p.hidden = j !== i))
    if (focus) items[i].focus()
    onSelect?.(i)
  }
  items.forEach((t, i) => on(t, 'click', () => select(i, false)))
  on(list, 'keydown', (e) => {
    const cur = items.findIndex((t) => t.getAttribute('aria-selected') === 'true')
    const map = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }
    let next = null
    if (e.key in map) next = (cur + map[e.key] + items.length) % items.length
    if (e.key === 'Home') next = 0
    if (e.key === 'End') next = items.length - 1
    if (next === null) return
    e.preventDefault()
    select(next, true)
  })
  return { items, select }
}

function tourTabs(root, on) {
  const sec = root.querySelector('[data-mk-tour]')
  if (!sec) return
  tabs(sec.querySelector('[role="tablist"]'), [...sec.querySelectorAll('[data-tour-panel]')], on)
}

/* ---------- One night: the scroll story ----------------------------------- */
function nightStory(root, on, off, reduce) {
  const sec = root.querySelector('[data-mk-story]')
  if (!sec || reduce) return // reduced motion keeps the plain list
  const moments = [...sec.querySelectorAll('[data-story-moment]')]
  const jumps = [...sec.querySelectorAll('[data-story-jump]')]
  const fill = sec.querySelector('[data-story-fill]')
  const n = moments.length
  let cur = -1

  const setActive = (i) => {
    if (i === cur) return
    cur = i
    moments.forEach((m, j) => m.classList.toggle('is-active', j === i))
    jumps.forEach((b, j) => (j === i ? b.setAttribute('aria-current', 'true') : b.removeAttribute('aria-current')))
    // Night until the morning moments, then the whole section turns to day.
    sec.dataset.phase = NIGHT.moments[i].day ? 'day' : 'night'
  }

  sec.classList.add('is-pinned')
  off.push(() => sec.classList.remove('is-pinned'))
  let ticking = false
  const update = () => {
    ticking = false
    const total = sec.offsetHeight - window.innerHeight
    const p = total > 0 ? Math.min(1, Math.max(0, -sec.getBoundingClientRect().top / total)) : 0
    fill.style.setProperty('--p', String(p))
    setActive(Math.min(n - 1, Math.floor(p * n)))
  }
  const onScroll = () => {
    if (ticking) return
    ticking = true
    requestAnimationFrame(update)
  }
  update()
  on(window, 'scroll', onScroll, { passive: true })
  on(window, 'resize', onScroll)

  // The rail is a clock you can click: it scrolls to that moment.
  jumps.forEach((b, i) =>
    on(b, 'click', () => {
      const total = sec.offsetHeight - window.innerHeight
      const top = sec.getBoundingClientRect().top + window.scrollY + ((i + 0.5) / n) * total
      window.scrollTo({ top, behavior: 'smooth' })
    }),
  )
}

/* ---------- How it works: the hands-on simulator -------------------------- */
function guardTourSim(root, on, off) {
  const sim = root.querySelector('[data-sim]')
  if (!sim) return
  const sec = root.querySelector('[data-mk-steps]')
  const $ = (s) => sim.querySelector(s)
  const stepBtns = [...sec.querySelectorAll('[data-step]')]
  const bars = [1, 2, 3].map((n) => sec.querySelector(`[data-step-progress="${n}"]`))
  const spots = [...sim.querySelectorAll('[data-spot]')]
  const tray = [...sim.querySelectorAll('[data-tray]')]
  const cards = [...sim.querySelectorAll('[data-sim-card]')]
  const guard = $('[data-sim-guard]')
  const phone = $('[data-sim-phone]')
  const stateEl = $('[data-sim-state]')
  const cpEl = $('[data-sim-cp]')
  const scannedEl = $('[data-sim-scanned]')
  const placedEl = $('[data-sim-placed]')
  const done1 = $('[data-sim-done="1"]')
  const done2 = $('[data-sim-done="2"]')
  const rowsEl = $('[data-sim-rows]')
  const report = $('[data-sim-report]')
  const send = $('[data-sim-send]')
  const sendLabel = $('[data-sim-send-label]')
  const restart = $('[data-sim-restart]')
  const okIcon = rowsEl.querySelector('svg')?.cloneNode(true)
  const byId = Object.fromEntries(STEPS.spots.map((s) => [s.id, s]))
  const spotEl = (id) => spots.find((s) => s.dataset.spot === id)
  const N = spots.length

  let placed = new Set()
  let scans = []
  let pending = new Set()
  let minutes = STEPS.startMinutes
  let timers = []
  const later = (fn, ms) => timers.push(setTimeout(fn, ms))
  off.push(() => timers.forEach(clearTimeout))

  const progress = () => {
    bars[0].style.transform = `scaleX(${placed.size / N})`
    bars[1].style.transform = `scaleX(${scans.length / N})`
    bars[2].style.transform = `scaleX(${report.classList.contains('is-sent') ? 1 : 0})`
  }
  const setStep = (n) => {
    sim.dataset.step = String(n)
    cards.forEach((c) => (c.hidden = c.dataset.simCard !== String(n)))
    stepBtns.forEach((b) =>
      b.dataset.step === String(n) ? b.setAttribute('aria-current', 'step') : b.removeAttribute('aria-current'),
    )
  }
  const moveGuard = (s) => {
    guard.style.left = `${s.x}%`
    guard.style.top = `${s.y}%`
  }

  const place = (id) => {
    if (placed.has(id)) return
    placed.add(id)
    spotEl(id).dataset.state = 'placed'
    tray.find((t) => t.dataset.tray === id)?.setAttribute('data-used', '')
    placedEl.textContent = placed.size
    progress()
    if (placed.size === N) {
      done1.hidden = false
      later(() => sim.dataset.step === '1' && go(2), 1300)
    }
  }

  const renderRows = () => {
    rowsEl.replaceChildren(
      ...scans.map((s, i) => {
        const tr = document.createElement('tr')
        if (i === scans.length - 1) tr.className = 'is-new'
        for (const v of [s.t, s.name, s.method]) {
          const td = document.createElement('td')
          td.textContent = v
          tr.append(td)
        }
        const td = document.createElement('td')
        if (okIcon) td.append(okIcon.cloneNode(true))
        tr.append(td)
        return tr
      }),
    )
  }

  const scan = (id, fast = false) => {
    if (!placed.has(id) || pending.has(id) || scans.some((s) => s.id === id)) return
    pending.add(id)
    const s = byId[id]
    moveGuard(s)
    phone.dataset.state = 'scanning'
    stateEl.textContent = 'Hold near tag…'
    cpEl.textContent = s.name
    const finish = () => {
      pending.delete(id)
      minutes += scans.length ? 7 + ((scans.length * 3) % 5) : 0
      const t = clock(minutes)
      scans.push({ ...s, t })
      const el = spotEl(id)
      el.dataset.state = 'scanned'
      el.classList.add('is-scanning')
      later(() => el.classList.remove('is-scanning'), 1700)
      phone.dataset.state = 'done'
      stateEl.textContent = `Scanned · ${t}`
      cpEl.textContent = s.name
      scannedEl.textContent = scans.length
      progress()
      if (scans.length === N && !fast) {
        done2.hidden = false
        later(() => sim.dataset.step === '2' && go(3), 1400)
      }
    }
    fast ? finish() : later(finish, 750)
  }

  // Jumping ahead does the earlier steps for you, so every step always makes sense.
  const go = (n) => {
    if (n >= 2) STEPS.spots.forEach((s) => place(s.id))
    if (n >= 3) STEPS.spots.forEach((s) => scan(s.id, true))
    if (n === 3) renderRows()
    setStep(n)
  }

  const reset = () => {
    timers.forEach(clearTimeout)
    timers = []
    placed = new Set()
    scans = []
    pending = new Set()
    minutes = STEPS.startMinutes
    spots.forEach((s) => (s.dataset.state = 'empty'))
    tray.forEach((t) => t.removeAttribute('data-used'))
    placedEl.textContent = '0'
    scannedEl.textContent = '0'
    moveGuard(STEPS.guardStart)
    phone.dataset.state = 'idle'
    stateEl.textContent = 'Ready'
    cpEl.textContent = 'Tap a tag on the building'
    done1.hidden = true
    done2.hidden = true
    report.classList.remove('is-sent')
    send.disabled = false
    sendLabel.textContent = 'Send to the client’s portal'
    restart.hidden = true
    rowsEl.replaceChildren()
    progress()
    setStep(1)
  }

  stepBtns.forEach((b) => on(b, 'click', () => go(Number(b.dataset.step))))
  spots.forEach((el) =>
    on(el, 'click', () => {
      const step = sim.dataset.step
      if (step === '1') place(el.dataset.spot)
      else if (step === '2') scan(el.dataset.spot)
    }),
  )

  // Tray: drag a tag onto its spot, or just click it.
  // A drag ends in a click on the same tag; ignore that one click only.
  let suppressUntil = 0
  tray.forEach((t) => {
    on(t, 'click', () => {
      if (performance.now() < suppressUntil) return
      place(t.dataset.tray)
    })
    on(t, 'pointerdown', (e) => {
      if (sim.dataset.step !== '1' || e.button > 0) return
      if (e.pointerType === 'mouse') e.preventDefault() // no text selection while dragging
      const id = t.dataset.tray
      const target = spotEl(id)
      const start = { x: e.clientX, y: e.clientY }
      let ghost = null
      const move = (ev) => {
        if (!ghost && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 6) {
          ghost = document.createElement('span')
          ghost.className = 'mk-tray-ghost'
          ghost.append(t.querySelector('.mk-tray-chip > *').cloneNode(true))
          document.body.append(ghost)
          t.classList.add('is-lifted')
          target.dataset.target = 'on'
        }
        if (ghost) {
          ghost.style.left = `${ev.clientX}px`
          ghost.style.top = `${ev.clientY}px`
        }
      }
      const up = (ev) => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        window.removeEventListener('pointercancel', up)
        if (!ghost) return // a plain click — the click handler places it
        const r = target.getBoundingClientRect()
        const hit =
          ev.type === 'pointerup' &&
          Math.hypot(ev.clientX - (r.left + r.width / 2), ev.clientY - (r.top + r.height / 2)) < 60
        ghost.remove()
        t.classList.remove('is-lifted')
        delete target.dataset.target
        suppressUntil = performance.now() + 350
        if (hit) place(id)
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
      window.addEventListener('pointercancel', up)
    })
  })

  on(send, 'click', () => {
    report.classList.add('is-sent')
    send.disabled = true
    sendLabel.textContent = 'Sent — it’s in your client’s portal'
    restart.hidden = false
    progress()
  })
  on(restart, 'click', reset)

  reset()
}

/* ---------- Walk the round: flashlight patrol ------------------------------ */
function patrolGame(root, on, observe, off, reduce) {
  const stage = root.querySelector('[data-patrol-stage]')
  if (!stage) return
  const sec = root.querySelector('[data-mk-patrol]')
  const tags = [...stage.querySelectorAll('[data-patrol-tag]')]
  const feed = sec.querySelector('[data-patrol-feed]')
  const empty = sec.querySelector('[data-patrol-empty]')
  const countEl = sec.querySelector('[data-patrol-count]')
  const bar = sec.querySelector('[data-patrol-bar]')
  const done = stage.querySelector('[data-patrol-done]')
  const hint = stage.querySelector('[data-patrol-hint]')
  const okIcon = root.querySelector('[data-live-feed] .mk-feed-ok')
  let minutes = PATROL.startMinutes
  let found = 0
  let touched = false

  stage.dataset.dark = 'on'
  const light = (x, y) => {
    stage.style.setProperty('--x', `${x}%`)
    stage.style.setProperty('--y', `${y}%`)
  }
  const fromEvent = (e) => {
    const r = stage.getBoundingClientRect()
    light(((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100)
  }
  on(stage, 'pointermove', (e) => {
    touched = true
    fromEvent(e)
  })
  on(stage, 'pointerdown', (e) => {
    touched = true
    fromEvent(e)
  })

  // Until someone takes the torch, it sweeps the parkade by itself.
  let raf = 0
  let visible = false
  const wander = (t) => {
    if (touched || !visible || stage.dataset.lights === 'on') return (raf = 0)
    light(46 + Math.sin(t / 1700) * 30, 46 + Math.sin(t / 1100) * 9)
    raf = requestAnimationFrame(wander)
  }
  if (!reduce) {
    observe(stage, (e) => {
      visible = e.isIntersecting
      if (visible && !raf) raf = requestAnimationFrame(wander)
    }, { threshold: 0.3 })
  } else {
    stage.style.setProperty('--r', '320px')
  }
  off.push(() => cancelAnimationFrame(raf))

  const setCount = () => {
    countEl.textContent = found
    bar.style.transform = `scaleX(${found / tags.length})`
    empty.hidden = found > 0
  }
  const addRow = (name) => {
    minutes += 3 + (found % 3)
    const li = document.createElement('li')
    li.className = 'is-new'
    const time = document.createElement('time')
    time.textContent = clock(minutes)
    const cp = document.createElement('span')
    cp.className = 'mk-feed-cp'
    cp.append(name)
    const small = document.createElement('small')
    small.textContent = 'Parkade P2'
    cp.append(small)
    const chip = document.createElement('span')
    chip.className = 'mk-chip'
    chip.textContent = 'NFC'
    li.append(time, cp, chip)
    if (okIcon) li.append(okIcon.cloneNode(true))
    feed.prepend(li)
  }
  const lightsOn = () => {
    stage.dataset.lights = 'on'
    hint.hidden = true
  }

  tags.forEach((tag) => {
    on(tag, 'focus', () => {
      touched = true
      const r = stage.getBoundingClientRect()
      const t = tag.getBoundingClientRect()
      light(((t.left + t.width / 2 - r.left) / r.width) * 100, ((t.top + t.height / 2 - r.top) / r.height) * 100)
    })
    on(tag, 'click', () => {
      touched = true
      if (tag.classList.contains('is-scanned')) return
      tag.classList.add('is-scanned')
      tag.setAttribute('aria-pressed', 'true')
      found += 1
      addRow(tag.dataset.name)
      setCount()
      if (found === tags.length) {
        lightsOn()
        done.hidden = false
      }
    })
  })
  on(sec.querySelector('[data-patrol-lights]'), 'click', lightsOn)
  on(sec.querySelector('[data-patrol-reset]'), 'click', () => {
    tags.forEach((t) => {
      t.classList.remove('is-scanned')
      t.setAttribute('aria-pressed', 'false')
    })
    feed.replaceChildren()
    found = 0
    minutes = PATROL.startMinutes
    setCount()
    done.hidden = true
    hint.hidden = false
    delete stage.dataset.lights
    light(38, 52)
  })
}

/* ---------- Your client asks: the chat ----------------------------------- */
function clientAsks(root, on, observe, reduce) {
  const sec = root.querySelector('[data-mk-asks]')
  if (!sec) return
  tabs(sec.querySelector('[role="tablist"]'), [...sec.querySelectorAll('[role="tabpanel"]')], on)
  if (reduce) return
  // Hold the first conversation until it's on screen, then let it play.
  sec.dataset.asks = 'armed'
  observe(sec.querySelector('.mk-chat'), (e) => {
    if (e.isIntersecting) sec.dataset.asks = 'live'
  }, { threshold: 0.45 })
}

/* ---------- GPS patrol replay --------------------------------------------- */
function patrolMap(root, on, observe, off, reduce) {
  const map = root.querySelector('[data-mk-map]')
  if (!map) return
  const trail = map.querySelector('[data-map-trail]')
  const stops = [...map.querySelectorAll('[data-map-stop]')]
  const guard = map.querySelector('[data-map-guard]')
  const range = map.querySelector('[data-map-range]')
  const play = map.querySelector('[data-map-play]')
  const timeEl = map.querySelector('[data-map-time]')
  const siteEl = map.querySelector('[data-map-site]')
  const labelEl = map.querySelector('[data-map-label]')
  const proofEl = map.querySelector('[data-map-proof]')
  const pts = GPS.stops
  const siteName = (id) => GPS.sites.find((s) => s.id === id)?.name || ''

  const lens = [0]
  for (let i = 1; i < pts.length; i++) {
    lens[i] = lens[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
  }
  const total = lens[lens.length - 1]
  trail.style.strokeDasharray = `${total}`
  guard.removeAttribute('transform')

  const set = (n) => {
    const i = n - 1
    const p = pts[i]
    trail.style.strokeDashoffset = `${total - lens[i]}`
    stops.forEach((s, j) => {
      s.classList.toggle('is-hidden', j > i)
      s.classList.toggle('is-current', j === i)
    })
    guard.style.transform = `translate(${p.x}px, ${p.y}px)`
    range.value = String(n)
    range.style.setProperty('--fill', `${((n - 1) / (pts.length - 1)) * 100}%`)
    range.setAttribute('aria-valuetext', `${p.t}, ${siteName(p.site)}, ${p.label}`)
    timeEl.textContent = p.t
    siteEl.textContent = siteName(p.site)
    labelEl.textContent = p.label
    // GPS only ever verifies clock-in/out; a patrol stop is proven by the tap.
    proofEl.textContent =
      p.kind === 'clock'
        ? `${i === 0 ? 'Clock-in' : 'Clock-out'} inside geofence`
        : `${p.method || 'NFC'} tap on the tag`
  }

  let timer = null
  const stopPlay = () => {
    clearInterval(timer)
    timer = null
    play.setAttribute('aria-pressed', 'false')
    play.setAttribute('aria-label', 'Play the patrol replay')
  }
  const startPlay = () => {
    if (Number(range.value) >= pts.length) set(1)
    play.setAttribute('aria-pressed', 'true')
    play.setAttribute('aria-label', 'Pause the patrol replay')
    timer = setInterval(() => {
      const n = Number(range.value) + 1
      if (n > pts.length) return stopPlay()
      set(n)
    }, 850)
  }
  off.push(stopPlay)

  set(pts.length)
  on(play, 'click', () => (timer ? stopPlay() : startPlay()))
  on(range, 'input', () => {
    stopPlay()
    set(Number(range.value))
  })

  // Replay once on arrival, so the trail is seen being drawn, not just drawn.
  if (!reduce) {
    let played = false
    observe(map, (e) => {
      if (e.isIntersecting && !played) {
        played = true
        set(1)
        setTimeout(startPlay, 500)
      } else if (!e.isIntersecting && timer) {
        stopPlay()
      }
    }, { threshold: 0.45 })
  }
}

/* ---------- Savings calculator -------------------------------------------- */
function calculator(root, on, reduce) {
  // Numbers roll to their new value instead of jumping — you see them respond.
  const tween = (el, to, fmt) => {
    const from = Number(el.dataset.v ?? to)
    el.dataset.v = String(to)
    if (reduce || from === to) return (el.textContent = fmt(to))
    const t0 = performance.now()
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / 380)
      const e = 1 - Math.pow(1 - k, 3)
      el.textContent = fmt(Math.round(from + (to - from) * e))
      if (k < 1 && el.dataset.v === String(to)) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }
  const calc = root.querySelector('[data-mk-calc]')
  if (!calc) return
  const field = (id) => calc.querySelector(`[data-calc="${id}"]`)
  const num = (id) => {
    const el = field(id)
    const v = Number(el.value)
    const min = Number(el.min || 0)
    const max = Number(el.max || 1e6)
    return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : min
  }
  const fill = (el) => {
    const pct = ((Number(el.value) - Number(el.min)) / (Number(el.max) - Number(el.min))) * 100
    el.style.setProperty('--fill', `${pct}%`)
  }
  const hoursEl = calc.querySelector('[data-calc-hours]')
  const dollarsEl = calc.querySelector('[data-calc-dollars]')

  const update = () => {
    const g = num('guards')
    const s = num('sites')
    const hours = Math.round((g * num('minGuard') * 4.33 + s * num('minSite') * 30) / 60)
    const dollars = Math.round(hours * num('rate'))
    calc.querySelector('[data-calc-out="guards"]').textContent = g
    calc.querySelector('[data-calc-out="sites"]').textContent = s
    tween(hoursEl, hours, (n) => n.toLocaleString('en-CA'))
    tween(dollarsEl, dollars, (n) => `$${n.toLocaleString('en-CA')}`)
    calc.querySelectorAll('input[type="range"]').forEach(fill)
  }
  calc.querySelectorAll('[data-calc]').forEach((el) => on(el, 'input', update))
  update()
}

/* ---------- Billing period ------------------------------------------------- */
function billing(root, on) {
  const pricing = root.querySelector('[data-mk-pricing]')
  pricing?.querySelectorAll('[data-billing-set]').forEach((btn) => {
    on(btn, 'click', () => {
      pricing.dataset.billing = btn.dataset.billingSet
      pricing
        .querySelectorAll('[data-billing-set]')
        .forEach((b) => b.setAttribute('aria-pressed', String(b === btn)))
    })
  })
}

/* ---------- Demo form ------------------------------------------------------ */
function demoForm(root, on) {
  const form = root.querySelector('[data-mk-demo-form]')
  const done = root.querySelector('[data-mk-form-done]')
  const errorEl = root.querySelector('[data-mk-form-error]')
  const label = root.querySelector('[data-mk-submit-label]')

  // A "Start free trial" button carries its plan into the form.
  root.querySelectorAll('[data-plan]').forEach((a) => {
    on(a, 'click', () => {
      if (form?.elements.plan) form.elements.plan.value = a.dataset.plan
    })
  })
  if (!form) return

  const showError = (msg) => {
    errorEl.textContent = msg
    errorEl.hidden = !msg
  }
  const finish = () => {
    form.hidden = true
    done.hidden = false
    done.focus()
  }

  on(form, 'submit', async (e) => {
    e.preventDefault()
    const f = form.elements
    const data = {
      name: f.name.value.trim(),
      company: f.company.value.trim(),
      email: f.email.value.trim(),
      phone: f.phone.value.trim() || null,
      guards: form.querySelector('input[name="guards"]:checked')?.value || null,
      message: f.message.value.trim() || null,
      plan: f.plan.value || null,
      source: sourceTag(),
    }
    if (f.website.value) return finish() // honeypot: bots fill every field

    const missing = !data.name ? f.name : !data.company ? f.company : !EMAIL_RE.test(data.email) ? f.email : null
    if (missing) {
      showError(
        missing === f.email
          ? 'Please enter a valid email so we can reach you.'
          : 'Please add your name and company.',
      )
      missing.focus()
      return
    }
    showError('')
    const button = form.querySelector('button[type="submit"]')
    button.disabled = true
    if (label) label.textContent = 'Sending…'
    try {
      if (!(await saveRequest(data))) mailtoFallback(data)
    } catch {
      mailtoFallback(data)
    } finally {
      button.disabled = false
      if (label) label.textContent = DEMO.submit
    }
    finish()
  })
}

/** Where the lead came from: the page path plus any utm_* campaign tags. */
function sourceTag() {
  const params = new URLSearchParams(window.location.search)
  const utm = [...params].filter(([k]) => k.startsWith('utm_')).map(([k, v]) => `${k}=${v}`)
  return [window.location.pathname, ...utm].join(' ').slice(0, 200)
}

/** Insert into public.demo_requests (migration 051). false = not saved. */
async function saveRequest(data) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return false
  const res = await fetch(`${SUPABASE_URL}/rest/v1/demo_requests`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(data),
  })
  return res.ok
}

/** If the database is unreachable, hand the request to the visitor's mail app. */
function mailtoFallback(d) {
  const body = [
    `Name: ${d.name}`,
    `Company: ${d.company}`,
    `Email: ${d.email}`,
    d.phone && `Phone: ${d.phone}`,
    d.guards && `Guards: ${d.guards}`,
    d.plan && `Plan: ${d.plan}`,
    d.message && `\n${d.message}`,
  ]
    .filter(Boolean)
    .join('\n')
  window.location.href = `mailto:${SITE.email}?subject=${encodeURIComponent(
    `Kronus demo request — ${d.company}`,
  )}&body=${encodeURIComponent(body)}`
}
