import { useEffect, useState } from 'react'
import { BrowserRouter, Link, NavLink, Route, Routes } from 'react-router-dom'
import { api } from './api'
import Home from './pages/Home'
import Cases from './pages/Cases'
import CasePage from './pages/Case'
import Felons from './pages/Felons'

export const DISCLAIMER =
  'This application is an academic prototype for AI-assisted facial reconstruction and reference-image similarity analysis. Generated facial representations are approximations based on witness-provided characteristics. Similarity scores do not establish identity, guilt, or criminal involvement.'

export function Badge({ children, tone = 'mute' }: { children: React.ReactNode; tone?: 'mute' | 'warn' | 'ok' | 'steel' }) {
  const t = { mute: 'bg-line2 text-graphite', warn: 'bg-warn-l text-warn', ok: 'bg-[#e4f0e9] text-ok', steel: 'bg-steel-l text-steel-d' }[tone]
  return <span className={`inline-flex items-center h-6 px-2.5 rounded-full text-[11px] font-semibold tracking-wide ${t}`}>{children}</span>
}

function Header() {
  const [s, setS] = useState<any>(null)
  useEffect(() => { api.status().then(setS).catch(() => setS({ offline: true })) }, [])
  return (
    <header className="noprint h-14 bg-surface border-b border-line flex items-center px-4 sm:px-6 gap-6 sticky top-0 z-30">
      <Link to="/" className="flex items-center gap-2.5">
        <svg width="26" height="26" viewBox="0 0 26 26" fill="none"><rect x=".75" y=".75" width="24.5" height="24.5" rx="6" stroke="#3d5f7f" strokeWidth="1.5" /><ellipse cx="13" cy="13.5" rx="5" ry="6.5" stroke="#3d5f7f" strokeWidth="1.4" /><path d="M3 8.5h4M19 8.5h4M3 18h4M19 18h4" stroke="#3d5f7f" strokeWidth="1.4" strokeLinecap="round" /></svg>
        <div className="leading-tight min-w-0">
          <div className="text-[13px] font-semibold tracking-wide whitespace-nowrap hidden sm:block">RECONSTRUCTION WORKSTATION</div>
          <div className="hidden xl:block text-[10.5px] text-mute tracking-wider">WITNESS-GUIDED FACIAL RECONSTRUCTION · ACADEMIC PROTOTYPE</div>
        </div>
      </Link>
      <nav className="flex items-center gap-1 ml-2 sm:ml-6">
        {[['/', 'Home'], ['/cases', 'Cases'], ['/felons', 'Convicted Felons']].map(([to, l]) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `px-3 h-9 rounded-md text-[13.5px] font-medium grid place-items-center transition-colors ${isActive ? 'bg-steel-l text-steel-d' : 'text-graphite hover:bg-[#f1f1ee]'}`}>{l}</NavLink>
        ))}
        <Link to="/cases?new=1" className="btn btn-primary !h-9 !px-3.5 !text-[13px] ml-1">+ New case</Link>
      </nav>
      <div className="ml-auto hidden lg:flex items-center gap-2">
        {s?.offline && <Badge tone="warn">BACKEND OFFLINE</Badge>}
        {s && !s.offline && <>
          <Badge tone="steel">3D FACE STUDIO</Badge>
          {s.photoreal && <Badge tone="ok">PHOTO-REAL AI · ON</Badge>}
          <Badge tone={s.matching === 'real' ? 'ok' : 'warn'}>MATCHING · {s.matching === 'real' ? 'REAL MODEL' : 'UNAVAILABLE'}</Badge>
        </>}
      </div>
    </header>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-full flex flex-col">
        <Header />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/cases" element={<Cases />} />
            <Route path="/case/:id" element={<CasePage />} />
            <Route path="/felons" element={<Felons />} />
          </Routes>
        </main>
        <footer className="noprint border-t border-line bg-surface px-6 py-3 text-[11px] leading-relaxed text-mute">{DISCLAIMER}</footer>
      </div>
    </BrowserRouter>
  )
}
