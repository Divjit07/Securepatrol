import L from 'leaflet'

/**
 * Breadcrumb trails — the route walked, not just the dots hit.
 *
 * A pin per scan tells you a guard was somewhere. Joining them in time order
 * tells you the ORDER, which is the thing an operator is actually judging: a
 * round walked lobby → 2 → 3 → roof reads as a clean sweep, and the same set of
 * pins walked roof → lobby → 3 → 2 reads as someone hitting tags out of
 * sequence. Same evidence, opposite conclusions.
 *
 * The line fades from old to recent so the eye lands on where the guard is NOW
 * without needing a legend.
 */

// One stable hue per guard so a trail keeps its identity across a repaint.
const GUARD_HUES = [96, 190, 268, 42, 330, 160, 14, 220]

export function guardColor(guardId, index = 0) {
  const hue = GUARD_HUES[index % GUARD_HUES.length]
  return `hsl(${hue} 70% 62%)`
}

/**
 * Group scans into per-guard, time-ordered tracks, split into separate segments
 * when there is a long gap — otherwise a guard's Monday trail joins to their
 * Tuesday trail with a straight line across the map, which is a lie.
 */
export function buildTracks(scans, { gapMinutes = 90 } = {}) {
  const byGuard = new Map()
  for (const s of scans) {
    if (s.guard_lat == null || s.guard_lng == null) continue
    const list = byGuard.get(s.guard_id) || []
    list.push(s)
    byGuard.set(s.guard_id, list)
  }

  const tracks = []
  let idx = 0
  for (const [guardId, list] of byGuard) {
    const ordered = [...list].sort(
      (a, b) => new Date(a.scanned_at) - new Date(b.scanned_at),
    )
    const segments = []
    let current = []
    for (const s of ordered) {
      if (current.length) {
        const gap = (new Date(s.scanned_at) - new Date(current[current.length - 1].scanned_at)) / 60000
        if (gap > gapMinutes) {
          segments.push(current)
          current = []
        }
      }
      current.push(s)
    }
    if (current.length) segments.push(current)

    tracks.push({
      guardId,
      guardName: ordered[0]?.profiles?.name || 'Guard',
      color: guardColor(guardId, idx),
      // Keep single-point segments: a guard who has just arrived after a long
      // break has no line to draw, but the head marker is exactly where the
      // operator needs to look. The polyline loop below no-ops on length 1.
      segments: segments.filter((seg) => seg.length >= 1),
      points: ordered,
      lastAt: ordered[ordered.length - 1]?.scanned_at || null,
    })
    idx += 1
  }
  return tracks
}

/**
 * Draw tracks into a layer group. Each segment is split into per-hop polylines
 * so opacity can ramp along the walk — a single polyline can only carry one
 * opacity, and the ramp is what makes recency readable at a glance.
 */
export function renderTracks(group, tracks, { onSelect } = {}) {
  group.clearLayers()

  for (const track of tracks) {
    for (const seg of track.segments) {
      for (let i = 1; i < seg.length; i += 1) {
        const a = seg[i - 1]
        const b = seg[i]
        const progress = i / (seg.length - 1)
        L.polyline(
          [
            [a.guard_lat, a.guard_lng],
            [b.guard_lat, b.guard_lng],
          ],
          {
            color: track.color,
            weight: 2 + progress * 2,
            opacity: 0.22 + progress * 0.6,
            lineCap: 'round',
            interactive: false,
          },
        ).addTo(group)
      }

      // The head of the trail: where this guard actually is.
      const head = seg[seg.length - 1]
      const marker = L.circleMarker([head.guard_lat, head.guard_lng], {
        radius: 6,
        color: track.color,
        weight: 2,
        fillColor: track.color,
        fillOpacity: 0.9,
      })
      marker.bindTooltip(
        `${track.guardName} · ${new Date(head.scanned_at).toLocaleTimeString([], {
          hour: 'numeric',
          minute: '2-digit',
        })}`,
        { direction: 'top', offset: [0, -8] },
      )
      if (onSelect) marker.on('click', () => onSelect(track))
      marker.addTo(group)
    }
  }
  return group
}

/**
 * Checkpoint staleness — colour by how long since anyone hit it, against the
 * site's own limit. Answers "what is being missed right now" without a table.
 */
export function checkpointStaleness(checkpoint, lastScanAt, limitMinutes = 120) {
  if (!lastScanAt) return { state: 'never', color: '#8b9284', label: 'Never scanned' }
  const mins = Math.round((Date.now() - new Date(lastScanAt)) / 60000)
  if (mins <= limitMinutes * 0.5) {
    return { state: 'fresh', color: '#96ee60', label: `${mins}m ago` }
  }
  if (mins <= limitMinutes) {
    return { state: 'ageing', color: '#ecfab5', label: `${mins}m ago` }
  }
  return { state: 'overdue', color: '#ef4444', label: `${mins}m ago · overdue` }
}
