import { useEffect, useState } from 'react'
import { renderJobs } from '../studio/render'
import { FELONS } from './data'
import type { Felon } from './data'

// ---- faces: every record rendered once by the 3D face model, then cached for the session ----
let facesP: Promise<Record<string, string>> | null = null
export function loadFelonFaces() {
  facesP ??= renderJobs(FELONS.map(f => ({ profile: f.profile, seed: 0, jitter: 0 })))
    .then(imgs => Object.fromEntries(FELONS.map((f, i) => [f.id, imgs[i]])))
  return facesP
}
export function useFelonFaces() {
  const [faces, setFaces] = useState<Record<string, string> | null>(null)
  useEffect(() => { let on = true; loadFelonFaces().then(f => { if (on) setFaces(f) }); return () => { on = false } }, [])
  return faces
}

// ---- procedural fingerprint (loop / whorl / arch), seeded so each record keeps its own print ----
function rng(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 } }

export function Fingerprint({ seed, size = 120, label }: { seed: number; size?: number; label?: string }) {
  const r = rng(seed * 31 + 7)
  const type = ['loop', 'whorl', 'arch', 'loop'][Math.floor(r() * 4)]
  const cx = 50 + (r() - 0.5) * 10, cy = 58 + (r() - 0.5) * 8, ph = r() * 6.28, a1 = 0.08 + r() * 0.08, tilt = (r() - 0.5) * 0.5
  const paths: string[] = []
  for (let k = 1; k <= 26; k++) {
    const rad = k * 2.25, pts: string[] = []
    const t0 = type === 'whorl' ? 0 : type === 'loop' ? -0.35 : 0.15, t1 = type === 'whorl' ? 6.3 : type === 'loop' ? 3.5 : 2.99
    for (let t = t0; t <= t1; t += 0.06) {
      let x: number, y: number
      const wob = 1 + a1 * Math.sin(3 * t + ph) * Math.min(1, k / 8) + 0.03 * Math.sin(7 * t + k)
      if (type === 'arch') { x = cx + (t - 1.57) * 30; y = cy - rad * 0.9 * Math.sin(Math.max(0, Math.min(3.14, t))) * 0.55 + k * 1.6 - 18 }
      else { x = cx + Math.cos(t + tilt) * rad * wob * (type === 'loop' ? 0.85 : 1); y = cy - Math.sin(t + tilt) * rad * wob * 1.15 }
      if (type === 'loop' && t > 3.14) { x -= (t - 3.14) * 0; y += (t - 3.14) * rad * 2.2 }
      if (type === 'loop' && t < 0) { y += -t * rad * 2.2 }
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`)
    }
    paths.push(pts.join(' '))
  }
  const id = `fp${seed}`
  return (
    <figure className="inline-flex flex-col items-center">
      <svg width={size} height={size * 1.25} viewBox="0 0 100 125" className="bg-white rounded">
        <defs><clipPath id={id}><ellipse cx="50" cy="62" rx="40" ry="54" /></clipPath>
          <filter id={id + 'f'}><feTurbulence baseFrequency="0.9" numOctaves="1" seed={seed % 97} /><feDisplacementMap in="SourceGraphic" scale="1.6" /></filter></defs>
        <g clipPath={`url(#${id})`} filter={`url(#${id}f)`} fill="none" stroke="#2b2b2b" strokeWidth="1.15" strokeLinecap="round">
          {paths.map((d, i) => <polyline key={i} points={d} strokeDasharray={`${18 + ((i * 37 + seed) % 40)} ${1.5 + ((i * 13 + seed) % 3)}`} opacity={0.75 + ((i * 7) % 3) * 0.08} />)}
        </g>
        <ellipse cx="50" cy="62" rx="40" ry="54" fill="none" stroke="#e5e5e2" />
      </svg>
      {label && <figcaption className="text-[10px] text-mute mt-1 uppercase tracking-wider">{label} · {type}</figcaption>}
    </figure>
  )
}

export function FelonFace({ f, faces, className = '' }: { f: Felon; faces: Record<string, string> | null; className?: string }) {
  return faces ? <img src={faces[f.id]} className={`object-cover object-top ${className}`} /> : <div className={`bg-line2 animate-pulse ${className}`} />
}

export function FelonDetail({ f, faces, onClose, action }: { f: Felon; faces: Record<string, string> | null; onClose: () => void; action?: React.ReactNode }) {
  const Row = ({ k, v }: { k: string; v: React.ReactNode }) => <div className="flex gap-3 py-1.5 border-b border-line2 text-[13px]"><span className="w-28 shrink-0 text-mute">{k}</span><span className="font-medium">{v}</span></div>
  return (
    <div className="fixed inset-0 z-50 bg-ink/50 grid place-items-center p-4" onClick={onClose}>
      <div className="card max-w-4xl w-full max-h-[92vh] overflow-auto fade" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-line bg-[#f6f6f3]">
          <div><div className="label">Convicted felons register · {f.id}</div><div className="text-[18px] font-semibold">{f.name} <span className="text-mute font-normal text-[14px]">{f.alias !== '—' && f.alias}</span></div></div>
          <button className="btn btn-ghost !h-8" onClick={onClose}>Close</button>
        </div>
        <div className="grid md:grid-cols-[220px_1fr] gap-5 p-5">
          <div>
            <FelonFace f={f} faces={faces} className="w-full aspect-[4/5] rounded-lg border border-line" />
            <div className="label mt-4 mb-2">Fingerprints on file</div>
            <div className="flex gap-2 justify-between"><Fingerprint seed={f.seed} size={62} label="R thumb" /><Fingerprint seed={f.seed + 1} size={62} label="R index" /><Fingerprint seed={f.seed + 2} size={62} label="L thumb" /></div>
          </div>
          <div>
            <div className="grid sm:grid-cols-2 gap-x-6">
              <div><Row k="Full name" v={f.name} /><Row k="Alias" v={f.alias} /><Row k="Sex" v={f.sex === 'male' ? 'Male' : 'Female'} /><Row k="Age" v={`${f.age} years`} /><Row k="Date of birth" v={f.dob} /><Row k="Blood group" v={<span className="text-warn">{f.blood}</span>} /></div>
              <div><Row k="Crime" v={f.crime} /><Row k="Section" v={f.section} /><Row k="Convicted" v={f.convicted} /><Row k="Sentence" v={f.sentence} /><Row k="Status" v={f.status} /><Row k="Height / build" v={`${f.height} cm · ${f.build}`} /></div>
            </div>
            <Row k="Identifying marks" v={f.marks} />
            <div className="label mt-4 mb-1">Description of offence</div>
            <p className="text-[13px] leading-relaxed"><b>Motive (why): </b>{f.motive}</p>
            <p className="text-[13px] leading-relaxed mt-2"><b>Method (how): </b>{f.method}</p>
            <p className="text-[13px] leading-relaxed mt-2"><b>Psychological assessment: </b>{f.psychology}</p>
            {action && <div className="mt-5">{action}</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
