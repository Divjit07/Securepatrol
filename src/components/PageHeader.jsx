/**
 * The page title for every admin, client and guard screen (26 pages).
 *
 * These read as labels rather than headings when set in the UI face at weight
 * 500 — a page title has to win against a dark rail and a wall of data cards.
 * So: the display face at full bold, a real display size, and a document rule
 * closing the block, which is the same "this is a record" device the marketing
 * surface uses. Deliberately no uppercase eyebrow — one named kicker is a
 * system, an eyebrow on all 26 pages is just grammar nobody chose.
 */
export default function PageHeader({ title, description, action }) {
  return (
    <div className="mb-7 border-b border-[color:var(--hairline)] pb-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-[1.9rem] font-bold leading-[1.05] tracking-[-0.035em] text-ink sm:text-[2.4rem]">
            {title}
          </h1>
          {description && (
            <p className="mt-2 max-w-2xl text-[0.95rem] leading-relaxed text-ink-2">{description}</p>
          )}
        </div>
        {action && (
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:pb-1">{action}</div>
        )}
      </div>
    </div>
  )
}
