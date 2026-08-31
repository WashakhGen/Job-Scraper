import { useEffect, useState } from 'react'
import { createManualJob } from '../api/client'
import type { JobDetail } from '../api/types'
import StepLoader from './StepLoader'

interface Props {
  onClose: () => void
  onCreated: (job: JobDetail) => void
}

function PasteIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth={1.8}>
      <rect x="6" y="4" width="12" height="16" rx="2" strokeLinejoin="round" />
      <path d="M9 4V3.5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 3.5V4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 11h6M9 14.5h6M9 17.5h3.5" strokeLinecap="round" />
    </svg>
  )
}

const inputClass =
  'w-full rounded-md border border-brand-border bg-brand-bg px-3 py-2 text-sm text-brand-text focus:border-brand-coral focus:outline-none'
const labelClass = 'font-mono text-[11px] font-semibold uppercase tracking-wide text-brand-muted'

export default function ManualJobModal({ onClose, onCreated }: Props) {
  const [title, setTitle] = useState('')
  const [company, setCompany] = useState('')
  const [location, setLocation] = useState('')
  const [url, setUrl] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const canSubmit = title.trim() && company.trim() && description.trim() && !busy

  async function handleSubmit() {
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    try {
      const job = await createManualJob({
        title: title.trim(),
        company: company.trim(),
        description: description.trim(),
        location: location.trim(),
        url: url.trim(),
      })
      onCreated(job)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate cover letter')
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
        className="w-full max-w-lg rounded-lg border border-brand-border bg-brand-surface p-6 shadow-2xl"
        style={{ animation: 'modal-panel-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-coral-bg text-brand-coral">
            <PasteIcon />
          </span>
          <div>
            <h2 className="text-base font-bold leading-tight text-brand-text">Paste a Job</h2>
            <p className="text-xs text-brand-muted">
              From anywhere — get it scored and a cover letter written right away
            </p>
          </div>
        </div>

        {error && (
          <p className="mt-3 rounded-md bg-status-danger-bg px-3 py-2 text-xs text-status-danger">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-col gap-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <label htmlFor="manual-title" className={labelClass}>
                Job Title
              </label>
              <input
                id="manual-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Senior Backend Engineer"
                className={`mt-1.5 ${inputClass}`}
              />
            </div>
            <div className="flex-1">
              <label htmlFor="manual-company" className={labelClass}>
                Company
              </label>
              <input
                id="manual-company"
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Acme Inc"
                className={`mt-1.5 ${inputClass}`}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label htmlFor="manual-location" className={labelClass}>
                Location <span className="normal-case text-brand-faint">(optional)</span>
              </label>
              <input
                id="manual-location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Remote, Islamabad…"
                className={`mt-1.5 ${inputClass}`}
              />
            </div>
            <div className="flex-1">
              <label htmlFor="manual-url" className={labelClass}>
                Job URL <span className="normal-case text-brand-faint">(optional)</span>
              </label>
              <input
                id="manual-url"
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
                className={`mt-1.5 ${inputClass}`}
              />
            </div>
          </div>

          <div>
            <label htmlFor="manual-description" className={labelClass}>
              Job Description
            </label>
            <textarea
              id="manual-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Paste the full job description here…"
              rows={8}
              className={`mt-1.5 ${inputClass} resize-none font-sans`}
            />
          </div>
        </div>

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
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex flex-1 items-center justify-center rounded-md bg-brand-coral px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-coral-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? (
              <StepLoader steps={['Reviewing match…', 'Writing cover letter…']} active={busy} />
            ) : (
              'Generate Cover Letter'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
