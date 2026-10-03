import type { Opt, Profile, Question, Step } from './api'

export type Schema = { steps: Step[]; required: string[] }
export const lookup = (schema: Schema | null, key: string, id?: string): Opt | undefined =>
  schema?.steps.flatMap(s => s.questions).find(q => q.key === key)?.options?.find(o => o.id === id)

const INK = '#2b2f35'

// closed Catmull-Rom spline through points -> SVG path
function smooth(pts: [number, number][]) {
  const n = pts.length
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n]
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += `C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`
  }
  return d + 'Z'
}
const num = (v: any, d: number) => (typeof v === 'number' ? v : d)

export type Layer = 'face' | 'ears' | 'hair' | 'brows' | 'eyes' | 'nose' | 'mouth' | 'beard' | 'mustache' | 'sideburns' | 'marks' | 'glasses'
const ALL: Layer[] = ['hair', 'ears', 'face', 'sideburns', 'beard', 'mustache', 'nose', 'mouth', 'eyes', 'brows', 'marks', 'glasses']

export function FaceSketch({ profile, schema, layers = ALL, view = '0 0 200 270', tint = true, id = 'f' }:
  { profile: Profile; schema: Schema | null; layers?: Layer[]; view?: string; tint?: boolean; id?: string }) {
  const P = (k: string) => lookup(schema, k, profile[k])?.p || {}
  const fs = P('face_shape'), fh = P('forehead'), eyes = P('eyes'), sp = P('eye_spacing'), br = P('eyebrows')
  const nose = P('nose'), mouth = P('mouth'), ears = P('ears'), skin = lookup(schema, 'skin', profile.skin)?.p
  const hc = (lookup(schema, 'hair_color', profile.hair_color)?.p.c as string) || '#3b2a20'
  const top = num(fs.top, .8), mid = num(fs.mid, .88), jaw = num(fs.jaw, .6), len = num(fs.len, 1), chin = num(fs.chin, .5)
  const W = 68, topY = 36 - (num(fh.h, 1) - 1) * 14
  const jawK = { strong: 1.08, angular: 1.12, narrow: .88, soft: 1 }[profile.jaw as string] ?? 1
  const cheekK = { full: 1.06, hollow: .94, high_cheekbones: 1.03 }[profile.cheeks as string] ?? 1
  const wt = W * top, wm = W * mid * cheekK, wj = W * jaw * jawK
  const chinK = { projecting: 6, receding: -6, pointed: 0, cleft: 0 }[profile.chin as string] ?? 0
  const chinY = 196 + 40 * len + chinK, jawY = chinY - 30
  const cw = ((1 - chin) * wj * .6 + 7) * (profile.chin === 'pointed' ? .55 : 1)
  const R: [number, number][] = [[0, topY], [wt * .6, topY + 3], [wt, 78], [wm, 124], [wj, jawY], [wj * .88, chinY - 15], [Math.max(cw, wj * .42), chinY - 4], [0, chinY]]
  const pts: [number, number][] = [
    ...R.map(([x, y]) => [100 + x, y] as [number, number]),
    ...R.slice(1, -1).reverse().map(([x, y]) => [100 - x, y] as [number, number]),
  ]
  const faceD = smooth(pts)
  const has = (l: Layer) => layers.includes(l)
  const fill = skin ? (skin.c as string) : '#e9e3da'
  const eyeY = 120, eyeX = 25 * num(sp.s, 1)
  const hs = profile.hair_style
  const hOp = hc === '#c9a463' ? .6 : hc === '#9a9a9c' ? .55 : .9
  const noseL = num(nose.l, 1), noseW = num(nose.w, 1), noseBase = 156 + 12 * noseL, mY = 192 + (len - 1) * 14
  const clip = `${id}-clip`

  const Eye = (sx: number) => {
    const w = 11 * num(eyes.w, 1), h = 5.2 * num(eyes.h, 1), t = num(eyes.tilt, 0), lid = num(eyes.lid, 0)
    const cx = 100 + sx * eyeX
    return (
      <g key={sx} transform={`translate(${cx},${eyeY}) rotate(${sx * -t})`}>
        <path d={`M${-w},0Q0,${-h * 2.1} ${w},0Q0,${h * 1.6} ${-w},0Z`} fill="#fbfaf8" stroke={INK} strokeWidth="1.3" />
        <circle cx="0" cy="-0.4" r={Math.min(h * 1.05, 3.6)} fill={INK} />
        <circle cx="-1" cy="-1.2" r="0.9" fill="#fff" />
        <path d={`M${-w - 1},-1Q0,${-h * 2.5 - lid * 2} ${w + 1},-1`} fill="none" stroke={INK} strokeWidth={1.5 + lid * 1.4} strokeLinecap="round" />
        {lid > .5 && <path d={`M${-w},${-h * 2.2 - 3}Q0,${-h * 3.6 - 3} ${w},${-h * 2.2 - 3}`} fill="none" stroke={INK} strokeWidth=".8" opacity=".5" />}
      </g>
    )
  }
  const Brow = (sx: number) => {
    const t = num(br.t, 3), a = num(br.a, 1), cx = 100 + sx * eyeX
    return <path key={sx} d={`M${cx - 14},${eyeY - 19 + (sx < 0 ? a * .3 : 0)}Q${cx},${eyeY - 23 - a} ${cx + 15},${eyeY - 17 + (sx < 0 ? 0 : a * .3)}`}
      fill="none" stroke={hc === '#c9a463' ? '#8a7a55' : INK} strokeWidth={t} strokeLinecap="round" opacity=".85" />
  }
  const hook = num(nose.hook, 0), up = num(nose.up, 0)
  const noseEl = (
    <g fill="none" stroke={INK} strokeLinecap="round" strokeLinejoin="round">
      <path d={`M${100 - 5 - noseW},${eyeY + 6}Q${100 - 7 - noseW * 1.5 - hook * 2},${(eyeY + noseBase) / 2 + 4} ${100 - 9 * noseW},${noseBase - 4}`} strokeWidth="1.1" opacity=".75" />
      <path d={`M${100 + 5 + noseW},${eyeY + 6}Q${100 + 7 + noseW * 1.5 + hook * 2},${(eyeY + noseBase) / 2 + 4} ${100 + 9 * noseW},${noseBase - 4}`} strokeWidth="1.1" opacity=".5" />
      <path d={`M${100 - 10 * noseW},${noseBase - 5 - up * 3}Q${100 - 13 * noseW},${noseBase + 3 - up * 4} ${100 - 6 * noseW},${noseBase + 2 - up * 3}Q100,${noseBase + 5 - up * 5} ${100 + 6 * noseW},${noseBase + 2 - up * 3}Q${100 + 13 * noseW},${noseBase + 3 - up * 4} ${100 + 10 * noseW},${noseBase - 5 - up * 3}`} strokeWidth="1.5" />
      <ellipse cx={100 - 5 * noseW} cy={noseBase + 1 - up * 3} rx={2.6 * noseW} ry="1.5" fill={INK} stroke="none" opacity=".8" />
      <ellipse cx={100 + 5 * noseW} cy={noseBase + 1 - up * 3} rx={2.6 * noseW} ry="1.5" fill={INK} stroke="none" opacity=".8" />
      {hook > 0 && <path d={`M97,${eyeY + 14}q5,8 2,${noseBase - eyeY - 24}`} strokeWidth="1" opacity=".6" />}
    </g>
  )
  const mw = 20 * num(mouth.w, 1), up2 = num(mouth.up, 1), lo = num(mouth.lo, 1.3)
  const mouthEl = (
    <g>
      <path d={`M${100 - mw},${mY}Q${100 - mw / 2},${mY - up2 * 2.2 - 2} 100,${mY - 1 - up2 * 1.2}Q${100 + mw / 2},${mY - up2 * 2.2 - 2} ${100 + mw},${mY}Q${100 + mw / 2},${mY + lo * 2.4 + 2} 100,${mY + lo * 3.2 + 2}Q${100 - mw / 2},${mY + lo * 2.4 + 2} ${100 - mw},${mY}Z`} fill="#c9aaa0" fillOpacity=".5" stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
      <path d={`M${100 - mw + 1},${mY}Q100,${mY + 2.2} ${100 + mw - 1},${mY}`} fill="none" stroke={INK} strokeWidth="1.5" />
    </g>
  )

  const earS = num(ears.s, 1), earX = wm + 3
  const earEl = [-1, 1].map(s => (
    <path key={s} d={`M${100 + s * earX},${eyeY - 8}q${s * 13 * earS},-4 ${s * (profile.ears === 'protruding' ? 16 : 11) * earS},${18 * earS}q${-s},${20 * earS} ${s * -11 * earS},${24 * earS}`} fill={fill} stroke={INK} strokeWidth="1.2" />
  ))

  const hairBack = () => {
    if (!hs || hs === 'bald') return null
    if (hs === 'long') return <path d={`M${100 - wt - 8},${topY + 40}C${100 - wt - 14},${topY - 30} ${100 + wt + 14},${topY - 30} ${100 + wt + 8},${topY + 40}L${100 + wm + 14},235L${100 - wm - 14},235Z`} fill={hc} opacity={hOp} />
    if (hs === 'bun') return <circle cx="100" cy={topY - 14} r="15" fill={hc} opacity={hOp} />
    return null
  }
  const hairFront = () => {
    if (!hs || hs === 'bald') return null
    const t = topY, sx = wt + 7
    const hairProps = { fill: hc, fillOpacity: hOp, stroke: INK, strokeWidth: .9, strokeOpacity: .55, strokeLinejoin: 'round' as const }
    // outer silhouette (temple -> crown -> temple), inner hairline closes the shape
    const outer = (lift: number) => `M${100 - sx},112C${100 - sx - 5},${t - 4} ${100 - sx * .55},${t - 20 - lift} 100,${t - 19 - lift}C${100 + sx * .55},${t - 20 - lift} ${100 + sx + 5},${t - 4} ${100 + sx},112`
    const line = (f: number) => `L${100 + wt - 1},96C${100 + wt - 3},${t + 36} ${100 + wt * .5},${t + 24 + f} 100,${t + 24 + f}C${100 - wt * .5},${t + 24 + f} ${100 - wt + 3},${t + 36} ${100 - wt + 1},96Z`
    if (hs === 'buzz') return <path d={outer(-8) + line(-4)} {...hairProps} fillOpacity={.38} />
    if (hs === 'receding') return <path d={outer(0) + `L${100 + wt - 1},96C${100 + wt - 4},${t + 22} ${100 + wt * .62},${t + 8} ${100 + 14},${t + 6}C${100 + 6},${t + 22} ${100 - 6},${t + 22} ${100 - 14},${t + 6}C${100 - wt * .62},${t + 8} ${100 - wt + 4},${t + 22} ${100 - wt + 1},96Z`} {...hairProps} />
    if (hs === 'swept') return <path d={outer(2) + `L${100 + wt - 1},96C${100 + wt - 2},${t + 30} ${120},${t + 12} ${86},${t + 26}C${100 - wt * .7},${t + 38} ${100 - wt - 2},${t + 56} ${100 - wt + 1},96Z`} {...hairProps} />
    if (hs === 'curly') return <g {...hairProps}><path d={outer(4) + line(2)} />{Array.from({ length: 13 }).map((_, i) => { const a = Math.PI * (1.02 + i * 0.077); return <circle key={i} cx={100 + Math.cos(a) * (sx + 1)} cy={t + 52 + Math.sin(a) * (t + 16)} r={9} />})}</g>
    if (hs === 'long') return <g {...hairProps}><path d={outer(2) + line(4)} />
      <path d={`M${100 - sx},112L${100 - wm - 8},${chinY - 6}L${100 - wm + 3},${chinY - 8}L${100 - wt + 1},96Z`} /><path d={`M${100 + sx},112L${100 + wm + 8},${chinY - 6}L${100 + wm - 3},${chinY - 8}L${100 + wt - 1},96Z`} /></g>
    return <path d={outer(0) + line(2)} {...hairProps} />
  }

  const lowerFace = `M${100 - wm - 10},${mY - 46}Q${100 - wm * 0.55},${mY - 8} 100,${mY - 14}Q${100 + wm * 0.55},${mY - 8} ${100 + wm + 10},${mY - 46}L${100 + wm + 10},${chinY + 20}L${100 - wm - 10},${chinY + 20}Z`
  const beard = profile.beard, stub = beard === 'stubble'
  const beardEl = beard && beard !== 'none' && (
    <g clipPath={`url(#${clip})`}>
      {beard === 'goatee'
        ? <path d={`M${100 - 14},${mY + 6}Q100,${mY + 2} ${100 + 14},${mY + 6}L${100 + cw + 6},${chinY + 6}L${100 - cw - 6},${chinY + 6}Z`} fill={hc} opacity={hOp * .8} />
        : <path d={lowerFace} fill={stub ? `url(#${id}-stub)` : hc} opacity={stub ? .9 : beard === 'full' ? hOp : hOp * .65} />}
      {beard !== 'goatee' && <ellipse cx="100" cy={mY - 1} rx={mw + 5} ry="9" fill={fill} />}
    </g>
  )
  const must = profile.mustache
  const mx = must === 'handlebar' ? 28 : 21, my = must === 'handlebar' ? 3 : 6
  const mustEl = must && must !== 'none' && (must === 'thin'
    ? <path d={`M${100 - 17},${mY - 8}Q100,${mY - 14} ${100 + 17},${mY - 8}`} fill="none" stroke={hc} strokeWidth="3" strokeLinecap="round" opacity={hOp} />
    : <path d={`M${100 - mx},${mY - my}Q${100 - 8},${mY - 18} 100,${mY - 11}Q${100 + 8},${mY - 18} ${100 + mx},${mY - my}Q${100 + 10},${mY - 9} 100,${mY - 6}Q${100 - 10},${mY - 9} ${100 - mx},${mY - my}Z`} fill={hc} opacity={hOp} />)
  const sb = profile.sideburns
  const sbEl = sb && sb !== 'none' && [-1, 1].map(s => <rect key={s} x={s < 0 ? 100 - wm - 1 : 100 + wm - 5} y={eyeY - 8} width="6" height={sb === 'long' ? 50 : 26} rx="3" fill={hc} opacity={hOp} />)

  const marks: string[] = profile.marks || []
  const marksEl = (
    <g>
      {marks.includes('scar_left_cheek') && <g stroke="#7a5a52" strokeWidth="1.4" strokeLinecap="round"><path d="M128,150l9,14" /><path d="M125,157l7,2M130,162l7,2" strokeWidth=".9" /></g>}
      {marks.includes('scar_right_cheek') && <g stroke="#7a5a52" strokeWidth="1.4" strokeLinecap="round"><path d="M72,150l-9,14" /><path d="M75,157l-7,2M70,162l-7,2" strokeWidth=".9" /></g>}
      {marks.includes('scar_eyebrow') && <path d={`M${100 - eyeX - 4},${eyeY - 28}l5,14`} stroke="#f5f1ec" strokeWidth="1.6" />}
      {marks.includes('mole_cheek') && <circle cx="132" cy="168" r="1.9" fill={INK} />}
      {marks.includes('birthmark_forehead') && <path d="M112,70q8,-3 10,4q-3,7 -9,3z" fill="#9a6a58" opacity=".45" />}
      {marks.includes('freckles') && Array.from({ length: 16 }).map((_, i) => <circle key={i} cx={100 + ((i * 37) % 60) - 30} cy={146 + ((i * 17) % 12)} r=".9" fill="#9a6a58" opacity=".7" />)}
      {marks.includes('wrinkles') && <g stroke={INK} strokeWidth=".8" opacity=".4" fill="none"><path d="M78,74q22,-4 44,0M80,82q20,-3 40,0" /><path d={`M${100 - 26},${noseBase + 2}q-4,16 -2,28M${100 + 26},${noseBase + 2}q4,16 2,28`} /></g>}
    </g>
  )
  const gl = profile.glasses === 'glasses' && (
    <g fill="none" stroke={INK} strokeWidth="1.8">
      <rect x={100 - eyeX - 17} y={eyeY - 11} width="34" height="22" rx="6" />
      <rect x={100 + eyeX - 17} y={eyeY - 11} width="34" height="22" rx="6" />
      <path d={`M${100 - eyeX + 17},${eyeY - 3}Q100,${eyeY - 8} ${100 + eyeX - 17},${eyeY - 3}M${100 - eyeX - 17},${eyeY - 4}l-14,-3M${100 + eyeX + 17},${eyeY - 4}l14,-3`} />
    </g>
  )

  return (
    <svg viewBox={view} className="w-full h-full" role="img" aria-label="Fast sketch preview">
      <defs>
        <clipPath id={clip}><path d={faceD} /></clipPath>
        <pattern id={`${id}-stub`} width="3" height="3" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".55" fill={hc} /><circle cx="2.4" cy="2.2" r=".4" fill={hc} /></pattern>
        <filter id={`${id}-rough`}><feTurbulence baseFrequency=".9" numOctaves="2" seed="3" result="n" /><feDisplacementMap in="SourceGraphic" in2="n" scale="1.1" /></filter>
      </defs>
      <g filter={`url(#${id}-rough)`}>
        {has('hair') && hairBack()}
        {has('ears') && earEl}
        {has('face') && <path d={faceD} fill={tint ? fill : '#f3f1ed'} stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />}
        {has('sideburns') && sbEl}
        {has('beard') && beardEl}
        {has('mustache') && mustEl}
        {has('hair') && hairFront()}
        {has('nose') && noseEl}
        {has('mouth') && mouthEl}
        {has('eyes') && <>{Eye(-1)}{Eye(1)}</>}
        {has('brows') && <>{Brow(-1)}{Brow(1)}</>}
        {has('marks') && marksEl}
        {has('glasses') && gl}
      </g>
    </svg>
  )
}

// crop + layers for the option thumbnails of each question
const THUMB: Record<string, { view: string; layers: Layer[] }> = {
  face_shape: { view: '10 20 180 250', layers: ['face'] },
  hair_style: { view: '0 0 200 270', layers: ['hair', 'face', 'eyes', 'brows'] },
  eyebrows: { view: '45 82 110 56', layers: ['brows', 'eyes'] },
  eyes: { view: '45 90 110 56', layers: ['eyes', 'brows'] },
  nose: { view: '66 104 68 70', layers: ['nose'] },
  mouth: { view: '66 172 68 44', layers: ['mouth'] },
  beard: { view: '20 130 160 140', layers: ['face', 'beard', 'mouth', 'nose'] },
}

export function Thumb({ q, opt, profile, schema }: { q: Question; opt: Opt; profile: Profile; schema: Schema }) {
  const t = THUMB[q.key]
  const prof = { ...profile, [q.key]: opt.id, skin: undefined }
  return <FaceSketch profile={prof} schema={schema} layers={t.layers} view={t.view} tint={false} id={`t-${q.key}-${opt.id}`} />
}
