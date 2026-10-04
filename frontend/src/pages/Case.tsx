import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import type { Profile } from '../api'
import type { Schema } from '../sketch'
import Interview from '../components/Interview'
import Analyze from '../components/Analyze'
import Search from '../components/Search'
import Report from '../components/Report'
import { Check } from '../icons'
import { adaptSchema, normalize } from '../studio/logic'

export type Ctx = { id: string; schema: Schema; data: any; reload: () => Promise<void>; go: (t: string) => void; profile: Profile; setProfile: (p: Profile) => void }

const TABS = [
  { id: 'interview', label: 'Describe', hint: 'Answer questions about the person', help: 'Answer the questions one group at a time. The 3D face changes as you go. When everything required is filled in, save the face.' },
  { id: 'analyze', label: 'Explore', hint: 'Sketch, 3D view, age, variations', help: 'Work from the face you picked: turn it in 3D, make a pencil sketch, see other ages, or try glasses, different hair or facial hair.' },
  { id: 'search', label: 'Compare', hint: 'Match against reference faces', help: 'Run the picked face against the stored reference set. Scores are model output only; they never establish identity.' },
  { id: 'report', label: 'Report', hint: 'Printable case summary', help: 'A summary of the whole case. Use Print to save it as a PDF.' },
]

export default function CasePage() {
  const { id = '' } = useParams()
  const [sp, setSp] = useSearchParams()
  const tab = sp.get('tab') || 'interview'
  const [schema, setSchema] = useState<Schema | null>(null)
  const [data, setData] = useState<any>(null)
  const [profile, setRawProfile] = useState<Profile>({ age: 35 })
  const setProfile = useCallback((p: Profile) => setRawProfile(normalize(p)), [])
  const [err, setErr] = useState('')

  const reload = useCallback(async () => { setData(await api.detail(id)) }, [id])
  useEffect(() => {
    api.schema().then(setSchema).catch(e => setErr(e.message))
    api.detail(id).then(d => { setData(d); if (Object.keys(d.case.profile || {}).length) setRawProfile(normalize(d.case.profile)) }).catch(e => setErr(e.message))
  }, [id])

  const go = (t: string) => setSp({ tab: t })
  if (err) return <div className="p-10 text-sm text-warn">Could not load case: {err}. Is the backend running on port 8000?</div>
  if (!schema || !data) return <div className="p-10 text-mute text-sm">Loading case…</div>
  const c = data.case
  const vschema = adaptSchema(schema, profile)   // only the questions that apply to this person
  const ctx: Ctx = { id, schema: vschema, data, reload, go, profile, setProfile }
  const done: Record<string, boolean> = {
    interview: vschema.required.every(k => profile[k]),
    analyze: data.assets.length > 0,
    search: !!data.search,
    report: false,
  }

  return (
    <div>
      <div className="noprint bg-surface border-b border-line">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 pt-4">
          <div className="flex items-center gap-2 text-[12px] text-mute mb-1"><Link to="/" className="hover:text-ink">Home</Link><span>/</span><Link to="/cases" className="hover:text-ink">Cases</Link><span>/</span><span className="font-mono text-steel-d">{c.id}</span></div>
          <div className="flex flex-wrap items-center justify-between gap-1">
            <h1 className="text-[19px] font-semibold tracking-tight">{c.name}</h1>
            <div className="text-[12px] text-mute">{[c.incident_type, c.location, c.investigator].filter(Boolean).join(' · ')}</div>
          </div>
          <nav className="flex gap-1 mt-3 -mb-px overflow-x-auto">
            {TABS.map((t, i) => (
              <button key={t.id} onClick={() => go(t.id)}
                className={`px-3 sm:px-4 h-12 shrink-0 text-[13px] font-medium flex items-center gap-2 border-b-2 transition-colors ${tab === t.id ? 'border-steel text-ink' : 'border-transparent text-mute hover:text-ink'}`}>
                <span className={`w-5 h-5 rounded-full text-[11px] grid place-items-center ${done[t.id] ? 'bg-ok text-white' : tab === t.id ? 'bg-steel text-white' : 'bg-line2 text-mute'}`}>{done[t.id] ? <Check size={12} /> : i + 1}</span>
                <span className="text-left leading-tight"><span className="block">{t.label}</span><span className="hidden lg:block text-[10.5px] font-normal text-mute">{t.hint}</span></span>
              </button>
            ))}
          </nav>
        </div>
      </div>
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
        <p className="noprint text-[13.5px] text-graphite mb-5 max-w-3xl"><b className="text-ink">Step {TABS.findIndex(t => t.id === tab) + 1} of {TABS.length} · {TABS.find(t => t.id === tab)?.label}.</b> {TABS.find(t => t.id === tab)?.help}</p>
        {tab === 'interview' && <Interview ctx={ctx} />}
        {tab === 'analyze' && <Analyze ctx={ctx} />}
        {tab === 'search' && <Search ctx={ctx} />}
        {tab === 'report' && <Report ctx={ctx} />}
      </div>
    </div>
  )
}
