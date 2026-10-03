import { useState } from 'react'
import { api } from '../api'
import { Badge } from '../App'
import type { Ctx } from '../pages/Case'
import FaceViewer, { VIEWS } from '../studio/FaceViewer'
import { finalOf, renderAssets, VARIATIONS } from '../studio/actions'
import { ArrowRight, Rotate } from '../icons'

const AGES = [25, 30, 35, 40, 45, 50, 55]
const VARS = Object.entries(VARIATIONS).map(([k, v]) => [k, v.label])
const SUB = [['sketch', 'Forensic sketch'], ['3d', '3D reconstruction'], ['age', 'Age simulation'], ['var', 'Appearance variations']]

export default function Analyze({ ctx }: { ctx: Ctx }) {
  const { data, id } = ctx
  const [sub, setSub] = useState(() => new URLSearchParams(location.search).get('sub') || 'sketch')
  const [busy, setBusy] = useState('')
  const [view, setView] = useState('Front')
  const [auto, setAuto] = useState(true)
  const final = data.case.final_image
  const assets: any[] = data.assets
  const of = (k: string) => assets.filter(a => a.kind === k)
  const witnessAge = data.case.profile.age ?? 35

  if (!final) return (
    <div className="card p-14 text-center paper-bg"><div className="text-lg font-medium mb-1">Select a reconstruction first</div>
      <button className="btn btn-primary mt-3" onClick={() => ctx.go('reconstruct')}>Go to candidates</button></div>
  )
  const run = async (name: string, fn: () => Promise<any>) => { setBusy(name); try { await fn(); await ctx.reload() } catch (e: any) { alert(e.message) } finally { setBusy('') } }
  const useFor = (path: string) => run('final', () => api.setFinal(id, path))
  const isFinal = (u: string) => final === u
  const sk = of('sketch').at(-1)
  const fin = finalOf(data)

  const Card = ({ a, tag }: { a: any; tag?: string }) => (
    <div className={`card overflow-hidden ${isFinal(a.url) ? 'ring-2 ring-steel' : ''}`}>
      <img src={a.url} className="w-full aspect-[4/5] object-cover object-top" />
      <div className="p-2.5 flex items-center justify-between gap-2">
        <div className="text-[12.5px] font-medium">{tag || a.label}</div>
        {isFinal(a.url) ? <Badge tone="steel">Search image</Badge> : <button className="text-[11.5px] text-steel-d hover:underline" onClick={() => useFor(a.url)}>Use for search</button>}
      </div>
    </div>
  )

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4 mb-5">
        <img src={final} className="w-14 h-14 rounded-lg object-cover border border-line" />
        <div className="flex-1"><div className="label">Working reconstruction</div><div className="text-[13px] text-graphite">All outputs below derive from this face. The image marked <b>Search image</b> is used in the reference search.</div></div>
        <button className="btn btn-ghost" onClick={() => ctx.go('search')}>Continue to reference search <ArrowRight /></button>
      </div>
      <div className="flex gap-1 mb-5 border-b border-line overflow-x-auto">
        {SUB.map(([k, l]) => <button key={k} onClick={() => setSub(k)} className={`px-4 h-10 shrink-0 text-[13px] font-medium border-b-2 -mb-px ${sub === k ? 'border-steel text-ink' : 'border-transparent text-mute hover:text-ink'}`}>{l}</button>)}
      </div>

      {sub === 'sketch' && (
        <div className="fade">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-4xl">
            <div className="card overflow-hidden"><img src={final} className="w-full aspect-[4/5] object-cover object-top" /><div className="p-3 label">AI reconstruction</div></div>
            <div className="card overflow-hidden">{sk ? <img src={sk.url} className="w-full aspect-[4/5] object-cover object-top" /> : <div className="aspect-square grid place-items-center paper-bg text-mute text-sm">No sketch generated yet</div>}<div className="p-3 flex items-center justify-between"><span className="label">Forensic pencil sketch</span>
              <button className="btn btn-primary !h-8 !text-[12px]" disabled={!!busy} onClick={() => run('sketch', () => api.sketch(id))}>{busy === 'sketch' ? 'Rendering…' : sk ? 'Regenerate' : 'Generate sketch'}</button></div></div>
          </div>
          <p className="text-[12px] text-mute mt-3 max-w-3xl">The sketch is made by a tonal dodge-blend and edge pass over the reconstruction, so it keeps the same facial structure. It is image processing, not a hand-drawn composite.</p>
        </div>
      )}

      {sub === '3d' && fin && (
        <div className="fade grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-6">
          <div className="card overflow-hidden relative h-[440px] lg:h-[580px]">
            <FaceViewer profile={fin.profile} seed={fin.seed} jitter={fin.jitter} view={view} auto={auto} className="absolute inset-0" />
            <div className="absolute top-3 left-3"><Badge tone="steel">LIVE 3D MODEL · FULL 360°</Badge></div>
            <div className="absolute bottom-3 left-3 text-[11px] text-graphite">Drag to rotate · scroll to zoom</div>
          </div>
          <div className="space-y-4">
            <div className="card p-4"><div className="label mb-3">View</div>
              <div className="grid grid-cols-3 gap-2">{Object.keys(VIEWS).map(v => <button key={v} className="chip !h-9 !px-0 !text-[12px]" data-on={view === v && !auto} onClick={() => { setAuto(false); setView(v) }}>{v.replace(' 3/4', ' ¾')}</button>)}</div>
              <button className="chip w-full mt-3 inline-flex items-center justify-center gap-2" data-on={auto} onClick={() => setAuto(a => !a)}><Rotate size={15} /> Auto-rotate 360°</button></div>
            <div className="card p-4 text-[12px] text-graphite leading-relaxed space-y-2">
              <div className="label">What you are looking at</div>
              <p>A real 3D head. Every facial feature you chose reshapes the mesh and its paint, so the side and back of the head exist and can be viewed from any angle.</p>
              <p className="text-mute">It is a stylised approximation built from the description. It is not a scan of any person.</p></div>
          </div>
        </div>
      )}

      {sub === 'age' && (
        <div className="fade">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div><Badge tone="warn">APPROXIMATE AGE VISUALISATION</Badge><p className="text-[12.5px] text-mute mt-2">Witness estimate: <b className="text-ink">{witnessAge}</b> (kept separate from simulated ages). Not a biological age prediction.</p></div>
            <button className="btn btn-primary" disabled={!!busy} onClick={() => run('age', () => renderAssets(id, fin!, AGES.filter(a => a !== witnessAge).map(a => ({ kind: 'age', label: `Age ${a}`, profile: { ...fin!.profile, age: a }, meta: { age: a, witness_estimate: witnessAge } }))))}>{busy === 'age' ? 'Simulating…' : 'Generate 25 – 55'}</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 stagger">
            <div className="card overflow-hidden ring-1 ring-line"><img src={final} className="w-full aspect-[4/5] object-cover object-top" /><div className="p-2.5 text-[12.5px] font-medium">Witness estimate · {witnessAge}</div></div>
            {[...of('age')].sort((a, b) => a.meta.age - b.meta.age || b.id - a.id).filter((a, i, arr) => i === 0 || arr[i - 1].meta.age !== a.meta.age).map(a => <Card key={a.id} a={a} tag={`Simulated · ${a.meta.age} ${a.meta.age < witnessAge ? '(regression)' : '(progression)'}`} />)}
          </div>
        </div>
      )}

      {sub === 'var' && (
        <div className="fade">
          <div className="flex flex-wrap items-center gap-2 mb-4"><span className="label mr-2">Generate</span>
            {VARS.map(([k, l]) => <button key={k} className="chip" disabled={!!busy} onClick={() => run('var', () => renderAssets(id, fin!, [{ kind: 'variation', label: VARIATIONS[k].label, profile: VARIATIONS[k].change(fin!.profile), meta: { variation: k } }]))}>{busy === 'var' ? '…' : '+ ' + l}</button>)}</div>
          <p className="text-[12px] text-mute mb-4">Each variation changes only the stated trait on the same 3D face; the underlying face structure stays identical.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 stagger">{of('variation').map(a => <Card key={a.id} a={a} />)}</div>
          {!of('variation').length && <div className="card p-10 text-center text-mute text-sm paper-bg">No variations yet.</div>}
        </div>
      )}
    </div>
  )
}
