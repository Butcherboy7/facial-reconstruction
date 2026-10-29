import { useEffect, useState } from 'react'
import type { Ctx } from '../pages/Case'

export type Statement = { id: number; witness: string; contact: string; date: string; text: string }
export type SuspectFile = {
  name: string; alias: string; sex: string; age: string; height: string; build: string; crime: string; lastSeen: string; lastSeenDate: string
  vehicle: string; leads: string; status: string; reward: string; statements: Statement[]
}

const KEY = (id: string) => `casefile:${id}`
export function loadFile(id: string, ctxCase: any, profile: any): SuspectFile {
  let saved: Partial<SuspectFile> = {}
  try { saved = JSON.parse(localStorage.getItem(KEY(id)) || '{}') } catch { /* private mode */ }
  return {
    name: 'Unknown', alias: '', sex: profile.sex === 'female' ? 'Female' : 'Male', age: profile.age ? `${profile.age - 3}–${profile.age + 3}` : '', height: '', build: '',
    crime: ctxCase.incident_type || '', lastSeen: ctxCase.location || '', lastSeenDate: ctxCase.date || '', vehicle: '', leads: '', status: 'Absconding', reward: '', statements: [],
    ...saved,
  }
}
function saveFile(id: string, f: SuspectFile) { try { localStorage.setItem(KEY(id), JSON.stringify(f)) } catch { /* ignore */ } }

export default function CaseFile({ ctx }: { ctx: Ctx }) {
  const { id, data, profile } = ctx
  const [f, setF] = useState<SuspectFile>(() => loadFile(id, data.case, profile))
  const [draft, setDraft] = useState({ witness: '', contact: '', date: new Date().toISOString().slice(0, 10), text: '' })
  const [saved, setSaved] = useState(false)
  useEffect(() => { saveFile(id, f); setSaved(true); const t = setTimeout(() => setSaved(false), 900); return () => clearTimeout(t) }, [f, id])
  const set = (k: keyof SuspectFile) => (e: any) => setF({ ...f, [k]: e.target.value })
  const F = ({ k, label, ph, wide }: { k: keyof SuspectFile; label: string; ph?: string; wide?: boolean }) => (
    <label className={wide ? 'sm:col-span-2' : ''}><div className="text-[12px] text-graphite mb-1">{label}</div>
      <input className="input !h-9 text-[13px]" value={f[k] as string} placeholder={ph} onChange={set(k)} /></label>)
  const add = () => { if (!draft.text.trim()) return; setF({ ...f, statements: [...f.statements, { id: Date.now(), ...draft, witness: draft.witness || 'Anonymous witness' }] }); setDraft({ ...draft, witness: '', contact: '', text: '' }) }

  return (
    <div className="grid lg:grid-cols-2 gap-6 items-start">
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {data.case.final_image && <img src={data.case.final_image} className="w-12 h-14 rounded object-cover object-top border border-line" />}
            <div><div className="label">Suspect details</div><div className="text-[15px] font-semibold">{f.name || 'Unknown'}</div></div>
          </div>
          <span className={`text-[11px] text-ok transition-opacity ${saved ? 'opacity-100' : 'opacity-0'}`}>Saved</span>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {F({ k: 'name', label: 'Name', ph: 'Unknown' })}{F({ k: 'alias', label: 'Alias / nickname', ph: 'e.g. "Kaala"' })}
          {F({ k: 'sex', label: 'Sex' })}{F({ k: 'age', label: 'Estimated age' })}
          {F({ k: 'height', label: 'Height', ph: 'e.g. 5\'8" / 172 cm' })}{F({ k: 'build', label: 'Build', ph: 'Slim / medium / heavy' })}
          {F({ k: 'crime', label: 'Wanted for', wide: true })}
          {F({ k: 'lastSeen', label: 'Last seen at' })}{F({ k: 'lastSeenDate', label: 'Last seen on' })}
          {F({ k: 'vehicle', label: 'Vehicle', ph: 'e.g. black Pulsar, KA-02 …' })}{F({ k: 'status', label: 'Status' })}
          {F({ k: 'reward', label: 'Reward (optional)', ph: 'e.g. ₹50,000', wide: true })}
          <label className="sm:col-span-2"><div className="text-[12px] text-graphite mb-1">Leads</div>
            <textarea className="input !h-auto py-2 text-[13px]" rows={5} value={f.leads} onChange={set('leads')} placeholder={'One lead per line, e.g.\nSeen near Rajajinagar 2nd Block bus stop on 22 Oct\nCCTV at Navrang circle shows a similar rider'} /></label>
        </div>
      </div>

      <div className="card p-5">
        <div className="label mb-3">Witness statements · {f.statements.length}</div>
        <div className="grid sm:grid-cols-3 gap-2 mb-2">
          <input className="input !h-9 text-[13px]" placeholder="Witness name" value={draft.witness} onChange={e => setDraft({ ...draft, witness: e.target.value })} />
          <input className="input !h-9 text-[13px]" placeholder="Contact" value={draft.contact} onChange={e => setDraft({ ...draft, contact: e.target.value })} />
          <input type="date" className="input !h-9 text-[13px]" value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })} />
        </div>
        <textarea className="input !h-auto py-2 text-[13px]" rows={4} placeholder="Statement as given by the witness…" value={draft.text} onChange={e => setDraft({ ...draft, text: e.target.value })} />
        <button className="btn btn-primary mt-2" disabled={!draft.text.trim()} onClick={add}>Record statement</button>
        <div className="mt-5 space-y-3">
          {f.statements.length === 0 && <p className="text-[13px] text-mute">No statements recorded yet.</p>}
          {[...f.statements].reverse().map((s, i) => (
            <div key={s.id} className="border border-line rounded-lg p-3 bg-[#fafaf8]">
              <div className="flex justify-between items-start gap-2">
                <div className="text-[12.5px]"><b>Statement {f.statements.length - i}</b> · {s.witness}{s.contact && <span className="text-mute"> · {s.contact}</span>}</div>
                <div className="flex items-center gap-3 text-[11px] text-mute">{s.date}<button className="hover:text-warn" onClick={() => setF({ ...f, statements: f.statements.filter(x => x.id !== s.id) })}>Remove</button></div>
              </div>
              <p className="text-[13px] mt-1.5 leading-relaxed whitespace-pre-wrap">{s.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
