import { useEffect, useState } from 'react'
import { getProfile, updateProfile } from '../api/client'
import type { CandidateProfile } from '../api/types'

const EMPTY: CandidateProfile = {
  name: '',
  headline: '',
  location: '',
  phone: '',
  email: '',
  links: [],
}

export default function CandidateProfileCard() {
  const [profile, setProfile] = useState<CandidateProfile | null>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<CandidateProfile>(EMPTY)
  const [newLink, setNewLink] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getProfile()
      .then(setProfile)
      .catch(() => {})
  }, [])

  function startEditing() {
    if (!profile) return
    setDraft(profile)
    setEditing(true)
  }

  function addLink() {
    const trimmed = newLink.trim()
    if (trimmed && !draft.links.includes(trimmed)) {
      setDraft({ ...draft, links: [...draft.links, trimmed] })
    }
    setNewLink('')
  }

  function removeLink(link: string) {
    setDraft({ ...draft, links: draft.links.filter((l) => l !== link) })
  }

  async function save() {
    setBusy(true)
    setError(null)
    try {
      const updated = await updateProfile(draft)
      setProfile(updated)
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setBusy(false)
    }
  }

  if (!profile) return null

  const contactLine = [profile.location, profile.phone, profile.email, ...profile.links]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="rounded-xl border border-brand-border bg-brand-surface p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-muted">
          Cover Letter Profile
        </h2>
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

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      {editing ? (
        <div className="mt-3 flex flex-col gap-2">
          <input
            type="text"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="Full name"
            className="rounded border border-brand-border p-1.5 text-xs"
          />
          <input
            type="text"
            value={draft.headline}
            onChange={(e) => setDraft({ ...draft, headline: e.target.value })}
            placeholder="Headline, e.g. ML Engineer | PyTorch, LLMs"
            className="rounded border border-brand-border p-1.5 text-xs"
          />
          <input
            type="text"
            value={draft.location}
            onChange={(e) => setDraft({ ...draft, location: e.target.value })}
            placeholder="Location"
            className="rounded border border-brand-border p-1.5 text-xs"
          />
          <input
            type="text"
            value={draft.phone}
            onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
            placeholder="Phone"
            className="rounded border border-brand-border p-1.5 text-xs"
          />
          <input
            type="email"
            value={draft.email}
            onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            placeholder="Email"
            className="rounded border border-brand-border p-1.5 text-xs"
          />

          <div>
            <div className="flex flex-wrap gap-1.5">
              {draft.links.map((link) => (
                <span
                  key={link}
                  className="flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-brand-teal"
                >
                  {link}
                  <button
                    type="button"
                    onClick={() => removeLink(link)}
                    className="text-brand-muted hover:text-red-600"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={newLink}
                onChange={(e) => setNewLink(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addLink()
                  }
                }}
                placeholder="e.g. github.com/you"
                className="flex-1 rounded border border-brand-border p-1.5 text-xs"
              />
              <button
                type="button"
                onClick={addLink}
                className="rounded border border-brand-border px-2 text-xs font-medium"
              >
                Add
              </button>
            </div>
          </div>

          <div className="mt-1 flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="rounded bg-brand-teal px-3 py-1.5 text-xs font-semibold text-white"
            >
              Save
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
      ) : profile.name ? (
        <div className="mt-2 text-sm">
          <p className="font-semibold text-brand-text">{profile.name}</p>
          {profile.headline && <p className="text-brand-muted">{profile.headline}</p>}
          {contactLine && <p className="mt-1 text-xs text-brand-muted">{contactLine}</p>}
        </div>
      ) : (
        <p className="mt-2 text-xs text-brand-muted">
          Not set — used for the cover letter letterhead when downloading a PDF.
        </p>
      )}
    </div>
  )
}
