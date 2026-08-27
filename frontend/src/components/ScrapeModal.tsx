import { useEffect, useState } from 'react'
import { getSettings, listSources, triggerScrape, triggerScrapeAll } from '../api/client'

interface Props {
  onClose: () => void
  onStarted: () => void
}

function ScrapeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth={1.8}>
      <path
        d="M20 11a8 8 0 1 0-2.3 5.6M20 5v4h-4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth={2.4}>
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function ScrapeModal({ onClose, onStarted }: Props) {
  const [sources, setSources] = useState<string[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [limit, setLimit] = useState(25)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listSources()
      .then((list) => {
        setSources(list)
        setSelected(new Set(list)) // all selected by default
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load sources'))
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  function toggleSource(source: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(source)) next.delete(source)
      else next.add(source)
      return next
    })
  }

  function toggleAll() {
    if (!sources) return
    setSelected((prev) => (prev.size === sources.length ? new Set() : new Set(sources)))
  }

  async function handleStart() {
    if (!sources || selected.size === 0) return
    setStarting(true)
    setError(null)
    try {
      const settings = await getSettings()
      const locations = settings.locations.length > 0 ? settings.locations : [undefined]

      if (selected.size === sources.length) {
        // everything selected — use the single scrape-all trigger per location,
        // matches the backend's own sequential-sources design instead of firing
        // one request per source ourselves
        for (const location of locations) {
          await triggerScrapeAll(location, limit)
        }
      } else {
        for (const source of selected) {
          for (const location of locations) {
            await triggerScrape(source, location, limit)
          }
        }
      }
      onStarted()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start scrape')
    } finally {
      setStarting(false)
    }
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-brand-text/50 px-4 backdrop-blur-[2px]"
      style={{ animation: 'modal-backdrop-in 0.15s ease-out' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-brand-border bg-brand-surface p-6 shadow-2xl"
        style={{ animation: 'modal-panel-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-50 text-brand-coral">
            <ScrapeIcon />
          </span>
          <div>
            <h2 className="text-base font-bold leading-tight text-brand-text">Scrape Jobs</h2>
            <p className="text-xs text-brand-muted">Pull fresh listings from your selected sources</p>
          </div>
        </div>

        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
        )}

        {sources === null ? (
          <p className="mt-5 text-sm text-brand-muted">Loading sources…</p>
        ) : (
          <>
            <div className="mt-5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wide text-brand-muted">
                  Sources
                </label>
                <button
                  type="button"
                  onClick={toggleAll}
                  className="text-xs font-semibold text-brand-teal hover:underline"
                >
                  {selected.size === sources.length ? 'Deselect all' : 'Select all'}
                </button>
              </div>
              <div className="mt-2.5 flex flex-col gap-1.5">
                {sources.map((source) => {
                  const active = selected.has(source)
                  return (
                    <button
                      key={source}
                      type="button"
                      onClick={() => toggleSource(source)}
                      aria-pressed={active}
                      className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm font-medium capitalize transition ${
                        active
                          ? 'border-brand-coral bg-orange-50 text-brand-coral'
                          : 'border-brand-border text-brand-muted hover:border-brand-teal hover:text-brand-teal'
                      }`}
                    >
                      {source}
                      <span
                        className={`flex h-4.5 w-4.5 items-center justify-center rounded-full border transition ${
                          active
                            ? 'border-brand-coral bg-brand-coral text-white'
                            : 'border-brand-border text-transparent'
                        }`}
                      >
                        <CheckIcon />
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="mt-5">
              <label
                htmlFor="scrape-limit"
                className="text-xs font-semibold uppercase tracking-wide text-brand-muted"
              >
                Jobs limit per source
              </label>
              <div className="relative mt-1.5">
                <input
                  id="scrape-limit"
                  type="number"
                  min={1}
                  max={100}
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  className="w-full rounded-lg border border-brand-border bg-brand-bg px-3 py-2 text-sm text-brand-text focus:border-brand-coral focus:outline-none"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-brand-muted">
                  jobs
                </span>
              </div>
              <p className="mt-1.5 text-[11px] leading-snug text-brand-muted">
                Apify actors bill per result — keep this modest to stay within budget.
              </p>
            </div>

            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={starting}
                className="rounded-full border border-brand-border px-4 py-2.5 text-sm font-semibold text-brand-muted transition hover:border-brand-text hover:text-brand-text disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStart}
                disabled={starting || selected.size === 0}
                className="flex-1 rounded-full bg-brand-coral px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-coral-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                {starting ? 'Starting…' : 'Start Scrape'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
