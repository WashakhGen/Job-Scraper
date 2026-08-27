import { useEffect, useState } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import logo from './assets/logo.png'
import { listCvs } from './api/client'
import type { CV } from './api/types'
import CvUploadGate from './components/CvUploadGate'
import ScrapeModal from './components/ScrapeModal'
import Sidebar from './components/Sidebar'
import Applied from './pages/Applied'
import Home from './pages/Home'
import JobDetail from './pages/JobDetail'
import Recommended from './pages/Recommended'

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm font-semibold transition ${
    isActive ? 'bg-brand-coral text-white' : 'text-brand-teal hover:bg-brand-bg'
  }`

export default function App() {
  const [cvs, setCvs] = useState<CV[] | null>(null)
  const [scrapeModalOpen, setScrapeModalOpen] = useState(false)
  const [scrapeMessage, setScrapeMessage] = useState<string | null>(null)

  useEffect(() => {
    listCvs().then(setCvs).catch(() => setCvs([]))
  }, [])

  function handleScrapeStarted() {
    setScrapeMessage('Scrape started — check back in a bit')
    setTimeout(() => setScrapeMessage(null), 4000)
  }

  if (cvs === null) {
    return <div className="flex min-h-screen items-center justify-center text-brand-muted">Loading…</div>
  }

  if (cvs.length === 0) {
    return <CvUploadGate onUploaded={(cv) => setCvs([cv])} />
  }

  return (
    <div className="flex min-h-screen bg-brand-bg">
      <Sidebar cvs={cvs} onChange={setCvs} />

      <div className="flex-1">
        <header className="grid h-24 grid-cols-3 items-center border-b border-brand-border bg-brand-surface px-6">
          <img src={logo} alt="Job Scraper" className="h-16 w-auto shrink-0 justify-self-start" />
          <nav className="flex justify-self-center gap-2">
            <NavLink to="/" end className={tabClass}>
              Home
            </NavLink>
            <NavLink to="/recommended" className={tabClass}>
              Recommended
            </NavLink>
            <NavLink to="/applied" className={tabClass}>
              Applied
            </NavLink>
          </nav>

          <div className="flex justify-self-end items-center gap-3">
            {scrapeMessage && <span className="text-xs text-brand-muted">{scrapeMessage}</span>}
            <button
              type="button"
              onClick={() => setScrapeModalOpen(true)}
              className="rounded-md bg-brand-coral px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-coral-dark"
            >
              Scrape Now
            </button>
          </div>
        </header>

        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/recommended" element={<Recommended />} />
            <Route path="/applied" element={<Applied />} />
            <Route path="/job/:id" element={<JobDetail />} />
          </Routes>
        </main>
      </div>

      {scrapeModalOpen && (
        <ScrapeModal onClose={() => setScrapeModalOpen(false)} onStarted={handleScrapeStarted} />
      )}
    </div>
  )
}
