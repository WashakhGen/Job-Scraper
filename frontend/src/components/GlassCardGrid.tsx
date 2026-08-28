import type { ReactNode } from 'react'

/** Wraps a grid of glass JobCards with a soft ambient backdrop — blur has
 * nothing to refract on a flat page, so this gives it two low-opacity
 * color fields to catch. */
export default function GlassCardGrid({ children }: { children: ReactNode }) {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute -inset-6 -z-10 overflow-hidden rounded-2xl">
        <div className="absolute -left-8 -top-8 h-52 w-52 rounded-full bg-brand-coral/15 blur-3xl" />
        <div className="absolute -right-8 top-16 h-52 w-52 rounded-full bg-brand-teal/15 blur-3xl" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
    </div>
  )
}
