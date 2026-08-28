import CandidateProfileCard from './CandidateProfileCard'
import SearchSettings from './SearchSettings'

/** Settings console rail — isolated from the CV queue so neither panel's
 * growth pushes the other off-screen. */
export default function RightRail() {
  return (
    <aside className="flex w-80 shrink-0 flex-col gap-3 overflow-y-auto border-l border-brand-border bg-brand-surface p-4">
      <h2 className="font-mono text-xs font-semibold uppercase tracking-wide text-brand-muted">
        Console
      </h2>
      <SearchSettings />
      <CandidateProfileCard />
    </aside>
  )
}
