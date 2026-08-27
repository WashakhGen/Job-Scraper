import { useEffect, useRef, useState } from 'react'
import { activateCv, deleteCv, updateCvKeywords, uploadCv } from '../api/client'
import type { CV } from '../api/types'
import CandidateProfileCard from './CandidateProfileCard'
import SearchSettings from './SearchSettings'

const MAX_CVS = 3

interface Props {
  cvs: CV[]
  onChange: (cvs: CV[]) => void
}

export default function Sidebar({ cvs, onChange }: Props) {
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [draftKeywords, setDraftKeywords] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (expandedId === null && cvs.length > 0) {
      setExpandedId(cvs.find((cv) => cv.is_active)?.id ?? cvs[0].id)
    }
  }, [cvs, expandedId])

  async function refreshAfter<T>(action: () => Promise<T>) {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  async function handleUpload(file: File) {
    await refreshAfter(async () => {
      const cv = await uploadCv(file)
      onChange([cv, ...cvs])
      setExpandedId(cv.id)
    })
  }

  async function handleActivate(id: number) {
    await refreshAfter(async () => {
      await activateCv(id)
      onChange(cvs.map((cv) => ({ ...cv, is_active: cv.id === id })))
    })
  }

  async function handleDelete(id: number) {
    await refreshAfter(async () => {
      await deleteCv(id)
      onChange(cvs.filter((cv) => cv.id !== id))
      if (expandedId === id) setExpandedId(null)
    })
  }

  function startEditing(cv: CV) {
    setEditingId(cv.id)
    setDraftKeywords(cv.keywords.join(', '))
  }

  async function saveKeywords(id: number) {
    const keywords = draftKeywords
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean)
    await refreshAfter(async () => {
      const updated = await updateCvKeywords(id, keywords)
      onChange(cvs.map((cv) => (cv.id === id ? updated : cv)))
      setEditingId(null)
    })
  }

  return (
    <aside className="flex w-80 shrink-0 flex-col gap-4 border-r border-brand-border bg-brand-surface p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-muted">
          Your CVs
        </h2>
        <button
          type="button"
          disabled={busy || cvs.length >= MAX_CVS}
          onClick={() => inputRef.current?.click()}
          title={cvs.length >= MAX_CVS ? `Max ${MAX_CVS} CVs — delete one first` : 'Upload CV'}
          className="rounded-md bg-brand-coral px-2 py-1 text-xs font-semibold text-white transition hover:bg-brand-coral-dark disabled:cursor-not-allowed disabled:opacity-40"
        >
          + Add
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleUpload(file)
          }}
        />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {/* compact tab row — click to expand that CV's full card below */}
      <div className="flex flex-wrap gap-1.5">
        {cvs.map((cv) => (
          <button
            key={cv.id}
            type="button"
            onClick={() => setExpandedId(expandedId === cv.id ? null : cv.id)}
            title={cv.filename}
            className={`max-w-[9rem] truncate rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              expandedId === cv.id
                ? 'border-brand-coral bg-orange-50 text-brand-coral'
                : 'border-brand-border text-brand-muted hover:border-brand-teal hover:text-brand-teal'
            }`}
          >
            {cv.is_active && '● '}
            {cv.filename}
          </button>
        ))}
      </div>

      {cvs
        .filter((cv) => cv.id === expandedId)
        .map((cv) => (
          <div
            key={cv.id}
            className={`rounded-lg border p-3 text-sm ${
              cv.is_active ? 'border-brand-coral bg-orange-50' : 'border-brand-border bg-white'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-medium text-brand-text" title={cv.filename}>
                {cv.filename}
              </span>
              {cv.is_active && (
                <span className="shrink-0 rounded-full bg-brand-coral px-2 py-0.5 text-[10px] font-semibold text-white">
                  ACTIVE
                </span>
              )}
            </div>

            {editingId === cv.id ? (
              <div className="mt-2 flex flex-col gap-2">
                <textarea
                  value={draftKeywords}
                  onChange={(e) => setDraftKeywords(e.target.value)}
                  className="w-full rounded border border-brand-border p-2 text-xs"
                  rows={3}
                  placeholder="Comma-separated keywords"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => saveKeywords(cv.id)}
                    disabled={busy}
                    className="rounded bg-brand-teal px-2 py-1 text-xs font-semibold text-white"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="rounded border border-brand-border px-2 py-1 text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {cv.keywords.map((kw) => (
                  <span
                    key={kw}
                    className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-brand-teal"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-3 flex gap-3 text-xs">
              {!cv.is_active && (
                <button
                  type="button"
                  onClick={() => handleActivate(cv.id)}
                  disabled={busy}
                  className="font-medium text-brand-teal hover:underline"
                >
                  Activate
                </button>
              )}
              {editingId !== cv.id && (
                <button
                  type="button"
                  onClick={() => startEditing(cv)}
                  disabled={busy}
                  className="font-medium text-brand-teal hover:underline"
                >
                  Edit keywords
                </button>
              )}
              <button
                type="button"
                onClick={() => handleDelete(cv.id)}
                disabled={busy}
                className="font-medium text-red-600 hover:underline"
              >
                Delete
              </button>
            </div>
          </div>
        ))}

      <SearchSettings />
      <CandidateProfileCard />
    </aside>
  )
}
