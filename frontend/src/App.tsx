import { useEffect, useState } from 'react'
import { NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import logo from './assets/logo.png'
import { getSchedule, getScrapeStatus, listCvs } from './api/client'
import type { CV, ScheduleConfig } from './api/types'
import CvUploadGate from './components/CvUploadGate'
import LeftRail from './components/LeftRail'
import ManualJobModal from './components/ManualJobModal'
import RightRail from './components/RightRail'
import RunStatusStrip from './components/RunStatusStrip'
import ScheduleModal from './components/ScheduleModal'
import ScrapeModal from './components/ScrapeModal'
import StepLoader from './components/StepLoader'
import Applied from './pages/Applied'
import Home from './pages/Home'
import JobDetail from './pages/JobDetail'
import MyJobs from './pages/MyJobs'
import Recommended from './pages/Recommended'

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm font-semibold transition ${
    isActive ? 'bg-brand-coral text-white' : 'text-brand-muted hover:bg-brand-bg hover:text-brand-teal'
  }`

export default function App() {
  const navigate = useNavigate()
  const [cvs, setCvs] = useState<CV[] | null>(null)
  const [scrapeModalOpen, setScrapeModalOpen] = useState(false)
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false)
  const [manualJobModalOpen, setManualJobModalOpen] = useState(false)
  const [schedule, setSchedule] = useState<ScheduleConfig | null>(null)
  const [scrapeRunning, setScrapeRunning] = useState(false)

  useEffect(() => {
    listCvs().then(setCvs).catch(() => setCvs([]))
    getSchedule()
      .then(setSchedule)
      .catch(() => {})
  }, [])

  useEffect(() => {
    function poll() {
      getScrapeStatus()
        .then((s) => setScrapeRunning(s.running))
        .catch(() => {})
    }
    poll()
    const interval = setInterval(poll, 4000)
    return () => clearInterval(interval)
  }, [])

  function handleScrapeStarted() {
    setScrapeRunning(true)
  }

  if (cvs === null) {
    return (
      <div className="flex min-h-screen items-center justify-center font-mono text-sm text-brand-muted">
        Loading…
      </div>
    )
  }

  if (cvs.length === 0) {
    return <CvUploadGate onUploaded={(cv) => setCvs([cv])} />
  }

  return (
    <div className="flex h-screen bg-brand-bg">
      <LeftRail cvs={cvs} onChange={setCvs} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-20 shrink-0 items-center justify-between gap-4 border-b border-brand-border bg-brand-surface px-6">
          <img src={logo} alt="Job Scraper" className="h-11 w-auto shrink-0" />
          <nav className="flex shrink-0 items-center gap-2">
            <NavLink to="/" end className={tabClass}>
              Home
            </NavLink>
            <NavLink to="/recommended" className={tabClass}>
              Recommended
            </NavLink>
            <NavLink to="/applied" className={tabClass}>
              Applied
            </NavLink>
            <NavLink to="/my-jobs" className={tabClass}>
              My Jobs
            </NavLink>
            <button
              type="button"
              onClick={() => setManualJobModalOpen(true)}
              className="whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-semibold text-brand-muted transition hover:bg-brand-bg hover:text-brand-teal"
            >
              Bring Your own Job
            </button>
          </nav>

          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setScheduleModalOpen(true)}
              title={schedule?.enabled ? 'Schedule is active' : 'Schedule is inactive'}
              className="relative rounded-md border border-brand-border px-4 py-2 text-sm font-semibold text-brand-muted transition hover:border-brand-teal hover:text-brand-teal"
            >
              Schedule
              <span
                className={`absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-brand-surface ${
                  schedule?.enabled ? 'bg-status-success' : 'bg-brand-border-strong'
                }`}
              />
            </button>
            <button
              type="button"
              onClick={() => setScrapeModalOpen(true)}
              disabled={scrapeRunning}
              title={scrapeRunning ? 'A fetch is already running' : undefined}
              className="inline-flex min-w-36 items-center justify-center rounded-md bg-brand-coral px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-coral-dark disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-brand-coral"
            >
              {scrapeRunning ? (
                <StepLoader steps={['Fetching jobs…', 'Scoring matches…']} active={scrapeRunning} />
              ) : (
                'Fetch Jobs Now'
              )}
            </button>
          </div>
        </header>

        <RunStatusStrip scrapeRunning={scrapeRunning} schedule={schedule} />

        <main className="min-h-0 flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/recommended" element={<Recommended />} />
            <Route path="/applied" element={<Applied />} />
            <Route path="/my-jobs" element={<MyJobs />} />
            <Route path="/job/:id" element={<JobDetail />} />
          </Routes>
        </main>
      </div>

      <RightRail />

      {scrapeModalOpen && (
        <ScrapeModal onClose={() => setScrapeModalOpen(false)} onStarted={handleScrapeStarted} />
      )}

      {scheduleModalOpen && (
        <ScheduleModal onClose={() => setScheduleModalOpen(false)} onSaved={setSchedule} />
      )}

      {manualJobModalOpen && (
        <ManualJobModal
          onClose={() => setManualJobModalOpen(false)}
          onCreated={(job) => navigate(`/job/${job.job_id}`)}
        />
      )}
    </div>
  )
}
