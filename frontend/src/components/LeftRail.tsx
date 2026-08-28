import { useEffect, useRef, useState } from 'react'
import { activateCv, deleteCv, updateCvKeywords, uploadCv } from '../api/client'
import type { CV } from '../api/types'
import StatusPill from './StatusPill'
import StepLoader from './StepLoader'

const MAX_CVS = 3

interface Props {
  cvs: CV[]
  onChange: (cvs: CV[]) => void
}

/** CV queue rail — the one part of the old sidebar that genuinely grows, now
 * isolated in its own rail (bounded to MAX_CVS) instead of stacking under
 * settings panels. */
export default function LeftRail({ cvs, onChange }: Props) {
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [draftKeywords, setDraftKeywords] = useState('')
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
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
    setUploading(true)
    try {
      await refreshAfter(async () => {
        const cv = await uploadCv(file)
        onChange([cv, ...cvs])
        setExpandedId(cv.id)
      })
    } finally {
      setUploading(false)
    }
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
    <aside className="flex w-72 shrink-0 flex-col gap-3 overflow-y-auto border-r border-brand-border bg-brand-surface p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-xs font-semibold uppercase tracking-wide text-brand-muted">
          CV Queue
        </h2>
        <button
          type="button"
          disabled={busy || cvs.length >= MAX_CVS}
          onClick={() => inputRef.current?.click()}
          title={cvs.length >= MAX_CVS ? `Max ${MAX_CVS} CVs — delete one first` : 'Upload CV'}
          className="shrink-0 whitespace-nowrap rounded-md bg-brand-coral px-2 py-1 text-xs font-semibold text-white transition hover:bg-brand-coral-dark disabled:cursor-not-allowed disabled:opacity-40"
        >
          {uploading ? <StepLoader steps={['Uploading…', 'Analyzing…']} active={uploading} /> : '+ Add'}
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

      {error && <p className="text-xs text-status-danger">{error}</p>}

      {/* compact tab row — click to expand that CV's full card below */}
      <div className="flex flex-wrap gap-1.5">
        {cvs.map((cv) => (
          <button
            key={cv.id}
            type="button"
            onClick={() => setExpandedId(expandedId === cv.id ? null : cv.id)}
            title={cv.filename}
            className={`max-w-[9rem] truncate rounded-md border px-2.5 py-1 font-mono text-[11px] font-medium transition ${
              expandedId === cv.id
                ? 'border-brand-coral bg-brand-coral-bg text-brand-coral'
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
              cv.is_active ? 'border-brand-coral bg-brand-coral-bg' : 'border-brand-border bg-brand-bg'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-medium text-brand-text" title={cv.filename}>
                {cv.filename}
              </span>
              {cv.is_active && (
                <StatusPill tone="coral" dot>
                  Active
                </StatusPill>
              )}
            </div>

            {editingId === cv.id ? (
              <div className="mt-2 flex flex-col gap-2">
                <textarea
                  value={draftKeywords}
                  onChange={(e) => setDraftKeywords(e.target.value)}
                  className="w-full rounded border border-brand-border bg-brand-surface p-2 font-mono text-xs"
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
              <div className="mt-3 flex flex-wrap gap-1.5">
                {cv.keywords.map((kw) => (
                  <span
                    key={kw}
                    className="rounded border border-brand-border bg-brand-surface px-2 py-1 font-mono text-[11px] font-medium text-brand-teal"
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
                className="font-medium text-status-danger hover:underline"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
    </aside>
  )
}
