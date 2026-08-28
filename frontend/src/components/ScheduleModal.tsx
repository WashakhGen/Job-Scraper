import { useEffect, useState } from 'react'
import { getSchedule, updateSchedule } from '../api/client'
import type { ScheduleConfig, ScheduleFrequency } from '../api/types'
import { formatRelative } from '../lib/format'
import StatusPill from './StatusPill'

interface Props {
  onClose: () => void
  onSaved: (schedule: ScheduleConfig) => void
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const FREQUENCIES: { value: ScheduleFrequency; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
]

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

function timeToInput(hour: number, minute: number): string {
  return `${pad(hour)}:${pad(minute)}`
}

function summarize(config: ScheduleConfig): string {
  const time = timeToInput(config.hour, config.minute)
  if (config.frequency === 'daily') return `Every day at ${time}`
  if (config.frequency === 'weekly') {
    return `Every ${WEEKDAYS[config.day_of_week ?? 0]} at ${time}`
  }
  return `Day ${config.day_of_month ?? 1} of every month at ${time}`
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="12" cy="12" r="9" strokeLinecap="round" />
      <path d="M12 7v5l3.5 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function ScheduleModal({ onClose, onSaved }: Props) {
  const [schedule, setSchedule] = useState<ScheduleConfig | null>(null)
  const [draft, setDraft] = useState<ScheduleConfig | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getSchedule()
      .then((s) => {
        setSchedule(s)
        setDraft(s)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load schedule'))
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  async function handleSave() {
    if (!draft) return
    setBusy(true)
    setError(null)
    try {
      const updated = await updateSchedule(draft)
      onSaved(updated)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save schedule')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-brand-text/40 px-4 backdrop-blur-[2px]"
      style={{ animation: 'modal-backdrop-in 0.15s ease-out' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-lg border border-brand-border bg-brand-surface p-6 shadow-2xl"
        style={{ animation: 'modal-panel-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-coral-bg text-brand-coral">
            <ClockIcon />
          </span>
          <div>
            <h2 className="text-base font-bold leading-tight text-brand-text">Schedule</h2>
            <p className="text-xs text-brand-muted">Run the pipeline automatically on a cadence</p>
          </div>
        </div>

        {error && (
          <p className="mt-3 rounded-md bg-status-danger-bg px-3 py-2 text-xs text-status-danger">
            {error}
          </p>
        )}

        {draft === null ? (
          <p className="mt-5 font-mono text-sm text-brand-muted">Loading…</p>
        ) : (
          <>
            <div className="mt-5 flex items-center justify-between rounded-md border border-brand-border bg-brand-bg px-3 py-2">
              <StatusPill tone={schedule?.enabled ? 'success' : 'idle'} dot pulse={schedule?.enabled}>
                {schedule?.enabled ? 'Active' : 'Inactive'}
              </StatusPill>
              {schedule?.enabled && schedule.next_run_at && (
                <span className="font-mono text-[11px] text-brand-muted">
                  Next {formatRelative(schedule.next_run_at)}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => setDraft({ ...draft, enabled: !draft.enabled })}
              aria-pressed={draft.enabled}
              className={`mt-4 flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm font-medium transition ${
                draft.enabled
                  ? 'border-brand-coral bg-brand-coral-bg text-brand-coral'
                  : 'border-brand-border text-brand-muted hover:border-brand-teal hover:text-brand-teal'
              }`}
            >
              {draft.enabled ? 'Enabled' : 'Disabled'}
              <span
                className={`relative h-5 w-9 rounded-full transition ${
                  draft.enabled ? 'bg-brand-coral' : 'bg-brand-border-strong'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${
                    draft.enabled ? 'left-4.5' : 'left-0.5'
                  }`}
                />
              </span>
            </button>

            <div className="mt-4">
              <label className="font-mono text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
                Frequency
              </label>
              <div className="mt-1.5 flex gap-1.5">
                {FREQUENCIES.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setDraft({ ...draft, frequency: f.value })}
                    className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-semibold transition ${
                      draft.frequency === f.value
                        ? 'border-brand-coral bg-brand-coral-bg text-brand-coral'
                        : 'border-brand-border text-brand-muted hover:border-brand-teal hover:text-brand-teal'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {draft.frequency === 'weekly' && (
              <div className="mt-4">
                <label className="font-mono text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
                  Day of week
                </label>
                <div className="mt-1.5 flex gap-1">
                  {WEEKDAYS.map((day, idx) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => setDraft({ ...draft, day_of_week: idx })}
                      className={`flex-1 rounded border py-1.5 font-mono text-[11px] font-semibold transition ${
                        (draft.day_of_week ?? 0) === idx
                          ? 'border-brand-coral bg-brand-coral-bg text-brand-coral'
                          : 'border-brand-border text-brand-muted hover:border-brand-teal hover:text-brand-teal'
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {draft.frequency === 'monthly' && (
              <div className="mt-4">
                <label htmlFor="schedule-dom" className="font-mono text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
                  Day of month (1–28)
                </label>
                <input
                  id="schedule-dom"
                  type="number"
                  min={1}
                  max={28}
                  value={draft.day_of_month ?? 1}
                  onChange={(e) =>
                    setDraft({ ...draft, day_of_month: Math.min(28, Math.max(1, Number(e.target.value))) })
                  }
                  className="mt-1.5 w-full rounded-md border border-brand-border bg-brand-bg px-3 py-2 text-sm text-brand-text focus:border-brand-coral focus:outline-none"
                />
              </div>
            )}

            <div className="mt-4 flex gap-3">
              <div className="flex-1">
                <label htmlFor="schedule-time" className="font-mono text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
                  Time
                </label>
                <input
                  id="schedule-time"
                  type="time"
                  value={timeToInput(draft.hour, draft.minute)}
                  onChange={(e) => {
                    const [h, m] = e.target.value.split(':').map(Number)
                    setDraft({ ...draft, hour: h, minute: m })
                  }}
                  className="mt-1.5 w-full rounded-md border border-brand-border bg-brand-bg px-3 py-2 text-sm text-brand-text focus:border-brand-coral focus:outline-none"
                />
              </div>
              <div className="flex-1">
                <label htmlFor="schedule-limit" className="font-mono text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
                  Limit / source
                </label>
                <input
                  id="schedule-limit"
                  type="number"
                  min={1}
                  max={100}
                  value={draft.limit}
                  onChange={(e) => setDraft({ ...draft, limit: Number(e.target.value) })}
                  className="mt-1.5 w-full rounded-md border border-brand-border bg-brand-bg px-3 py-2 text-sm text-brand-text focus:border-brand-coral focus:outline-none"
                />
              </div>
            </div>

            <p className="mt-4 font-mono text-[11px] leading-snug text-brand-faint">{summarize(draft)}</p>

            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="rounded-md border border-brand-border px-4 py-2.5 text-sm font-semibold text-brand-muted transition hover:border-brand-text hover:text-brand-text disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={busy}
                className="flex-1 rounded-md bg-brand-coral px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-coral-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? 'Saving…' : 'Save Schedule'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
