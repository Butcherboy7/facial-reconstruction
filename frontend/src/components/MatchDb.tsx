import { useEffect, useRef, useState } from 'react'
import type { Ctx } from '../pages/Case'
import { finalOf } from '../studio/actions'
import { FELONS, matchScore } from '../felons/data'
import type { Felon } from '../felons/data'
import { FelonDetail, FelonFace, Fingerprint, loadFelonFaces } from '../felons/ui'

const STAGES = ['Detecting face and aligning to frontal pose', 'Locating 68 facial landmarks', 'Extracting 128-D facial feature vector', `Scanning Convicted Felons register (${FELONS.length} records)`, 'Ranking candidates by similarity']
// landmark dots drawn over the face during the scan (fractions of the image)
const DOTS = [[.36, .45], [.44, .45], [.56, .45], [.64, .45], [.5, .52], [.5, .6], [.44, .63], [.56, .63], [.42, .72], [.5, .74], [.58, .72], [.3, .55], [.7, .55], [.33, .7], [.67, .7], [.5, .86], [.4, .4], [.6, .4], [.38, .82], [.62, .82]]

export default function MatchDb({ ctx }: { ctx: Ctx }) {
  const { data } = ctx
  const final = data.case.final_image
  const fin = finalOf(data)
  const [phase, setPhase] = useState<'idle' | 'scan' | 'done'>('idle')
  const [stage, setStage] = useState(0)
  const [cmp, setCmp] = useState(0)
  const [faces, setFaces] = useState<Record<string, string> | null>(null)
  const [open, setOpen] = useState<Felon | null>(null)
  const timer = useRef<number>(0)
  useEffect(() => { loadFelonFaces().then(setFaces); return () => clearInterval(timer.current) }, [])
  useEffect(() => { if (new URLSearchParams(location.search).has('autoscan') && final) run() }, [])   // ?autoscan: start immediately (kiosk / demo)

  if (!final || !fin) return (
    <div className="card p-14 text-center paper-bg"><div className="text-lg font-medium mb-1">Generate a face first</div>
      <button className="btn btn-primary mt-3" onClick={() => ctx.go('interview')}>Go to Describe</button></div>
  )
  const results = FELONS.map(f => ({ f, ...matchScore(fin.profile, f) })).sort((a, b) => b.pct - a.pct)
  const top = results[0]

  const run = async () => {
    setPhase('scan'); setStage(0); setCmp(0)
    await loadFelonFaces()
    timer.current = window.setInterval(() => setCmp(c => (c + 1) % FELONS.length), 110)
    for (let i = 0; i < STAGES.length; i++) { setStage(i); await new Promise(r => setTimeout(r, i === 3 ? 3200 : 1100)) }
    clearInterval(timer.current); setStage(STAGES.length); setPhase('done')
  }
  const tone = (p: number) => p >= 85 ? ['STRONG MATCH', 'bg-warn text-white'] : p >= 70 ? ['POSSIBLE MATCH', 'bg-[#c58a1d] text-white'] : ['WEAK', 'bg-line2 text-graphite']

  return (
    <div>
      <div className="grid lg:grid-cols-[360px_1fr] gap-6 items-start">
        <div className="card p-4">
          <div className="label mb-2">Probe face · reconstruction</div>
          <div className="relative rounded-lg overflow-hidden border border-line">
            <img src={final} className="w-full aspect-[4/5] object-cover object-top" />
            {phase === 'scan' && <>
              <div className="absolute inset-0 bg-[#0b2a3d]/25" />
              <div className="scanline" />
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 125" preserveAspectRatio="none">
                {stage >= 1 && DOTS.map(([x, y], i) => <circle key={i} cx={x * 100} cy={y * 125} r="0.9" fill="#4ff0c8" className="dotpop" style={{ animationDelay: `${i * 45}ms` }} />)}
                {stage >= 1 && <polyline points={DOTS.slice(0, 4).map(([x, y]) => `${x * 100},${y * 125}`).join(' ')} stroke="#4ff0c8" strokeWidth=".3" fill="none" />}
                {stage >= 1 && <polyline points={[DOTS[6], DOTS[8], DOTS[9], DOTS[10], DOTS[7]].map(([x, y]) => `${x * 100},${y * 125}`).join(' ')} stroke="#4ff0c8" strokeWidth=".3" fill="none" />}
                <rect x="22" y="38" width="56" height="64" fill="none" stroke="#4ff0c8" strokeWidth=".5" strokeDasharray="3 2" />
              </svg>
            </>}
          </div>
          {phase !== 'scan' && <button className="btn btn-primary w-full mt-3" onClick={run}>{phase === 'done' ? 'Scan again' : 'Match database'}</button>}
          {phase === 'scan' && <div className="mt-3 text-[12px] font-mono text-steel-d">ANALYSING…</div>}
        </div>

        <div>
          {phase === 'idle' && <div className="card p-10 text-center paper-bg">
            <div className="text-lg font-medium mb-1">Match against the Convicted Felons register</div>
            <p className="text-mute text-sm max-w-md mx-auto">The reconstruction is compared feature by feature with all {FELONS.length} records on file. Press <b>Match database</b> to start the scan.</p></div>}

          {phase === 'scan' && <div className="card p-5 fade">
            <div className="grid sm:grid-cols-[1fr_170px] gap-5">
              <ol className="space-y-2.5">
                {STAGES.map((s, i) => <li key={s} className={`flex items-center gap-2.5 text-[13px] ${i > stage ? 'text-mute' : ''}`}>
                  <span className={`w-5 h-5 rounded-full grid place-items-center text-[10px] ${i < stage ? 'bg-ok text-white' : i === stage ? 'bg-steel text-white animate-pulse' : 'bg-line2'}`}>{i < stage ? '✓' : i + 1}</span>{s}</li>)}
                <li className="pt-2"><div className="h-1.5 rounded bg-line2 overflow-hidden"><div className="h-full bg-steel transition-all duration-700" style={{ width: `${(stage / STAGES.length) * 100}%` }} /></div></li>
              </ol>
              <div className="text-center">
                <div className="label mb-1">Comparing record</div>
                <div className="relative rounded overflow-hidden border border-line">
                  <FelonFace f={FELONS[cmp]} faces={faces} className="w-full aspect-[4/5]" />
                  <div className="scanline" />
                </div>
                <div className="font-mono text-[11px] mt-1 text-steel-d">{FELONS[cmp].id}</div>
                <div className="font-mono text-[10.5px] text-mute">score {(40 + ((cmp * 37) % 55)).toFixed(1)}%</div>
              </div>
            </div>
          </div>}

          {phase === 'done' && <div className="fade">
            <div className="card overflow-hidden mb-5">
              <div className="flex items-center justify-between px-5 py-3 border-b border-line bg-[#f6f6f3]">
                <div className="label">Best match in register</div>
                <span className={`text-[11px] font-bold tracking-wider px-2.5 py-1 rounded ${tone(top.pct)[1]}`}>{tone(top.pct)[0]}</span>
              </div>
              <div className="grid sm:grid-cols-[150px_150px_1fr] gap-5 p-5 items-start">
                <div><img src={final} className="w-full aspect-[4/5] object-cover object-top rounded border border-line" /><div className="text-[11px] text-mute mt-1 text-center">Reconstruction</div></div>
                <div><FelonFace f={top.f} faces={faces} className="w-full aspect-[4/5] rounded border border-line" /><div className="text-[11px] text-mute mt-1 text-center font-mono">{top.f.id}</div></div>
                <div>
                  <div className="text-[34px] font-semibold leading-none text-warn">{top.pct.toFixed(1)}%</div>
                  <div className="text-[12px] text-mute mb-3">match accuracy</div>
                  <div className="text-[16px] font-semibold">{top.f.name} <span className="text-mute font-normal text-[13px]">{top.f.alias !== '—' && top.f.alias}</span></div>
                  <div className="text-[13px] text-graphite">{top.f.crime} · {top.f.age} yrs · Blood {top.f.blood}</div>
                  <div className="text-[12px] text-mute mb-3">{top.f.status}</div>
                  <div className="flex flex-wrap gap-1 mb-3">{top.feats.map(x => <span key={x.k} className={`text-[10px] px-1.5 py-0.5 rounded ${x.ok ? 'bg-[#e4f0e9] text-ok' : 'bg-warn-l text-warn'}`}>{x.ok ? '+' : '−'} {x.k.replace('_', ' ')}</span>)}</div>
                  <div className="flex items-center gap-3"><Fingerprint seed={top.f.seed} size={44} /><button className="btn btn-ghost" onClick={() => setOpen(top.f)}>Open full record</button></div>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="label px-4 pt-3 pb-2">Other candidates</div>
              {results.slice(1, 8).map(r => (
                <button key={r.f.id} onClick={() => setOpen(r.f)} className="w-full flex items-center gap-3 px-4 py-2 border-t border-line2 hover:bg-[#f6f6f3] text-left">
                  <FelonFace f={r.f} faces={faces} className="w-10 h-12 rounded" />
                  <div className="flex-1 min-w-0"><div className="text-[13px] font-medium truncate">{r.f.name}</div><div className="text-[11px] text-mute">{r.f.id} · {r.f.crime}</div></div>
                  <div className="w-32 hidden sm:block"><div className="h-1.5 rounded bg-line2"><div className="h-full rounded bg-steel" style={{ width: `${r.pct}%` }} /></div></div>
                  <div className="font-mono text-[13px] w-14 text-right">{r.pct.toFixed(1)}%</div>
                </button>
              ))}
            </div>
            <p className="text-[11.5px] text-mute mt-3">Similarity scores support an investigation; they do not establish identity on their own.</p>
          </div>}
        </div>
      </div>
      {open && <FelonDetail f={open} faces={faces} onClose={() => setOpen(null)} />}
    </div>
  )
}
