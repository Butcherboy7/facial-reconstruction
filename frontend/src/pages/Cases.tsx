import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { Badge } from '../App'
import { Plus, Chevron } from '../icons'

const today = () => new Date().toISOString().slice(0, 10)

export default function Cases() {
  const nav = useNavigate()
  const [cases, setCases] = useState<any[] | null>(null)
  const [sp] = useSearchParams()
  const [open, setOpen] = useState(sp.get('new') === '1')
  const [f, setF] = useState<any>({ name: '', date: today(), location: '', investigator: '', incident_type: 'Robbery', description: '', notes: '' })
  const [busy, setBusy] = useState(false)
  useEffect(() => { api.cases().then(setCases).catch(() => setCases([])) }, [])
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value })
  const create = async () => {
    setBusy(true)
    try { const c = await api.createCase(f); nav(`/case/${c.id}`) } finally { setBusy(false) }
  }
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">Cases</h1>
          <p className="text-mute mt-1 text-[14px] max-w-xl">Describe a person from witness memory, generate an AI-assisted facial approximation, and compare it against a reference set.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setOpen(true)}><Plus /> New case</button>
      </div>

      {cases === null && <div className="text-mute text-sm">Loading…</div>}
      {cases && cases.length === 0 && (
        <div className="card p-14 text-center paper-bg">
          <div className="text-lg font-medium mb-1">No cases yet</div>
          <p className="text-mute text-sm mb-5">Create a case to start a witness interview.</p>
          <button className="btn btn-primary" onClick={() => setOpen(true)}><Plus /> New case</button>
        </div>
      )}
      {cases && cases.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] text-[13.5px]">
            <thead><tr className="text-left bg-[#fafaf8] border-b border-line"><th className="label p-3 pl-5">Case</th><th className="label p-3">Name</th><th className="label p-3">Incident</th><th className="label p-3">Investigator</th><th className="label p-3">Date</th><th className="label p-3">Reconstruction</th></tr></thead>
            <tbody>
              {cases.map(c => (
                <tr key={c.id} className="border-b border-line2 last:border-0 hover:bg-[#fafaf8] cursor-pointer" onClick={() => nav(`/case/${c.id}`)}>
                  <td className="p-3 pl-5 font-mono text-[12.5px] text-steel-d">{c.id}</td>
                  <td className="p-3 font-medium">{c.name}</td>
                  <td className="p-3 text-graphite">{c.incident_type || '—'}</td>
                  <td className="p-3 text-graphite">{c.investigator || '—'}</td>
                  <td className="p-3 text-graphite">{c.date || '—'}</td>
                  <td className="p-3">{c.final_image ? <div className="flex items-center gap-2"><img src={c.final_image.startsWith('/') ? c.final_image : '/files/' + c.final_image} className="w-9 h-9 rounded object-cover border border-line" /><Badge tone="ok">Selected</Badge></div> : <Badge>In progress</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 bg-ink/40 z-40 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="card w-full max-w-2xl p-7 fade" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-semibold mb-5">Create new case</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="sm:col-span-2"><div className="label mb-1.5">Case name *</div><input className="input" value={f.name} onChange={set('name')} placeholder="e.g. Market Street incident" autoFocus /></label>
              <label><div className="label mb-1.5">Date</div><input type="date" className="input" value={f.date} onChange={set('date')} /></label>
              <label><div className="label mb-1.5">Location</div><input className="input" value={f.location} onChange={set('location')} /></label>
              <label><div className="label mb-1.5">Investigator</div><input className="input" value={f.investigator} onChange={set('investigator')} /></label>
              <label><div className="label mb-1.5">Incident type</div>
                <select className="input" value={f.incident_type} onChange={set('incident_type')}>{['Robbery', 'Assault', 'Theft', 'Fraud', 'Missing person', 'Other'].map(x => <option key={x}>{x}</option>)}</select></label>
              <label className="sm:col-span-2"><div className="label mb-1.5">Case description</div><textarea className="input" rows={2} value={f.description} onChange={set('description')} /></label>
              <label className="sm:col-span-2"><div className="label mb-1.5">Notes</div><textarea className="input" rows={2} value={f.notes} onChange={set('notes')} /></label>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={!f.name.trim() || busy} onClick={create}>Create case &amp; start interview</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
