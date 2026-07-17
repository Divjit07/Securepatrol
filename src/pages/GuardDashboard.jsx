import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, ScanLine, AlertTriangle, Lock } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import PageHeader from '../components/PageHeader.jsx'
import ClockInCard from '../components/ClockInCard.jsx'
import ClientShiftBar from '../components/ClientShiftBar.jsx'
import GuardClockedInPanel from '../components/GuardClockedInPanel.jsx'
import NextShiftCard from '../components/NextShiftCard.jsx'
import CheckpointCard from '../components/CheckpointCard.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import { useClientShift, getScheduledShiftForDate } from '../hooks/useClientShift.js'
import { useSiteHours } from '../hooks/useSiteHours.js'
import { useClientSiteData } from '../hooks/useClientSiteData.js'
import { useGuardClockStatus } from '../hooks/useGuardClockStatus.js'
import { getCheckpointStatus } from '../lib/scans.js'
import { flushOfflineQueue } from '../lib/offlineQueue.js'
import { useGuardPublishedShift } from '../hooks/useGuardPublishedShift.js'
import { fetchNextShift, formatTimeRange } from '../lib/schedule.js'

/** Build the { start, end, isClosed } shape useClientSiteData expects from a published shift. */
function shiftFromPublished(publishedShift) {
  if (!publishedShift?.starts_at || !publishedShift?.ends_at) {
    return { start: '00:00', end: '23:59', isClosed: true, scheduleLabel: 'No published shift' }
  }
  const start = new Date(publishedShift.starts_at)
  const end = new Date(publishedShift.ends_at)
  const hhmm = (d) =>
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return {
    start: hhmm(start),
    end: hhmm(end),
    isClosed: false,
    scheduleLabel: formatTimeRange(publishedShift),
  }
}

export default function GuardDashboard() {
  const { profile, user } = useAuth()
  const siteId = profile?.site_id
  const operatingHours = useSiteHours(siteId)
  const { date, setDate } = useClientShift(operatingHours)
  // Site operating hours gate the clock when no roster shift is published
  // (a "Closed" day blocks clock-in) — see shiftWindow in ClockInCard.
  const hoursSchedule = getScheduledShiftForDate(date, operatingHours)
  const { shift: publishedShift } = useGuardPublishedShift(user?.id, date)
  // Punch-based clock state (latest clock scan) — the single source of truth
  // for locking the portal. The whole dashboard collapses to the clock card
  // until the guard is on the clock.
  const { clockedIn, loading: clockLoading, refresh: refreshClock } = useGuardClockStatus(user?.id)
  // Data window follows the published roster — never the site's fixed hours.
  // If they're already on the clock without a published row, use the full day.
  const shift = publishedShift
    ? shiftFromPublished(publishedShift)
    : clockedIn
      ? { start: '00:00', end: '23:59', isClosed: false, scheduleLabel: 'On duty' }
      : shiftFromPublished(null)
  const {
    site,
    checkpoints,
    scans,
    loading,
    rounds,
    patrolScanCount,
    patrolCheckpointCount,
    scannedCount,
    scansByCheckpoint,
    guardShifts,
    reload,
  } = useClientSiteData(siteId, date, shift, user?.id)

  const myShift = guardShifts.find((row) => row.guardId === user?.id) || guardShifts[0] || null
  const myShiftWithDate = myShift ? { ...myShift, date } : null

  // Next published shift — the off-duty clock card points at it once today's
  // shift is over ("Next shift: tomorrow 9:00 PM — clock-in opens 8:45 PM").
  const [nextShift, setNextShift] = useState(null)
  useEffect(() => {
    if (!user?.id) return
    fetchNextShift(user.id).then(setNextShift).catch(() => setNextShift(null))
  }, [user?.id, clockedIn])

  useEffect(() => {
    // useClientSiteData already fetches on mount — only reload if the flush
    // actually pushed queued punches (the old unconditional reload doubled
    // every dashboard load).
    flushOfflineQueue().then(({ synced }) => {
      if (synced > 0) reload()
    })
  }, [siteId, user?.id, reload])

  const handlePunched = () => {
    refreshClock()
    reload()
  }

  if (!siteId) {
    return (
      <Layout variant="guard">
        <div className="mb-4 rounded-xl border border-accent-orange/30 bg-accent-orange/10 p-8 text-center">
          <h1 className="text-lg font-semibold text-accent-orange">No site assigned</h1>
          <p className="mt-2 text-sm text-accent-orange">
            Contact your administrator to assign you to a patrol site.
          </p>
        </div>
        {/* New hires can register Face ID right away — no site or schedule needed. */}
        <ClockInCard
          guardId={user?.id}
          siteId={null}
          clockedIn={false}
          onPunched={handlePunched}
          publishedShift={null}
          scheduled={null}
          date={date}
          nextShift={nextShift}
        />
      </Layout>
    )
  }

  // ---- Locked portal: clocked out → identity + shift status cards stay
  // (Div's approved look), everything else waits for the clock card punch.
  if (!clockLoading && !clockedIn) {
    return (
      <Layout variant="guard">
        <PageHeader
          title="Patrol Dashboard"
          description={`Good shift, ${profile?.name || 'Guard'}. ${site?.name || profile?.sites?.name || 'Your site'}`}
        />

        <GuardClockedInPanel
          profile={profile}
          siteName={site?.name || profile?.sites?.name}
          guardShift={null}
          publishedShift={publishedShift}
          clockedIn={false}
          loading={loading}
        />

        <ClockInCard
          guardId={user?.id}
          siteId={siteId}
          clockedIn={false}
          onPunched={handlePunched}
          publishedShift={publishedShift}
          scheduled={hoursSchedule}
          date={date}
          nextShift={nextShift}
        />

        <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center">
          <Lock className="mx-auto h-6 w-6 text-ink-3" />
          <p className="mt-2 text-sm font-semibold text-ink">You’re clocked out — the portal is locked</p>
          <p className="mt-1 text-sm text-ink-2">
            Patrol tools, scan history and incident reports unlock when you clock in. Your{' '}
            <Link to="/guard/schedule" className="font-semibold text-accent-cyan-line underline underline-offset-2">
              schedule
            </Link>{' '}
            is always available.
          </p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout variant="guard">
      <PageHeader
        title="Patrol Dashboard"
        description={`Good shift, ${profile?.name || 'Guard'}. ${site?.name || profile?.sites?.name || 'Your site'}`}
      />

      <GuardClockedInPanel
        profile={profile}
        siteName={site?.name || profile?.sites?.name}
        guardShift={myShiftWithDate}
        publishedShift={publishedShift}
        clockedIn={clockedIn}
        loading={loading || clockLoading}
      />

      <ClockInCard
        guardId={user?.id}
        siteId={siteId}
        clockedIn={clockedIn}
        onPunched={handlePunched}
        publishedShift={publishedShift}
        scheduled={hoursSchedule}
        date={date}
        nextShift={nextShift}
      />

      {clockLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent-orange border-t-transparent" />
        </div>
      ) : (
        <>
          <NextShiftCard guardId={user?.id} />

          <div className="mb-6 grid gap-3 sm:grid-cols-2">
            <Link to="/guard/scan" className="sp-btn-primary min-h-[3.5rem] text-base">
              <ScanLine className="h-5 w-5" />
              Scan checkpoint
            </Link>
            <Link
              to="/guard/incident"
              className="sp-btn-secondary flex min-h-[3.5rem] items-center justify-center gap-2 text-base"
            >
              <AlertTriangle className="h-5 w-5" />
              Report incident
            </Link>
          </div>

          <ClientShiftBar
            date={date}
            setDate={setDate}
            scheduled={shift}
            hoursLabel={
              publishedShift
                ? formatTimeRange(publishedShift)
                : 'No published shift today'
            }
            stats={
              publishedShift
                ? {
                    rounds,
                    patrolScanCount,
                    patrolCheckpointCount,
                    scannedCount,
                    totalCheckpoints: checkpoints.length,
                  }
                : null
            }
          />

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent-orange border-t-transparent" />
            </div>
          ) : (
            <>
              <div className="dk-card guard-history-card mb-8 overflow-hidden">
                <div className="border-b border-white/5 px-5 py-4">
                  <h2 className="font-display text-lg font-semibold">Scan history</h2>
                  <p className="mt-0.5 text-sm text-ink-2">
                    Your successful check-ins for {date}
                    {publishedShift ? ` · ${formatTimeRange(publishedShift)}` : ''}
                  </p>
                </div>

                {scans.length === 0 ? (
                  <p className="p-10 text-center text-sm text-ink-2">
                    {!publishedShift
                      ? 'No published shift for this date.'
                      : 'No successful scans during this shift yet. Tap Scan checkpoint to start.'}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[28rem] text-sm">
                      <thead className="bg-white/5 text-left text-ink-2">
                        <tr>
                          <th className="px-5 py-3 font-medium">Time</th>
                          <th className="px-5 py-3 font-medium">Checkpoint</th>
                          <th className="px-5 py-3 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {scans.map((scan) => {
                          const cp = checkpoints.find((c) => c.id === scan.checkpoint_id)
                          return (
                            <tr key={scan.id} className="hover:bg-white/5">
                              <td className="whitespace-nowrap px-5 py-3.5 text-ink-2">
                                {new Date(scan.scanned_at).toLocaleString()}
                              </td>
                              <td className="px-5 py-3.5">
                                <p className="font-medium text-ink">{cp?.name || 'Checkpoint'}</p>
                                {cp?.floor?.floor_name && (
                                  <p className="text-xs text-ink-2">{cp.floor.floor_name}</p>
                                )}
                              </td>
                              <td className="px-5 py-3.5">
                                <span className="dk-pill-ok">
                                  <CheckCircle2 className="h-3.5 w-3.5" /> Pass
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {publishedShift && checkpoints.length > 0 && (
                <>
                  <h2 className="mb-4 font-display text-lg font-semibold">Checkpoints</h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {checkpoints.map((cp) => {
                      const latestScan = scansByCheckpoint[cp.id]
                      const status = getCheckpointStatus(cp, latestScan)
                      return (
                        <CheckpointCard
                          key={cp.id}
                          checkpoint={cp}
                          status={status}
                          lastScan={latestScan}
                        />
                      )
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}
    </Layout>
  )
}
