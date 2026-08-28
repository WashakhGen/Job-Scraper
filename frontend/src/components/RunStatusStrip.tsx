import type { ScheduleConfig } from '../api/types'
import { formatRelative } from '../lib/format'
import StatusPill from './StatusPill'

interface Props {
  scrapeRunning: boolean
  schedule: ScheduleConfig | null
}

/** The permanent pipeline run-status strip — always visible, not just while
 * something is happening. Idle / Running / Scheduled is the app's own
 * "build status" the way a CI dashboard always shows its last/next run. */
export default function RunStatusStrip({ scrapeRunning, schedule }: Props) {
  if (scrapeRunning) {
    return (
      <div className="strip-sweep flex items-center gap-2 border-b border-brand-border bg-status-pending-bg px-6 py-2 font-mono text-xs font-medium text-status-pending">
        <span className="status-pulse h-2 w-2 shrink-0 rounded-[2px] bg-current" />
        RUNNING — fetching &amp; scoring jobs. New matches will appear automatically.
      </div>
    )
  }

  if (schedule?.enabled && schedule.next_run_at) {
    return (
      <div className="flex items-center gap-2 border-b border-brand-border bg-brand-bg px-6 py-2 font-mono text-xs font-medium text-brand-muted">
        <StatusPill tone="teal" dot>
          Idle
        </StatusPill>
        <span>Next scheduled run {formatRelative(schedule.next_run_at)}</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 border-b border-brand-border bg-brand-bg px-6 py-2 font-mono text-xs font-medium text-brand-faint">
      <StatusPill tone="idle" dot>
        Idle
      </StatusPill>
      <span>No schedule set — trigger a fetch manually or set one up</span>
    </div>
  )
}
