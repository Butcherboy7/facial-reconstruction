import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { FELONS } from '../felons/data'
import type { Felon } from '../felons/data'
import { FelonDetail, FelonFace, Fingerprint, useFelonFaces } from '../felons/ui'
import { generateVersion } from '../studio/actions'

// a witness never describes a face perfectly: change a few features so the demo match is strong but not 100%
function witnessVersion(f: Felon) {
  const p = { ...f.profile }
  const alt: Record<string, string[]> = { eyes: ['almond', 'round', 'hooded'], chin: ['medium', 'pointed'], ears: ['medium', 'small'], forehead: ['medium', 'high'] }
  for (const k of ['eyes', 'chin', 'ears']) p[k] = alt[k].find(v => v !== p[k])
  p.age = f.age + 3
  return p
}

export default function Felons() {
  const faces = useFelonFaces()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<Felon | null>(null)
  const [busy, setBusy] = useState(false)
  const list = FELONS.filter(f => (f.name + f.alias + f.crime + f.id).toLowerCase().includes(q.toLowerCase()))

  const demoCase = async (f: Felon) => {
    setBusy(true)
    try {
      const c = await api.createCase({ name: `Demo: suspect resembling ${f.id}`, date: new Date().toISOString().slice(0, 10), location: 'Rajajinagar, Bengaluru', investigator: 'Demo', incident_type: f.crime, description: 'Demo case created from a witness-style description of a register entry.', notes: '' })
      const p = witnessVersion(f)
      await api.saveProfile(c.id, p)
      const v = await generateVersion(c.id, p)
      await api.select(c.id, v.id, 0)
      nav(`/case/${c.id}?tab=match`)
    } catch (e: any) { alert(e.message) } finally { setBusy(false) }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <div className="label">Karnataka State Police · Criminal records</div>
          <h1 className="text-[28px] font-semibold tracking-tight">Convicted Felons</h1>
          <p className="text-mute mt-1 text-[14px] max-w-xl">{FELONS.length} records with face, fingerprints and case history. Reconstructed faces are matched against this register in the <b>Match Database</b> step of a case.</p>
        </div>
        <input className="input max-w-xs" placeholder="Search name, alias, crime, record no." value={q} onChange={e => setQ(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 stagger">
        {list.map(f => (
          <button key={f.id} onClick={() => setSel(f)} className="card overflow-hidden text-left hover:ring-2 hover:ring-steel transition-shadow">
            <div className="relative">
              <FelonFace f={f} faces={faces} className="w-full aspect-[4/5]" />
              <span className="absolute top-2 left-2 bg-ink/80 text-white text-[10px] font-mono px-1.5 py-0.5 rounded">{f.id}</span>
              <span className="absolute bottom-1 right-1 opacity-90"><Fingerprint seed={f.seed} size={26} /></span>
            </div>
            <div className="p-2.5">
              <div className="text-[13px] font-semibold truncate">{f.name}</div>
              <div className="text-[11.5px] text-mute truncate">{f.crime} · {f.convicted}</div>
              <div className="text-[11px] text-mute">{f.age} yrs · {f.blood}</div>
            </div>
          </button>
        ))}
      </div>
      {!faces && <p className="text-[12px] text-mute mt-4">Rendering record photographs…</p>}
      {sel && <FelonDetail f={sel} faces={faces} onClose={() => setSel(null)}
        action={<div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <button className="btn btn-primary" disabled={busy} onClick={() => demoCase(sel)}>{busy ? 'Creating case…' : 'Demo: create a witness case resembling this person'}</button>
          <span className="text-[11.5px] text-mute">Builds a reconstruction from a slightly imperfect description, then opens Match Database.</span>
        </div>} />}
    </div>
  )
}
