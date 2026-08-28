import type { ReactNode } from 'react'

export type PillTone = 'success' | 'pending' | 'idle' | 'danger' | 'teal' | 'coral'

const TONE_CLASSES: Record<PillTone, string> = {
  success: 'bg-status-success-bg text-status-success',
  pending: 'bg-status-pending-bg text-status-pending',
  idle: 'bg-status-idle-bg text-status-idle',
  danger: 'bg-status-danger-bg text-status-danger',
  teal: 'bg-brand-teal-bg text-brand-teal',
  coral: 'bg-brand-coral-bg text-brand-coral',
}

interface Props {
  tone: PillTone
  children: ReactNode
  dot?: boolean
  pulse?: boolean
  className?: string
  /** 'pill' (default) for short fixed-content status words — full stadium
   * shape. 'chip' for longer text that may wrap — a stadium shape stretched
   * over multiple lines reads as a mistake, so chips get a normal radius. */
  shape?: 'pill' | 'chip'
}

/** A pipeline-style status pill — mono, uppercase, tracked. Shared by job
 * rows, the run-status strip, and match-quality lists so every state in the
 * app speaks the same status vocabulary. */
export default function StatusPill({
  tone,
  children,
  dot,
  pulse,
  className = '',
  shape = 'pill',
}: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide ${
        shape === 'chip' ? 'rounded-md' : 'rounded-full'
      } ${TONE_CLASSES[tone]} ${className}`}
    >
      {dot && (
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full bg-current ${pulse ? 'status-pulse' : ''}`} />
      )}
      {children}
    </span>
  )
}
