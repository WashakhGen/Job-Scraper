import { useEffect, useState } from 'react'
import { getSettings, updateSettings } from '../api/client'
import type { AppSettings } from '../api/types'
import ScoreDial from './ScoreDial'

export default function SearchSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [editing, setEditing] = useState(false)
  const [draftLocations, setDraftLocations] = useState<string[]>([])
  const [draftMinScore, setDraftMinScore] = useState(70)
  const [newLocation, setNewLocation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getSettings()
      .then(setSettings)
      .catch(() => {})
  }, [])

  function startEditing() {
    if (!settings) return
    setDraftLocations(settings.locations)
    setDraftMinScore(settings.min_score)
    setEditing(true)
  }

  function addLocation() {
    const trimmed = newLocation.trim()
    if (trimmed && !draftLocations.includes(trimmed)) {
      setDraftLocations([...draftLocations, trimmed])
    }
    setNewLocation('')
  }

  function removeLocation(loc: string) {
    setDraftLocations(draftLocations.filter((l) => l !== loc))
  }

  async function save() {
    setBusy(true)
    setError(null)
    try {
      const updated = await updateSettings(draftMinScore, draftLocations)
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

      {editing ? (
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col items-center gap-1">
            <ScoreDial value={draftMinScore} onChange={setDraftMinScore} />
            <span className="text-xs text-brand-muted">Min match score — drag or scroll the ring</span>
          </div>

          <div>
            <label className="font-mono text-[11px] font-medium text-brand-muted">Locations</label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {draftLocations.map((loc) => (
                <span
                  key={loc}
                  className="flex items-center gap-1 rounded border border-brand-border bg-brand-surface px-2 py-1 font-mono text-xs font-medium text-brand-teal"
                >
                  {loc}
                  <button
                    type="button"
                    onClick={() => removeLocation(loc)}
                    className="text-brand-muted hover:text-status-danger"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addLocation()
                  }
                }}
                placeholder="e.g. Islamabad, Remote"
                className="flex-1 rounded border border-brand-border bg-brand-surface p-1.5 text-xs focus:border-brand-coral focus:outline-none"
              />
              <button
                type="button"
                onClick={addLocation}
                className="rounded border border-brand-border px-2 text-xs font-medium hover:border-brand-teal hover:text-brand-teal"
              >
                Add
              </button>
            </div>
          </div>

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
        </div>
      )}
    </div>
  )
}
