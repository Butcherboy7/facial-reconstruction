import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import type { Question } from '../api'
import { Thumb } from '../sketch'
import FaceViewer from '../studio/FaceViewer'
import { renderThumbs, renderJobs } from '../studio/render'
import type { Frame } from '../studio/render'
import { generateVersion } from '../studio/actions'
import type { Ctx } from '../pages/Case'
import { Check, ArrowLeft, ArrowRight, Scan } from '../icons'

const GEN_STAGES = ['Reading the witness description…', 'Shaping the 3D face…', 'Saving the face to the case…']

const FRAME: Record<string, Frame> = { face_shape: 'head', hair_style: 'head', beard: 'lower', eyebrows: 'eyes', eyes: 'eyes', nose: 'nose', mouth: 'mouth' }

function useThumbs(q: Question, profile: Record<string, any>) {
  const [t, setT] = useState<Record<string, string>>({})
  const sig = [q.key, profile.sex, profile.skin, profile.hair_color, profile.eye_color, profile.hair_style && q.key !== 'hair_style' ? profile.hair_style : '', q.key === 'beard' ? '' : profile.beard].join('|')
  useEffect(() => {
    if (q.kind !== 'sketch') return
    let on = true
    const ids = q.options!.map(o => o.id)
    renderThumbs({ ...profile, marks: [], glasses: 'none' }, q.key, ids, FRAME[q.key] || 'head').then(imgs => { if (on) setT(Object.fromEntries(ids.map((id, i) => [id, imgs[i]]))) }).catch(() => {})
    return () => { on = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig])
  return t
}

function SketchGrid({ q, profile, schema, val, set }: { q: Question; profile: Record<string, any>; schema: any; val: any; set: (k: string, v: any) => void }) {
  const thumbs = useThumbs(q, profile)
  const box = q.key === 'face_shape' || q.key === 'hair_style' ? 'aspect-[4/5]' : q.key === 'nose' || q.key === 'mouth' ? 'aspect-[3/2]' : q.key === 'beard' ? 'aspect-[5/4]' : 'aspect-[2/1]'
  return (
    <div className={`grid gap-3 stagger ${box === 'aspect-[2/1]' ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'}`}>
      {q.options!.map(o => (
        <button key={o.id} className="opt" data-on={val === o.id} onClick={() => set(q.key, o.id)}>
          <div className={`bg-[#faf9f6] ${box}`}>
            {thumbs[o.id] ? <img src={thumbs[o.id]} className="w-full h-full object-cover" alt={o.label} /> : <div className="p-1.5 h-full"><Thumb q={q} opt={o} profile={profile} schema={schema} /></div>}
          </div>
          <div className="px-3 py-2 text-[12.5px] font-medium border-t border-line2">{o.label}</div>
        </button>
      ))}
    </div>
  )
}

export default function Interview({ ctx }: { ctx: Ctx }) {
  const { schema, profile, setProfile, id } = ctx
  const [stepIdx, setStepIdx] = useState(() => Number(new URLSearchParams(location.search).get('step') || 0))
  const [busy, setBusy] = useState(false)
  const [stage, setStage] = useState(0)
  const [err, setErr] = useState('')
  const [view, setView] = useState('Front')
  const [photo, setPhoto] = useState<string | null>(null)
  const [photoOn, setPhotoOn] = useState(false)
  useEffect(() => { api.status().then(s => setPhotoOn(!!s.photoreal)).catch(() => {}) }, [])
  const [pBusy, setPBusy] = useState(false)
  const [pErr, setPErr] = useState('')
  const previewPhoto = async () => {
    setPBusy(true); setPErr('')
    try { const [img] = await renderJobs([{ profile }]); setPhoto((await api.previewPhoto({ profile, image: img })).image) }
    catch (e: any) { setPErr(e.message) } finally { setPBusy(false) }
  }
  const saveT = useRef<any>(null)
  const step = schema.steps[Math.min(stepIdx, schema.steps.length - 1)]
  useEffect(() => { if (stepIdx > schema.steps.length - 1) setStepIdx(schema.steps.length - 1) }, [stepIdx, schema.steps.length])

  const stepDone = (i: number) => schema.steps[i].questions.every(q => !schema.required.includes(q.key) || profile[q.key])
  const answered = (i: number) => schema.steps[i].questions.some(q => profile[q.key] && (q.key !== 'age' || true))
  const reqLeft = schema.required.filter(k => !profile[k])
  const missingSteps = schema.steps.map((st, i) => (st.questions.some(q => reqLeft.includes(q.key)) ? i : -1)).filter(i => i >= 0)

  useEffect(() => { // autosave profile (debounced)
    clearTimeout(saveT.current)
    saveT.current = setTimeout(() => { api.saveProfile(id, profile).catch(() => {}) }, 600)
    return () => clearTimeout(saveT.current)
  }, [profile, id])

  const set = (k: string, v: any) => setProfile({ ...profile, [k]: v })
  const toggle = (k: string, v: string) => {
    const cur: string[] = profile[k] || []
    setProfile({ ...profile, [k]: cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v] })
  }

  const generate = async () => {
    setBusy(true); setErr(''); setStage(0)
    const tick = setInterval(() => setStage(s => Math.min(s + 1, GEN_STAGES.length - 1)), 900)
    try {
      const [v] = await Promise.all([generateVersion(id, profile), new Promise(res => setTimeout(res, 1500))])
      await api.select(id, v.id, 0)
      await ctx.reload(); ctx.go('analyze')
    } catch (e: any) { setErr(e.message) } finally { clearInterval(tick); setBusy(false) }
  }

  const renderQ = (q: Question) => {
    const val = profile[q.key]
    return (
      <section key={q.key} className="mb-7">
        <h3 className="text-[15px] font-semibold mb-3">{q.q}</h3>
        {q.kind === 'sketch' && <SketchGrid q={q} profile={profile} schema={schema} val={val} set={set} />}
        {q.kind === 'chips' && <div className="flex flex-wrap gap-2">{q.options!.map(o => <button key={o.id} className="chip" data-on={val === o.id} onClick={() => set(q.key, o.id)}>{o.label}</button>)}</div>}
        {q.kind === 'swatch' && (
          <div className="flex flex-wrap gap-3">
            {q.options!.map(o => (
              <button key={o.id} onClick={() => set(q.key, o.id)} className="flex flex-col items-center gap-1.5 group">
                <span className="w-11 h-11 rounded-full border-2 transition-all" style={{ background: o.p.c as string, borderColor: val === o.id ? '#3d5f7f' : '#dcdedf', boxShadow: val === o.id ? '0 0 0 3px #e6edf3' : 'none' }} />
                <span className="text-[11.5px] text-graphite">{o.label}</span>
              </button>
            ))}
          </div>
        )}
        {q.kind === 'multi' && <div className="flex flex-wrap gap-2">{q.options!.map(o => <button key={o.id} className="chip" data-on={(val || []).includes(o.id)} onClick={() => toggle(q.key, o.id)}>{o.label}</button>)}</div>}
        {q.kind === 'age' && (
          <div className="card p-4">
            <div className="flex items-baseline justify-between mb-2"><span className="text-[28px] font-semibold tabular-nums">{profile.age ?? 35}</span><span className="text-[12px] text-mute">years · witness estimate</span></div>
            <input type="range" min={14} max={80} value={profile.age ?? 35} onChange={e => set('age', +e.target.value)} className="w-full accent-[#3d5f7f]" />
            <div className="flex justify-between text-[11px] text-mute"><span>14</span><span>80</span></div>
          </div>
        )}
      </section>
    )
  }

  if (busy) return (
    <div className="card max-w-xl mx-auto mt-10 p-10 text-center fade">
      <div className="label mb-4">AI reconstruction</div>
      <div className="mx-auto w-16 h-16 rounded-full border-[3px] border-line border-t-steel animate-spin mb-6" />
      <div className="space-y-2.5 text-left max-w-xs mx-auto">
        {GEN_STAGES.map((s, i) => (
          <div key={s} className={`flex items-center gap-3 text-[14px] ${i <= stage ? 'text-ink' : 'text-line'}`}>
            <span className={`w-5 h-5 rounded-full grid place-items-center text-[11px] ${i < stage ? 'bg-ok text-white' : i === stage ? 'bg-steel text-white' : 'bg-line2'}`}>{i < stage ? '✓' : ''}</span>{s}
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[230px_minmax(0,1fr)_minmax(0,460px)] gap-6 items-start">
      {/* left: characteristic steps */}
      <aside className="card p-3 lg:sticky lg:top-4">
        <div className="label px-2 pt-1 pb-2">Facial characteristics</div>
        <div className="flex lg:block gap-1 overflow-x-auto">
        {schema.steps.map((s, i) => (
          <button key={s.id} onClick={() => setStepIdx(i)} className={`shrink-0 lg:w-full flex items-center gap-3 px-2.5 h-10 rounded-md text-[13.5px] text-left transition-colors ${i === stepIdx ? 'bg-steel-l text-steel-d font-semibold' : 'hover:bg-[#f4f4f1]'}`}>
            <span className={`w-[18px] h-[18px] rounded-full grid place-items-center text-[10px] ${stepDone(i) && answered(i) ? 'bg-ok text-white' : i === stepIdx ? 'bg-steel' : 'border border-line'}`}>{stepDone(i) && answered(i) ? <Check size={11} /> : missingSteps.includes(i) ? <span className="w-1.5 h-1.5 rounded-full bg-warn" /> : ''}</span>
            {s.title}
          </button>
        ))}
        </div>
        <div className="hidden lg:block mt-3 pt-3 border-t border-line2 px-2 text-[11.5px] text-mute leading-relaxed">
          Each picture is the 3D model with that choice applied. Pick the one closest to what the witness remembers.
        </div>
      </aside>

      {/* center: live preview */}
      <section className="lg:sticky lg:top-4">
        <div className="card p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="text-[14px] font-semibold">Live face preview</div>
            <div className="flex gap-1">{['Front', 'Left 3/4', 'Right 3/4'].map(v => <button key={v} className="chip !h-7 !px-2.5 !text-[11.5px]" data-on={view === v} onClick={() => setView(v)}>{v.replace(' 3/4', ' ¾')}</button>)}</div>
          </div>
          <div className="relative">
            <FaceViewer profile={profile} view={view} className="rounded-lg border border-line2 overflow-hidden h-[440px] sm:h-[500px]" />
            {photo && (
              <div className="absolute inset-0 rounded-lg overflow-hidden border border-line2 bg-white fade">
                <img src={photo} className="w-full h-full object-contain" alt="Photo-real preview" />
                <span className="absolute top-2 left-2 bg-ink/80 text-white text-[11px] font-semibold px-2 py-0.5 rounded">PHOTO-REAL PREVIEW</span>
                <button className="absolute top-2 right-2 btn btn-ghost !h-8 !text-[12px] bg-white" onClick={() => setPhoto(null)}>Back to 3D</button>
              </div>
            )}
          </div>
          {photoOn && <div className="mt-3 flex flex-wrap items-center gap-3">
            <button className="btn btn-ghost !h-9" disabled={pBusy} onClick={previewPhoto}>{pBusy ? 'Making photo…' : 'Preview as photo'}</button>
            <span className="text-[11.5px] text-mute">Redraws the current face as a photograph (takes a few seconds).</span>
            {pErr && <span className="text-[12px] text-warn">{pErr}</span>}
          </div>}
          <p className="text-[11.5px] text-mute mt-2">Live 3D face. It updates with every answer; drag to turn the head.</p>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {Object.entries(profile).filter(([k, v]) => v && !(Array.isArray(v) && !v.length) && k !== 'age').slice(0, 14).map(([k, v]) => (
              <span key={k} className="text-[11px] px-2 py-0.5 rounded bg-[#f1f1ee] text-graphite"><span className="text-mute">{k.replace('_', ' ')}:</span> {Array.isArray(v) ? v.length + ' marks' : String(v).replace('_', ' ')}</span>
            ))}
          </div>
        </div>
        <button className="btn btn-primary w-full mt-4 h-12 text-[14px]" disabled={reqLeft.length > 0} onClick={generate}>
          <Scan size={17} /> SAVE FACE &amp; CONTINUE
        </button>
        {reqLeft.length > 0
          ? <div className="mt-3 rounded-lg bg-warn-l text-warn text-[12.5px] p-3 leading-relaxed">
              <b>{reqLeft.length} required answer{reqLeft.length > 1 ? 's' : ''} missing before the face can be saved.</b> Go to:{' '}
              {missingSteps.map(i => <button key={i} className="underline font-semibold mr-3" onClick={() => setStepIdx(i)}>{schema.steps[i].title}</button>)}
            </div>
          : <p className="text-[12px] text-mute mt-2 text-center">Saves this face to the case. You can come back and change the description any time.</p>}
        {err && <p className="text-[12px] text-warn mt-2">{err}</p>}
      </section>

      {/* right: current feature */}
      <section className="card p-5">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-baseline gap-3"><h2 className="text-[19px] font-semibold">{step.title}</h2><span className="text-[12px] text-mute tabular">{stepIdx + 1} / {schema.steps.length}</span></div>
          <div className="flex gap-2">
            <button className="btn btn-ghost !h-9 !px-3" disabled={stepIdx === 0} onClick={() => setStepIdx(stepIdx - 1)} aria-label="Previous step"><ArrowLeft /></button>
            {stepIdx < schema.steps.length - 1
              ? <button className="btn btn-primary !h-9 !px-4" onClick={() => setStepIdx(stepIdx + 1)}>Next <ArrowRight /></button>
              : reqLeft.length === 0
                ? <button className="btn btn-primary !h-9 !px-4" onClick={generate}>Save face <ArrowRight /></button>
                : <button className="btn btn-primary !h-9 !px-4" onClick={() => setStepIdx(missingSteps[0])}>Finish missing <ArrowRight /></button>}
          </div>
        </div>
        <div className="lg:max-h-[calc(100vh-260px)] lg:overflow-y-auto pr-1">{step.questions.map(renderQ)}</div>
      </section>
    </div>
  )
}
