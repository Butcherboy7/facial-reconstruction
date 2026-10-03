import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { Badge } from '../App'
import { ArrowRight, Plus } from '../icons'
import FaceViewer from '../studio/FaceViewer'

const SAMPLE = { sex: 'male', age: 34, skin: 'medium', face_shape: 'square', hair_style: 'short', hair_color: 'dark_brown', eyebrows: 'thick_straight', eyes: 'almond', eye_color: 'brown', nose: 'straight', mouth: 'medium', jaw: 'strong', beard: 'stubble' }

const FLOW = [
  ['Describe', 'Answer simple questions about the person: face shape, hair, eyes, skin tone and more. The 3D face on screen changes with every answer, then you save it.'],
  ['Explore', 'Turn the head in 3D, make a pencil sketch, see how the person may look at other ages, or with a beard or glasses.'],
  ['Compare', 'Run the chosen face against a reference set. A model scores how alike each stored face is.'],
  ['Report', 'Get a printable case report with every step, version and the limits of the method.'],
]

export default function Home() {
  const nav = useNavigate()
  const [cases, setCases] = useState<any[]>([])
  useEffect(() => { api.cases().then(setCases).catch(() => {}) }, [])
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <section className="grid grid-cols-1 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] gap-8 items-center">
        <div>
          <h1 className="text-[34px] sm:text-[44px] leading-[1.05] font-semibold tracking-tight">Describe a face.<br />See it. Compare it.</h1>
          <p className="text-[16px] text-graphite mt-5 max-w-lg leading-relaxed">A witness describes a person. This workstation turns the description into a 3D face you can turn, sketch, age and compare against a reference set.</p>
          <div className="flex flex-wrap gap-3 mt-7">
            <button className="btn btn-primary h-12 px-6 text-[14px]" onClick={() => nav('/cases?new=1')}><Plus /> Start a new case</button>
            <Link to="/cases" className="btn btn-ghost h-12 px-5 text-[14px]">Open existing cases</Link>
          </div>
          <div className="flex flex-wrap gap-2 mt-6"><Badge tone="steel">Academic prototype</Badge><Badge tone="warn">Approximation, never an identification</Badge></div>
        </div>
        <div className="card overflow-hidden relative h-[340px] md:h-[420px]">
          <FaceViewer profile={SAMPLE} auto className="absolute inset-0" />
          <div className="absolute bottom-3 left-3 text-[11px] text-graphite bg-white/80 px-2 py-1 rounded">Sample 3D face · drag to turn</div>
        </div>
      </section>

      <section className="mt-14">
        <h2 className="text-[22px] font-semibold tracking-tight mb-1">How it works</h2>
        <p className="text-[13.5px] text-mute mb-5">Four steps. Each case page shows the same steps along the top, so you always know where you are.</p>
        <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 stagger">
          {FLOW.map(([t, d], i) => (
            <li key={t} className="card p-4">
              <span className="w-7 h-7 rounded-full bg-steel text-white text-[13px] font-semibold grid place-items-center mb-3">{i + 1}</span>
              <div className="text-[15px] font-semibold mb-1">{t}</div>
              <p className="text-[12.5px] text-graphite leading-relaxed">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      {cases.length > 0 && (
        <section className="mt-14">
          <div className="flex items-end justify-between mb-4"><h2 className="text-[22px] font-semibold tracking-tight">Recent cases</h2><Link to="/cases" className="text-[13px] text-steel-d hover:underline">All cases</Link></div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {cases.slice(0, 3).map(c => (
              <Link key={c.id} to={`/case/${c.id}`} className="card p-4 flex items-center gap-4 hover:shadow-md transition-shadow">
                {c.final_image ? <img src={c.final_image.startsWith('/') ? c.final_image : '/files/' + c.final_image} className="w-14 h-16 rounded object-cover object-top border border-line" /> : <div className="w-14 h-16 rounded bg-line2" />}
                <div className="min-w-0 flex-1"><div className="font-medium truncate">{c.name}</div><div className="font-mono text-[11.5px] text-steel-d">{c.id}</div><div className="text-[11.5px] text-mute">{c.final_image ? 'Face selected' : 'In progress'}</div></div>
                <ArrowRight size={16} />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
