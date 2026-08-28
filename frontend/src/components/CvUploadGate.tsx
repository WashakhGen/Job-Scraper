import { useRef, useState } from 'react'
import { uploadCv } from '../api/client'
import type { CV } from '../api/types'
import logo from '../assets/logo.png'
import StepLoader from './StepLoader'

export default function CvUploadGate({ onUploaded }: { onUploaded: (cv: CV) => void }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setUploading(true)
    setError(null)
    try {
      const cv = await uploadCv(file)
      onUploaded(cv)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-bg px-4">
      <div className="w-full max-w-md rounded-lg border border-brand-border bg-brand-surface p-10 text-center shadow-sm">
        <img src={logo} alt="Job Scraper" className="mx-auto h-10 w-auto" />
        <h1 className="mt-6 text-xl font-bold text-brand-text">Set up your first CV</h1>
        <p className="mt-2 text-sm text-brand-muted">
          Upload a CV to seed the pipeline — we'll extract your keywords and start matching jobs.
        </p>

        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="mt-6 flex w-full items-center justify-center rounded-md bg-brand-coral px-4 py-3 font-semibold text-white transition hover:bg-brand-coral-dark disabled:opacity-60"
        >
          {uploading ? (
            <StepLoader steps={['Uploading CV…', 'Analyzing CV…']} active={uploading} />
          ) : (
            'Upload CV (PDF)'
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
          }}
        />

        {error && <p className="mt-3 text-sm text-status-danger">{error}</p>}
      </div>
    </div>
  )
}
