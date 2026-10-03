import { useEffect, useState } from 'react'
import { api } from '../api'
import { Badge } from '../App'
import type { Ctx } from '../pages/Case'
import FaceViewer from '../studio/FaceViewer'
import { finalOf } from '../studio/actions'
import { ArrowRight, Check, Chevron, Scan } from '../icons'

const THRESH = 0.363
const MIN_STAGE_MS = 750

export default function Search({ ctx }: { ctx: Ctx }) {
  const { data, id } = ctx
  const final = data.case.final_image
  const [phase, setPhase] = useState<'idle' | 'scan'>('idle')
  const fin = finalOf(data)
  const [stages, setStages] = useState<string[]>([])
  const [done, setDone] = useState(0)
  const [err, setErr] = useState('')
  const [sel, setSel] = useState<any>(null)
  const [refs, setRefs] = useState<any[]>([])
  const s = data.search
  useEffect(() => { api.refs().then(setRefs).catch(() => {}) }, [])
  useEffect(() => { if (s && !sel) setSel(s.results[0]) }, [s])

  if (!final) return (
    <div className="card p-14 text-center paper-bg"><div className="text-lg font-medium mb-1">Describe the person first</div>
      <button className="btn btn-primary mt-3" onClick={() => ctx.go('interview')}>Go to Describe</button></div>
  )

  const run = async () => {
    setErr(''); setDone(0); setStages([]); setPhase('scan')
    try {
      const r = await api.search(id)
      setStages(r.stages.map((x: any) => x.name))
      for (let i = 0; i < r.stages.length; i++) {
        await new Promise(res => setTimeout(res, Math.max(MIN_STAGE_MS, r.stages[i].ms)))
        setDone(i + 1)
      }
      await ctx.reload(); setSel(r.results[0])
    } catch (e: any) { setErr(e.message) }
    setPhase('idle')
  }

  if (phase === 'scan') {
    const names = stages.length ? stages : ['Preparing reconstruction', 'Detecting face', 'Generating embedding', 'Searching reference database', 'Comparing candidates', 'Ranking results']
    const pct = Math.round((done / names.length) * 100)
    return (
      <div className="card overflow-hidden fade grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] lg:h-[600px]">
        <div className="relative h-[360px] lg:h-auto" style={{ background: 'radial-gradient(circle at 50% 40%, #f4f8fb, #cfd9e2)' }}>
          {fin && <FaceViewer profile={fin.profile} seed={fin.seed} jitter={fin.jitter} auto className="absolute inset-0" />}
          <div className="absolute inset-0 gridov pointer-events-none" />
          <div className="scanline" />
          <div className="absolute top-3 left-3 flex gap-2"><Badge tone="steel">REFERENCE SEARCH IN PROGRESS</Badge></div>
        </div>
        <div className="p-6 flex flex-col">
          <div className="label mb-4">Processing stages</div>
          <div className="space-y-3 flex-1">
            {names.map((n, i) => (
              <div key={n} className={`flex items-center gap-3 text-[14px] ${i < done ? 'text-ink' : i === done && stages.length ? 'text-steel-d font-medium' : 'text-mute'}`}>
                <span className={`w-5 h-5 rounded-full grid place-items-center text-[11px] ${i < done ? 'bg-ok text-white' : i === done && stages.length ? 'border-2 border-steel border-t-transparent animate-spin' : 'border border-line'}`}>{i < done ? <Check size={11} /> : ''}</span>{n}
              </div>
            ))}
          </div>
          <div className="h-2 rounded bg-line2 overflow-hidden"><div className="h-full bg-steel transition-all duration-500" style={{ width: pct + '%' }} /></div>
          <div className="text-[12px] text-mute mt-2 font-mono">{pct}%</div>
          <p className="text-[11px] text-mute mt-4 leading-relaxed">Stages reflect the real pipeline (face detection → embedding → cosine comparison). The scan graphic is visual only and does not affect the result.</p>
        </div>
      </div>
    )
  }

  const results: any[] = s?.results || []
  const top = results.slice(0, 3)
  return (
    <div className="fade">
      <div className="card p-5 mb-6 flex flex-wrap items-center gap-5">
        <img src={final} className="w-20 h-20 rounded-lg object-cover border border-line" />
        <div className="flex-1 min-w-[240px]">
          <div className="label">Search image</div>
          <div className="text-[14px] text-graphite mt-1">Final reconstruction → face detection → alignment → embedding → cosine similarity against <b>{refs.length || 18} synthetic reference faces</b>.</div>
          <div className="flex gap-2 mt-2"><Badge tone="ok">SFace embeddings · REAL MODEL</Badge><Badge tone="warn">REFERENCE / DEMO DATA ONLY</Badge></div>
        </div>
        <button className="btn btn-primary h-12 px-6" onClick={run}><Scan size={17} /> {s ? 'Re-run search' : 'SEARCH REFERENCE DATABASE'}</button>
      </div>
      {err && <div className="card p-4 mb-6 text-sm text-warn">{err}</div>}

      {!s && <div className="card p-14 text-center paper-bg text-mute text-sm">No search has been run for this case.</div>}
      {s && (
        <>
          <div className="flex flex-wrap items-end justify-between gap-2 mb-3"><h2 className="text-[20px] font-semibold tracking-tight">Potential reference matches</h2>
            <div className="text-[12px] text-mute">Ranked by cosine similarity · {results.length} references searched</div></div>
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
            <div>
              <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-5 stagger">
                {top.map(r => (
                  <button key={r.id} onClick={() => setSel(r)} className={`card overflow-hidden text-left ${sel?.id === r.id ? 'ring-2 ring-steel' : ''}`}>
                    <div className="relative"><img src={r.url} className="w-full aspect-square object-cover" /><span className="absolute top-2 left-2 bg-ink/80 text-white text-[11px] font-semibold px-2 py-0.5 rounded">#{r.rank}</span></div>
                    <div className="p-2 sm:p-3"><div className="font-mono text-[11px] sm:text-[12.5px] text-steel-d">{r.id}</div>
                      <div className="flex items-baseline justify-between mt-1"><span className="hidden sm:inline text-[11px] text-mute">Similarity</span><span className="text-[15px] sm:text-[20px] font-semibold tabular-nums">{r.similarity.toFixed(3)}</span></div>
                      <Bar v={r.similarity} /></div>
                  </button>
                ))}
              </div>
              <div className="card overflow-x-auto">
                <table className="w-full min-w-[420px] text-[13px]"><thead><tr className="bg-[#fafaf8] border-b border-line text-left"><th className="label p-2.5 pl-4">Rank</th><th className="label p-2.5">Reference</th><th className="label p-2.5">Similarity (cosine)</th><th className="p-2.5" /></tr></thead>
                  <tbody>{results.map(r => (
                    <tr key={r.id} className={`border-b border-line2 last:border-0 cursor-pointer hover:bg-[#fafaf8] ${sel?.id === r.id ? 'bg-steel-l/50' : ''}`} onClick={() => setSel(r)}>
                      <td className="p-2 pl-4 tabular-nums">{r.rank}</td>
                      <td className="p-2"><div className="flex items-center gap-2"><img src={r.url} className="w-7 h-7 rounded object-cover" /><span className="font-mono text-[12px]">{r.id}</span></div></td>
                      <td className="p-2 w-[55%]"><div className="flex items-center gap-3"><span className="tabular-nums w-12">{r.similarity.toFixed(3)}</span><div className="flex-1"><Bar v={r.similarity} /></div></div></td>
                      <td className="p-2 text-mute"><Chevron size={14} /></td></tr>))}</tbody></table>
              </div>
            </div>
            <aside className="card p-4 lg:sticky lg:top-4">
              <div className="label mb-3">Side-by-side comparison</div>
              {sel && <>
                <div className="grid grid-cols-2 gap-3">
                  <div><img src={s.query_url} className="w-full aspect-[4/5] object-cover object-top rounded-lg border border-line" /><div className="text-[11.5px] text-mute mt-1.5">AI reconstruction</div></div>
                  <div><img src={sel.url} className="w-full aspect-[4/5] object-cover object-top rounded-lg border border-line" /><div className="text-[11.5px] text-mute mt-1.5 font-mono">{sel.id}</div></div>
                </div>
                <div className="mt-4 flex items-baseline justify-between"><span className="text-[12px] text-mute">Model similarity</span><span className="text-2xl font-semibold tabular-nums">{sel.similarity.toFixed(3)}</span></div>
                <Bar v={sel.similarity} />
                <div className="text-[10.5px] text-mute mt-1.5">Tick mark = {THRESH} (model's published same-identity reference threshold; shown for scale only).</div>
              </>}
              <div className="mt-4 rounded-lg bg-warn-l text-warn text-[12px] p-3 leading-relaxed"><b>Similarity score represents model output and does not establish identity.</b> Results are potential reference matches against synthetic demo faces — not identifications.</div>
            </aside>
          </div>
          <div className="mt-6"><button className="btn btn-primary" onClick={() => ctx.go('report')}>Continue to case report <ArrowRight /></button></div>
        </>
      )}
    </div>
  )
}

function Bar({ v }: { v: number }) {
  return (
    <div className="relative h-1.5 rounded bg-line2 mt-1.5">
      <div className="h-full rounded bg-steel" style={{ width: Math.max(0, Math.min(1, v)) * 100 + '%' }} />
      <div className="absolute -top-1 w-px h-3.5 bg-graphite/60" style={{ left: THRESH * 100 + '%' }} />
    </div>
  )
}
