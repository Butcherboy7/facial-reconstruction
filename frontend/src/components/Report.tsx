import { DISCLAIMER } from '../App'
import type { Ctx } from '../pages/Case'
import { Print } from '../icons'

export default function Report({ ctx }: { ctx: Ctx }) {
  const { data, schema } = ctx
  const c = data.case, prof = c.profile || {}
  const v = [...data.versions].reverse().find((x: any) => x.selected !== null) || data.versions.at(-1)
  const of = (k: string) => data.assets.filter((a: any) => a.kind === k)
  const q = (k: string) => schema.steps.flatMap(s => s.questions).find(x => x.key === k)
  const val = (k: string, x: any) => Array.isArray(x) ? x.map(i => q(k)?.options?.find(o => o.id === i)?.label ?? i).join(', ') || '—' : (q(k)?.options?.find(o => o.id === x)?.label ?? String(x ?? '—'))
  const rows = schema.steps.flatMap(s => s.questions).filter(x => prof[x.key] !== undefined && prof[x.key] !== null && !(Array.isArray(prof[x.key]) && !prof[x.key].length))
  const s = data.search

  const H = ({ children }: { children: React.ReactNode }) => <h3 className="label !text-graphite border-b border-line pb-1.5 mb-3 mt-7">{children}</h3>
  return (
    <div>
      <div className="noprint flex justify-between items-center mb-4"><div className="text-[13px] text-mute">Print or save as PDF from your browser's print dialog.</div><button className="btn btn-primary" onClick={() => window.print()}><Print /> Print / Save PDF</button></div>
      <div className="card p-5 sm:p-10 max-w-4xl mx-auto bg-white">
        <div className="flex justify-between items-start border-b-2 border-ink pb-4">
          <div><h1 className="text-2xl font-semibold">Case report: {c.name}</h1><p className="text-[12px] text-mute mt-1">Academic prototype · AI-assisted approximation</p></div>
          <div className="text-right text-[12px] text-mute"><div className="font-mono text-steel-d text-sm">{c.id}</div><div>Generated {new Date().toLocaleString()}</div></div>
        </div>

        <H>Case details</H>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-[13px]">
          {[['Incident type', c.incident_type], ['Date', c.date], ['Location', c.location], ['Investigator', c.investigator]].map(([a, b]) => <div key={a} className="flex gap-3"><dt className="w-28 text-mute">{a}</dt><dd>{b || '—'}</dd></div>)}
          <div className="col-span-2 flex gap-3"><dt className="w-28 text-mute shrink-0">Description</dt><dd>{c.description || '—'}</dd></div>
          <div className="col-span-2 flex gap-3"><dt className="w-28 text-mute shrink-0">Notes</dt><dd>{c.notes || '—'}</dd></div>
        </dl>

        <H>Witness facial profile</H>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1.5 text-[12.5px]">
          {rows.map(r => <div key={r.key} className="flex justify-between border-b border-line2 py-1"><span className="text-mute">{r.key.replace(/_/g, ' ')}</span><span className="font-medium text-right">{r.key === 'age' ? `~${prof.age}` : val(r.key, prof[r.key])}</span></div>)}
        </div>
        {v && <p className="text-[12px] text-graphite mt-3 leading-relaxed"><b>Generation prompt:</b> {v.prompt}</p>}

        {v && v.candidates.length > 1 && <>
        <H>Reconstruction candidates {`(Version ${String(v.n).padStart(2, '0')}, ${v.mode.toUpperCase()} mode)`}</H>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{v?.candidates.map((x: any, i: number) => <div key={i} className={`${v.selected === i ? 'ring-2 ring-steel' : ''} rounded`}><img src={x.url} className="w-full aspect-[4/5] object-cover object-top rounded" /><div className="text-[11px] mt-1 text-mute">Candidate {'ABCDE'[i]}{v.selected === i ? ' · selected' : ''}</div></div>)}</div>
        </>}

        {c.final_image && <><H>Selected reconstruction &amp; pencil sketch</H>
          <div className="grid grid-cols-2 gap-4 max-w-xl"><img src={c.final_image} className="rounded aspect-[4/5] object-cover object-top w-full" />{of('sketch').at(-1) ? <img src={of('sketch').at(-1).url} className="rounded aspect-[4/5] object-cover object-top w-full" /> : <div className="aspect-square bg-[#f6f6f3] grid place-items-center text-xs text-mute rounded">Sketch not generated</div>}</div></>}

        <H>3D model</H>
        <p className="text-[12.5px] text-graphite">Interactive 3D face model — viewable from any angle in the Sketch · 3D · Age tab. Stylised approximation; not a scan.</p>

        {of('age').length > 0 && <><H>Age variations — AI-assisted approximate age visualization (witness estimate: {prof.age})</H>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">{[...of('age')].sort((a, b) => a.meta.age - b.meta.age).map((a: any) => <div key={a.id}><img src={a.url} className="w-full aspect-[4/5] object-cover object-top rounded" /><div className="text-[11px] text-center text-mute">{a.meta.age}</div></div>)}</div></>}

        {of('variation').length > 0 && <><H>Appearance variations</H>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">{of('variation').map((a: any) => <div key={a.id}><img src={a.url} className="w-full aspect-[4/5] object-cover object-top rounded" /><div className="text-[11px] text-center text-mute">{a.label}</div></div>)}</div></>}

        <H>Reference database search</H>
        {s ? <>
          <p className="text-[12.5px] text-graphite mb-3">Database: 18 synthetic reference faces (demo data; no real records). Model: SFace embeddings with YuNet detection, cosine similarity. Query: <span className="font-mono">{s.query_path}</span></p>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">{s.results.slice(0, 5).map((r: any) => <div key={r.id}><img src={r.url} className="w-full aspect-square object-cover rounded" /><div className="text-[11px] mt-1"><span className="font-mono">#{r.rank} {r.id}</span></div><div className="text-[12px] font-semibold tabular-nums">{r.similarity.toFixed(3)}</div></div>)}</div>
          <p className="text-[11.5px] text-mute mt-2">Potential reference matches only. Similarity score represents model output and does not establish identity.</p>
        </> : <p className="text-[12.5px] text-mute">No search run.</p>}

        <H>System limitations</H>
        <ul className="text-[12px] text-graphite leading-relaxed list-disc pl-5 space-y-1">
          <li>A witness description is uncertain; generated faces are computational approximations, not reproductions of an actual person.</li>
          <li>Faces are rendered by an in-browser 3D character model driven by the witness answers; they are stylised approximations, not photographs.</li>
          <li>The 3D face is a stylised model reshaped by the witness answers (head scan by Lee Perry-Smith, CC BY 3.0). Age and appearance variations are rendered from the same model and are approximations only.</li>
          <li>Similarity scores are raw model output on a tiny synthetic reference set and carry no forensic evidential value.</li>
        </ul>
        <p className="text-[11px] text-mute mt-6 pt-3 border-t border-line leading-relaxed">{DISCLAIMER}</p>
      </div>
    </div>
  )
}
