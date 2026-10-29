import { useEffect, useState } from 'react'
import { renderJobs } from '../studio/render'
import { FELONS } from './data'
import type { Felon } from './data'
import { fingerprint, fingerprintType, mugshot } from './photo'

// ---- faces: every record rendered once by the 3D face model, then cached for the session ----
let facesP: Promise<Record<string, string>> | null = null
export function loadFelonFaces() {
  facesP ??= renderJobs(FELONS.map(f => ({ profile: f.profile, seed: 0, jitter: 0 })))
    .then(imgs => Promise.all(FELONS.map((f, i) => mugshot(imgs[i], f, i))))
    .then(imgs => Object.fromEntries(FELONS.map((f, i) => [f.id, imgs[i]])))
  return facesP
}
export function useFelonFaces() {
  const [faces, setFaces] = useState<Record<string, string> | null>(null)
  useEffect(() => { let on = true; loadFelonFaces().then(f => { if (on) setFaces(f) }); return () => { on = false } }, [])
  return faces
}

// ---- inked fingerprint card (rendered in photo.ts) ----
export function Fingerprint({ seed, size = 120, label }: { seed: number; size?: number; label?: string }) {
  return (
    <figure className="inline-flex flex-col items-center">
      <img src={fingerprint(seed)} width={size} height={size * 1.28} className="bg-white rounded-sm border border-line" style={{ width: size, height: size * 1.28 }} />
      {label && <figcaption className="text-[9.5px] text-mute mt-1 uppercase tracking-wider text-center leading-tight">{label}<br />{fingerprintType(seed)}</figcaption>}
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
