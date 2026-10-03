import { useEffect, useState } from 'react'
import { api } from '../api'
import { generateVersion } from '../studio/actions'
import { Badge } from '../App'
import type { Ctx } from '../pages/Case'
import { Check, ArrowRight } from '../icons'

const REFINE_KEYS = ['skin', 'hair_style', 'hair_color', 'eyebrows', 'eyes', 'eye_color', 'nose', 'mouth', 'jaw', 'beard', 'mustache', 'glasses']

export default function Reconstruct({ ctx }: { ctx: Ctx }) {
  const { data, schema, id } = ctx
  const versions: any[] = data.versions
  const [vid, setVid] = useState<number | null>(versions.length ? versions[versions.length - 1].id : null)
  const [cmp, setCmp] = useState<number[]>([])
  const [refine, setRefine] = useState(false)
  const [changes, setChanges] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  useEffect(() => { if (vid === null && versions.length) setVid(versions[versions.length - 1].id) }, [versions.length])

  const v = versions.find(x => x.id === vid)
  if (!v) return (
    <div className="card p-14 text-center paper-bg"><div className="text-lg font-medium mb-1">No reconstruction yet</div>
      <p className="text-mute text-sm mb-5">Complete the witness interview and generate candidates.</p>
      <button className="btn btn-primary" onClick={() => ctx.go('interview')}>Go to interview</button></div>
  )
  const q = (k: string) => schema.steps.flatMap(s => s.questions).find(x => x.key === k)!
  const label = (k: string, val: any) => q(k)?.options?.find(o => o.id === val)?.label ?? String(val ?? '—')
  const selected = data.case.final_image

  const choose = async (i: number) => { await api.select(id, v.id, i); await ctx.reload() }
  const doRefine = async () => {
    setBusy(true); setErr('')
    try { const r = await generateVersion(id, { ...v.profile, ...changes }, v.n, changes); await ctx.reload(); setVid(r.id); setRefine(false); setChanges({}) }
    catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }
  const toggleCmp = (i: number) => setCmp(c => c.includes(i) ? c.filter(x => x !== i) : [...c.slice(-1), i])
  const A = versions.find(x => x.id === cmp[0]), B = versions.find(x => x.id === cmp[1])
  const diff = (a: any, b: any) => [...new Set([...Object.keys(a.profile), ...Object.keys(b.profile)])].filter(k => JSON.stringify(a.profile[k]) !== JSON.stringify(b.profile[k]))
  const pick = (x: any) => x.candidates[x.selected ?? 0]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[250px_minmax(0,1fr)] gap-6 items-start">
      <aside className="card p-3 lg:sticky lg:top-4">
        <div className="label px-2 pt-1 pb-2">Version history</div>
        {[...versions].reverse().map(x => (
          <div key={x.id} className={`flex items-center gap-2 rounded-md px-2 py-2 mb-1 cursor-pointer ${x.id === vid ? 'bg-steel-l' : 'hover:bg-[#f4f4f1]'}`} onClick={() => setVid(x.id)}>
            <input type="checkbox" checked={cmp.includes(x.id)} onChange={() => toggleCmp(x.id)} onClick={e => e.stopPropagation()} title="Select to compare" className="accent-[#3d5f7f]" />
            <img src={pick(x).url} className="w-10 h-10 rounded object-cover border border-line" />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold">Version {String(x.n).padStart(2, '0')}</div>
              <div className="text-[11px] text-mute truncate">{new Date(x.created * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {x.mode}</div>
            </div>
            {x.selected !== null && <Check size={14} className="text-ok" />}
          </div>
        ))}
        <p className="text-[11px] text-mute px-2 pt-2 leading-relaxed">Versions are immutable. Tick two to compare.</p>
      </aside>

      <div>
        {A && B && (
          <div className="card p-5 mb-6 fade">
            <div className="flex justify-between mb-3"><div className="label">Comparing versions</div><button className="text-[12px] text-steel-d" onClick={() => setCmp([])}>Close</button></div>
            <div className="grid grid-cols-2 gap-4">
              {[A, B].map(x => <div key={x.id}><img src={pick(x).url} className="w-full rounded-lg border border-line aspect-[4/5] object-cover" /><div className="text-[13px] font-semibold mt-2">Version {String(x.n).padStart(2, '0')}</div></div>)}
            </div>
            <div className="mt-3 text-[12.5px]">
              <span className="label mr-2">Changed attributes</span>
              {diff(A, B).length === 0 ? <span className="text-mute">none (profile identical)</span> : diff(A, B).map(k => <span key={k} className="inline-block mr-2 px-2 py-0.5 rounded bg-[#f1f1ee]">{k.replace('_', ' ')}: {label(k, A.profile[k])} → {label(k, B.profile[k])}</span>)}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <div>
            <h2 className="text-[22px] font-semibold tracking-tight">Pick the face that looks closest</h2>
            <p className="text-[12.5px] text-mute mt-0.5">Version {String(v.n).padStart(2, '0')} · {v.candidates.length} candidates from the structured profile</p>
          </div>
          <div className="flex gap-2 items-center">
            <Badge tone={v.candidates[0]?.meta.photoreal ? 'ok' : 'steel'}>{v.candidates[0]?.meta.photoreal ? 'PHOTO-REAL AI · FROM 3D MODEL' : 'GENERIC FACE MODEL · APPROXIMATION'}</Badge>
            <button className="btn btn-ghost" onClick={() => setRefine(r => !r)}>Refine face</button>
          </div>
        </div>

        {refine && (
          <div className="card p-5 mb-5 fade">
            <div className="label mb-3">Change only the characteristics you want to revise</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {REFINE_KEYS.map(k => (
                <label key={k}><div className="text-[12px] text-graphite mb-1">{k.replace('_', ' ')} <span className="text-mute">(now: {label(k, v.profile[k])})</span></div>
                  <select className="input !h-9 text-[13px]" value={changes[k] ?? ''} onChange={e => setChanges(c => { const n = { ...c }; if (e.target.value) n[k] = e.target.value; else delete n[k]; return n })}>
                    <option value="">Keep</option>{q(k).options!.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select></label>
              ))}
              <label><div className="text-[12px] text-graphite mb-1">age <span className="text-mute">(now: {v.profile.age})</span></div>
                <input type="number" className="input !h-9" min={14} max={80} placeholder="Keep" onChange={e => setChanges(c => { const n = { ...c }; if (e.target.value) (n as any).age = +e.target.value; else delete (n as any).age; return n })} /></label>
            </div>
            <div className="flex items-center gap-3 mt-4">
              <button className="btn btn-primary" disabled={busy || !Object.keys(changes).length} onClick={doRefine}>{busy ? 'Regenerating…' : 'Regenerate as new version'}</button>
              <span className="text-[12px] text-mute">Creates Version {String(versions.length + 1).padStart(2, '0')}; earlier versions stay unchanged.</span>
              {err && <span className="text-[12px] text-warn">{err}</span>}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 stagger">
          {v.candidates.map((c: any, i: number) => {
            const isSel = !!selected && selected.endsWith(c.path)
            const checks = c.meta.checks || {}
            return (
              <div key={i} className={`card overflow-hidden transition-shadow ${isSel ? 'ring-2 ring-steel' : ''}`}>
                <div className="relative"><img src={c.url} className="w-full aspect-[4/5] object-cover" />
                  <span className="absolute top-2 left-2 bg-ink/80 text-white text-[11px] font-semibold px-2 py-0.5 rounded">AI RECONSTRUCTION {'ABCDE'[i]}</span>
                  {c.meta.validation?.face_detected && <span className="absolute bottom-2 left-2 bg-white/90 text-[10.5px] px-1.5 py-0.5 rounded text-ok font-medium">face validated{c.meta.validation.frontal ? ' · frontal' : ''}</span>}
                </div>
                <div className="p-3">
                  {c.meta.agreement !== undefined && (
                    <div className="mb-2">
                      <div className="flex justify-between text-[11px] text-mute mb-1"><span>Profile agreement</span><span className="font-mono">{Math.round(c.meta.agreement * 100)}%</span></div>
                      <div className="h-1.5 rounded bg-line2"><div className="h-full rounded bg-steel" style={{ width: `${c.meta.agreement * 100}%` }} /></div>
                      <div className="flex flex-wrap gap-1 mt-2">{Object.entries(checks).map(([k, ok]) => <span key={k} className={`text-[10px] px-1.5 py-0.5 rounded ${ok ? 'bg-[#e4f0e9] text-ok' : 'bg-warn-l text-warn'}`}>{ok ? '+' : '−'} {k}</span>)}</div>
                    </div>
                  )}
                  <button className={`btn w-full !h-9 text-[12px] ${isSel ? 'btn-ghost' : 'btn-primary'}`} onClick={() => choose(i)}>{isSel ? <><Check size={14} /> Selected as final</> : 'USE THIS RECONSTRUCTION'}</button>
                </div>
              </div>
            )
          })}
        </div>
        <p className="text-[12px] text-mute mt-4 max-w-3xl">Candidate A follows the description exactly. B–D add small natural variations in proportions, because a witness description never pins down one face. These are approximations, not identifications.</p>
        {selected && <div className="mt-5"><button className="btn btn-primary" onClick={() => ctx.go('analyze')}>Continue to sketch · 3D · age <ArrowRight /></button></div>}

        <details className="card mt-6 p-4"><summary className="cursor-pointer text-[13px] font-semibold">Generation prompt (built from the structured profile)</summary>
          <p className="text-[13px] text-graphite mt-3 leading-relaxed">{v.prompt}</p>
          <pre className="text-[11.5px] bg-[#f6f6f3] rounded p-3 mt-3 overflow-auto font-mono">{JSON.stringify(v.profile, null, 2)}</pre></details>
      </div>
    </div>
  )
}
