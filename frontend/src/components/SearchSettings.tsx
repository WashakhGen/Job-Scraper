import { useEffect, useState } from 'react'
import { getSettings, updateSettings } from '../api/client'
import type { AppSettings } from '../api/types'
import ScoreDial from './ScoreDial'
import TagListInput from './TagListInput'

export default function SearchSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<AppSettings | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getSettings()
      .then(setSettings)
      .catch(() => {})
  }, [])

  function startEditing() {
    if (!settings) return
    setDraft(settings)
    setEditing(true)
  }

  async function save() {
    if (!draft) return
    setBusy(true)
    setError(null)
    try {
      const updated = await updateSettings(draft)
      setSettings(updated)
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setBusy(false)
    }
  }

  if (!settings) return null

  return (
    <div className="rounded-lg border border-brand-border bg-brand-bg p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-mono text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
          Search Settings
        </h3>
        {!editing && (
          <button
            type="button"
            onClick={startEditing}
            className="text-xs font-medium text-brand-teal hover:underline"
          >
            Edit
          </button>
        )}
      </div>

      {error && <p className="mt-1 text-xs text-status-danger">{error}</p>}

      {editing && draft ? (
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col items-center gap-1">
            <ScoreDial
              value={draft.min_score}
              onChange={(min_score) => setDraft({ ...draft, min_score })}
            />
            <span className="text-xs text-brand-muted">Min match score — drag or scroll the ring</span>
          </div>

          <TagListInput
            label="Locations"
            placeholder="e.g. Islamabad, Remote"
            values={draft.locations}
            onChange={(locations) => setDraft({ ...draft, locations })}
          />

          <TagListInput
            label="Exclude Keywords"
            hint="Jobs whose title/description match any of these are filtered out before scoring — e.g. unwanted seniority levels"
            placeholder="e.g. Internship, Principal"
            values={draft.exclude_keywords}
            onChange={(exclude_keywords) => setDraft({ ...draft, exclude_keywords })}
          />

          <TagListInput
            label="Ashby Companies"
            hint="AshbyHQ has no job search — only per-company boards. Add the slug from jobs.ashbyhq.com/<slug>"
            placeholder="e.g. ramp, linear"
            values={draft.ashby_companies}
            onChange={(ashby_companies) => setDraft({ ...draft, ashby_companies })}
          />

          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="rounded bg-brand-teal px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded border border-brand-border px-3 py-1.5 text-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-col items-center gap-3">
          <ScoreDial value={settings.min_score} onChange={() => {}} />
          <div className="flex flex-wrap justify-center gap-1.5">
            {settings.locations.length === 0 ? (
              <span className="text-xs text-brand-muted">No locations set</span>
            ) : (
              settings.locations.map((loc) => (
                <span
                  key={loc}
                  className="rounded border border-brand-border bg-brand-surface px-2 py-1 font-mono text-xs font-medium text-brand-teal"
                >
                  {loc}
                </span>
              ))
            )}
          </div>
          {settings.exclude_keywords.length > 0 && (
            <div className="flex flex-wrap justify-center gap-1.5">
              {settings.exclude_keywords.map((kw) => (
                <span
                  key={kw}
                  className="rounded border border-status-danger/30 bg-status-danger-bg px-2 py-1 font-mono text-xs font-medium text-status-danger"
                >
                  –{kw}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
