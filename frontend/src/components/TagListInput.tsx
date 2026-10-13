import { useState } from 'react'

interface Props {
  label: string
  hint?: string
  placeholder: string
  values: string[]
  onChange: (values: string[]) => void
}

/** Add/remove free-text tag list — shared by Locations, Exclude Keywords,
 * and Ashby Companies in Search Settings, which were otherwise the same
 * ~30 lines of markup three times over. */
export default function TagListInput({ label, hint, placeholder, values, onChange }: Props) {
  const [draft, setDraft] = useState('')

  function add() {
    const trimmed = draft.trim()
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed])
    }
    setDraft('')
  }

  function remove(value: string) {
    onChange(values.filter((v) => v !== value))
  }

  return (
    <div>
      <label className="font-mono text-[11px] font-medium text-brand-muted">{label}</label>
      {hint && <p className="mt-0.5 text-[11px] text-brand-faint">{hint}</p>}
      <div className="mt-1 flex flex-wrap gap-1.5">
        {values.map((value) => (
          <span
            key={value}
            className="flex items-center gap-1 rounded border border-brand-border bg-brand-surface px-2 py-1 font-mono text-xs font-medium text-brand-teal"
          >
            {value}
            <button
              type="button"
              onClick={() => remove(value)}
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
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          placeholder={placeholder}
          className="flex-1 rounded border border-brand-border bg-brand-surface p-1.5 text-xs focus:border-brand-coral focus:outline-none"
        />
        <button
          type="button"
          onClick={add}
          className="rounded border border-brand-border px-2 text-xs font-medium hover:border-brand-teal hover:text-brand-teal"
        >
          Add
        </button>
      </div>
    </div>
  )
}
