/**
 * THESIS: A supply shop for a company whose product is the record. So this is a
 * requisition, not a storefront — it refuses the category arrangement of photo
 * grid, price chip and cart drawer, because trade gear is quoted per account and
 * a fake price would be a fake claim.
 *
 * OWN-WORLD: The marketing surface's own `--kr-*` olive ground, lime edge and
 * Archivo display. Catalogue lines are raised olive plates on the dark operator
 * side; the request you build lands on warm `kr-paper` with the printed rule
 * grid — the same paper every Kronus document prints on.
 *
 * STORY: An owner sees the kit Kronus supplies, adds sizes and counts, and sends
 * a requisition. Nothing is priced on screen; everything is quoted per account.
 *
 * FIRST VIEWPORT: Masthead with SHOP lit. Left two-thirds, a display line and the
 * category index. Right third, the paper requisition slip, empty and waiting —
 * the primary action lives on it and stays on screen the whole way down.
 *
 * FORM: Split catalogue/requisition, first on the ordered list — it is the only
 * structure where the thing you build is visible while you build it.
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Check, Minus, Plus, Send, X } from 'lucide-react'
import { CATEGORIES, PRODUCTS, findProduct, productsIn } from '../components/shop/catalogue.js'
import { RiderMark } from '../components/home/RiderMark.jsx'

const CONTACT = 'hello@kronus.space'

function lineKey(sku, size) {
  return size ? `${sku}::${size}` : sku
}

/** One catalogue line. Spec plate stands in until real photography exists. */
function ProductCard({ product, onAdd }) {
  const [size, setSize] = useState(product.sizes[0] || '')
  const [added, setAdded] = useState(false)

  const add = () => {
    onAdd(product, size)
    setAdded(true)
    window.setTimeout(() => setAdded(false), 1200)
  }

  return (
    <article
      className="flex flex-col overflow-hidden rounded-2xl border"
      style={{ background: 'var(--kr-raise)', borderColor: 'var(--kr-edge)', boxShadow: 'var(--kr-lift)' }}
    >
      {/* Image slot. `product.image` is null across the catalogue today, so this
          renders the part number as a spec plate rather than a broken frame. */}
      <div
        className={`relative flex items-center justify-center overflow-hidden border-b ${
          product.image ? 'aspect-[4/3]' : 'h-24'
        }`}
        style={{ background: 'var(--kr-ground)', borderColor: 'var(--kr-edge)' }}
      >
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <>
            <RiderMark className="absolute h-14 w-14 opacity-[0.07]" tight />
            <span
              className="kr-meas relative text-[13px] tracking-[0.22em]"
              style={{ color: 'var(--kr-ink-3)' }}
            >
              {product.sku}
            </span>
          </>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="kr-display text-[1.25rem]" style={{ color: 'var(--kr-ink)' }}>
          {product.name}
        </h3>
        <p className="mt-2 text-[0.9rem] leading-relaxed" style={{ color: 'var(--kr-ink-2)' }}>
          {product.summary}
        </p>

        <ul className="mt-4 space-y-1.5">
          {product.specs.map((spec) => (
            <li
              key={spec}
              className="flex items-start gap-2 text-[0.8rem]"
              style={{ color: 'var(--kr-ink-3)' }}
            >
              <span
                aria-hidden
                className="mt-[7px] h-[3px] w-[3px] shrink-0 rounded-full"
                style={{ background: 'var(--kr-lime)' }}
              />
              {spec}
            </li>
          ))}
        </ul>

        <div className="mt-auto pt-5">
          {product.sizes.length > 0 && (
            <div className="mb-3">
              <span
                className="kr-doc-label text-[10px]"
                style={{ color: 'var(--kr-ink-3)' }}
              >
                {product.sizeLabel || 'Size'}
              </span>
              <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label={`${product.name} size`}>
                {product.sizes.map((s) => {
                  const active = s === size
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSize(s)}
                      aria-pressed={active}
                      className="kr-meas min-h-[36px] min-w-[42px] rounded-lg px-2 text-[12px] transition"
                      style={{
                        background: active ? 'var(--kr-lime)' : 'transparent',
                        color: active ? '#12290d' : 'var(--kr-ink-2)',
                        border: `1px solid ${active ? 'var(--kr-lime)' : 'var(--kr-edge)'}`,
                        fontWeight: active ? 700 : 500,
                      }}
                    >
                      {s}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={add}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl text-[0.9rem] font-semibold transition"
            style={{
              background: added ? 'var(--kr-lime)' : 'transparent',
              color: added ? '#12290d' : 'var(--kr-ink)',
              border: `1px solid ${added ? 'var(--kr-lime)' : 'var(--kr-edge-strong)'}`,
            }}
          >
            {added ? (
              <>
                <Check className="h-4 w-4" /> Added
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" /> Add to requisition
              </>
            )}
          </button>
        </div>
      </div>
    </article>
  )
}

/** The paper side: what you are actually sending. */
function Requisition({ lines, onQty, onRemove, onClear }) {
  const [contact, setContact] = useState({ company: '', name: '', email: '', notes: '' })
  const total = lines.reduce((n, l) => n + l.qty, 0)

  const submit = (e) => {
    e.preventDefault()
    const body = [
      `Company: ${contact.company}`,
      `Contact: ${contact.name}`,
      `Email:   ${contact.email}`,
      '',
      'REQUISITION',
      ...lines.map(
        (l) => `${l.qty} x ${l.sku}  ${findProduct(l.sku)?.name}${l.size ? `  (${l.size})` : ''}`,
      ),
      '',
      contact.notes ? `Notes: ${contact.notes}` : '',
    ]
      .filter(Boolean)
      .join('\n')

    // No storefront backend yet: this composes the requisition as mail. Swap this
    // one call for an edge function when orders should land in the database.
    window.location.href = `mailto:${CONTACT}?subject=${encodeURIComponent(
      `Requisition — ${contact.company || 'new enquiry'}`,
    )}&body=${encodeURIComponent(body)}`
  }

  return (
    <form onSubmit={submit} className="kr-paper rounded-2xl p-6" style={{ boxShadow: 'var(--kr-lift-hi)' }}>
      <div className="flex items-baseline justify-between gap-3 border-b-2 pb-3" style={{ borderColor: 'rgba(23,26,18,0.45)' }}>
        <p className="flex items-center gap-2">
          <RiderMark className="h-5 w-5" />
          <span className="kr-display text-[1.1rem]">REQUISITION</span>
        </p>
        <span className="kr-meas text-[11px] opacity-60">{total} item{total === 1 ? '' : 's'}</span>
      </div>

      {lines.length === 0 ? (
        <p className="py-8 text-center text-sm" style={{ color: 'var(--kr-paper-ink-2)' }}>
          Empty. Add gear from the catalogue and it lands here as a line item.
        </p>
      ) : (
        <ul className="divide-y" style={{ borderColor: 'rgba(23,26,18,0.14)' }}>
          {lines.map((l) => {
            const p = findProduct(l.sku)
            return (
              <li key={lineKey(l.sku, l.size)} className="flex items-center gap-2 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.86rem] font-semibold">{p?.name}</p>
                  <p className="kr-meas text-[11px] opacity-60">
                    {l.sku}
                    {l.size ? ` · ${l.size}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onQty(l, -1)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border"
                    style={{ borderColor: 'rgba(23,26,18,0.2)' }}
                    aria-label={`One fewer ${p?.name}`}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="kr-meas w-7 text-center text-sm font-bold">{l.qty}</span>
                  <button
                    type="button"
                    onClick={() => onQty(l, 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border"
                    style={{ borderColor: 'rgba(23,26,18,0.2)' }}
                    aria-label={`One more ${p?.name}`}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(l)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg opacity-50 transition hover:opacity-100"
                    aria-label={`Remove ${p?.name}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <div className="mt-4 space-y-2.5">
        {[
          { k: 'company', label: 'Company', type: 'text', required: true },
          { k: 'name', label: 'Your name', type: 'text', required: true },
          { k: 'email', label: 'Email', type: 'email', required: true },
        ].map(({ k, label, type, required }) => (
          <label key={k} className="block">
            <span className="kr-doc-label text-[10px] opacity-70">{label}</span>
            <input
              type={type}
              required={required}
              value={contact[k]}
              onChange={(e) => setContact({ ...contact, [k]: e.target.value })}
              className="mt-1 min-h-[42px] w-full rounded-lg border bg-white/60 px-3 text-sm outline-none focus:border-current"
              style={{ borderColor: 'rgba(23,26,18,0.22)', color: 'var(--kr-paper-ink)' }}
            />
          </label>
        ))}
        <label className="block">
          <span className="kr-doc-label text-[10px] opacity-70">Notes</span>
          <textarea
            rows={2}
            value={contact.notes}
            onChange={(e) => setContact({ ...contact, notes: e.target.value })}
            placeholder="Sites, embroidery, delivery date…"
            className="mt-1 w-full rounded-lg border bg-white/60 px-3 py-2 text-sm outline-none"
            style={{ borderColor: 'rgba(23,26,18,0.22)', color: 'var(--kr-paper-ink)' }}
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={lines.length === 0}
        className="mt-4 flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-40"
        style={{ background: 'var(--kr-paper-ink)', color: 'var(--kr-paper)' }}
      >
        <Send className="h-4 w-4" /> Send requisition
      </button>
      <p className="mt-3 text-[11px] leading-relaxed" style={{ color: 'var(--kr-paper-ink-2)' }}>
        Priced per account — volume and contract terms change the number, so we quote rather
        than list. We reply with a costed sheet.
      </p>
      {lines.length > 0 && (
        <button
          type="button"
          onClick={onClear}
          className="mt-2 w-full text-[11px] underline underline-offset-2 opacity-60 transition hover:opacity-100"
        >
          Clear requisition
        </button>
      )}
    </form>
  )
}

export default function Shop() {
  const [lines, setLines] = useState([])

  const addLine = (product, size) => {
    setLines((prev) => {
      const key = lineKey(product.sku, size)
      const hit = prev.find((l) => lineKey(l.sku, l.size) === key)
      if (hit) return prev.map((l) => (l === hit ? { ...l, qty: l.qty + 1 } : l))
      return [...prev, { sku: product.sku, size, qty: 1 }]
    })
  }

  const changeQty = (line, delta) =>
    setLines((prev) =>
      prev
        .map((l) => (l === line ? { ...l, qty: Math.max(0, l.qty + delta) } : l))
        .filter((l) => l.qty > 0),
    )

  const removeLine = (line) => setLines((prev) => prev.filter((l) => l !== line))

  const count = useMemo(() => lines.reduce((n, l) => n + l.qty, 0), [lines])

  return (
    <div className="kr min-h-dvh">
      {/* Masthead — the document header, matching the marketing surface. */}
      <header
        className="sticky top-0 z-40 border-b backdrop-blur"
        style={{ borderColor: 'var(--kr-edge)', background: 'color-mix(in srgb, var(--kr-void) 88%, transparent)' }}
      >
        <div className="mx-auto flex max-w-[84rem] items-center gap-4 px-5 py-3.5 lg:px-8">
          <Link to="/" className="flex items-center gap-2.5">
            <RiderMark className="h-6 w-6" style={{ color: 'var(--kr-lime)' }} />
            <span className="kr-display text-[1.15rem]">KRONUS</span>
          </Link>
          <span className="kr-doc-label ml-1 text-[10px]" style={{ color: 'var(--kr-lime)' }}>
            Supply
          </span>
          <Link
            to="/"
            className="ml-auto flex items-center gap-1.5 text-sm transition hover:opacity-100"
            style={{ color: 'var(--kr-ink-2)' }}
          >
            <ArrowLeft className="h-4 w-4" /> The platform
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[84rem] px-5 pb-24 lg:px-8">
        {/* Hero */}
        <section className="grid gap-10 py-14 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:py-20">
          <div>
            <p className="kr-doc-label text-[11px]" style={{ color: 'var(--kr-lime)' }}>
              Supply catalogue
            </p>
            <h1 className="kr-display mt-4 text-[clamp(2.4rem,6vw,4.2rem)]">
              Kit the guards you already verify.
            </h1>
            <p className="mt-5 max-w-[46ch] text-[1.05rem] leading-relaxed" style={{ color: 'var(--kr-ink-2)' }}>
              Uniform, load-bearing kit and the checkpoint hardware the platform reads.
              Build a requisition, send it, and we come back with a costed sheet — trade
              pricing moves with volume, so nothing here carries a shelf price.
            </p>

            <nav aria-label="Categories" className="mt-8 flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <a
                  key={c.id}
                  href={`#${c.id}`}
                  className="rounded-full border px-4 py-2 text-sm font-medium transition"
                  style={{ borderColor: 'var(--kr-edge)', color: 'var(--kr-ink-2)' }}
                >
                  {c.name}
                </a>
              ))}
            </nav>
          </div>

          <div className="lg:sticky lg:top-24 lg:self-start">
            <Requisition
              lines={lines}
              onQty={changeQty}
              onRemove={removeLine}
              onClear={() => setLines([])}
            />
          </div>
        </section>

        {/* Catalogue */}
        {CATEGORIES.map((c) => (
          <section key={c.id} id={c.id} className="scroll-mt-24 border-t py-12" style={{ borderColor: 'var(--kr-edge)' }}>
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="kr-display text-[clamp(1.6rem,3vw,2.3rem)]">{c.name}</h2>
                <p className="mt-2 max-w-[52ch] text-[0.95rem]" style={{ color: 'var(--kr-ink-2)' }}>
                  {c.blurb}
                </p>
              </div>
              <span className="kr-meas text-[11px]" style={{ color: 'var(--kr-ink-3)' }}>
                {productsIn(c.id).length} lines
              </span>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {productsIn(c.id).map((p) => (
                <ProductCard key={p.sku} product={p} onAdd={addLine} />
              ))}
            </div>
          </section>
        ))}

        <p className="mt-14 max-w-[70ch] text-[0.82rem] leading-relaxed" style={{ color: 'var(--kr-ink-3)' }}>
          Restricted equipment — handcuffs, batons, aerosol irritants and ballistic armour —
          is not sold through this catalogue. Those are permit-controlled in several provinces
          and are handled on a licensed order, not a web form.
        </p>
      </main>

      {/* Mobile: the requisition is off-screen up top, so surface the count. */}
      {count > 0 && (
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault()
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
          className="fixed bottom-5 left-1/2 z-50 flex min-h-[48px] -translate-x-1/2 items-center gap-2 rounded-full px-5 text-sm font-bold lg:hidden"
          style={{ background: 'var(--kr-lime)', color: '#12290d', boxShadow: 'var(--kr-lift-hi)' }}
        >
          <Send className="h-4 w-4" /> {count} item{count === 1 ? '' : 's'} · Review requisition
        </a>
      )}
    </div>
  )
}
