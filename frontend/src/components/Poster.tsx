import { useEffect, useRef, useState } from 'react'
import type { Ctx } from '../pages/Case'
import { loadFile } from './CaseFile'

const PW = 1240, PH = 1754   // A4 at 150 dpi

const loadImg = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = src })

/** pencil sketch from the reconstruction: grayscale, colour-dodged with its blurred negative, plus paper grain */
function pencil(img: HTMLImageElement, w: number, h: number) {
  const a = document.createElement('canvas'); a.width = w; a.height = h
  const ca = a.getContext('2d')!; ca.filter = 'grayscale(1) contrast(1.15)'; cover(ca, img, 0, 0, w, h)
  const b = document.createElement('canvas'); b.width = w; b.height = h
  const cb = b.getContext('2d')!; cb.filter = 'grayscale(1) invert(1) blur(6px)'; cover(cb, img, 0, 0, w, h)
  const A = ca.getImageData(0, 0, w, h), B = cb.getImageData(0, 0, w, h)
  for (let i = 0; i < A.data.length; i += 4) {
    const g = A.data[i], inv = B.data[i]
    let v = inv >= 255 ? 255 : Math.min(255, (g * 255) / (255 - inv))
    v = 255 - (255 - v) * 1.6 + (Math.random() - 0.5) * 14   // darker strokes + grain
    A.data[i] = A.data[i + 1] = A.data[i + 2] = Math.max(0, Math.min(255, v))
  }
  ca.filter = 'none'; ca.putImageData(A, 0, 0)
  return a
}
function cover(c: CanvasRenderingContext2D, img: CanvasImageSource & { width: number; height: number }, x: number, y: number, w: number, h: number) {
  const s = Math.max(w / img.width, h / img.height), sw = w / s, sh = h / s
  c.drawImage(img, (img.width - sw) / 2, 0, sw, sh, x, y, w, h)
}
function wrap(c: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number, maxLines: number) {
  const lines: string[] = []
  for (const para of text.split('\n')) {
    let line = ''
    for (const word of para.split(' ')) { const t = line ? line + ' ' + word : word; if (c.measureText(t).width > maxW && line) { lines.push(line); line = word } else line = t }
    if (line) lines.push(line)
  }
  lines.slice(0, maxLines).forEach((l, i) => c.fillText(i === maxLines - 1 && lines.length > maxLines ? l + ' …' : l, x, y + i * lh))
  return Math.min(lines.length, maxLines) * lh
}

const T = (v: any) => String(v ?? '').replace(/_/g, ' ')
/** plain-language description of the reconstructed face for the poster */
function describe(p: any) {
  const parts = [`${T(p.skin)} complexion`, `${T(p.face_shape)} face`]
  if (p.hair_style === 'bald') parts.push('bald'); else if (p.hair_style) parts.push(`${T(p.hair_style)} ${T(p.hair_color)} hair`)
  if (p.eyes) parts.push(`${T(p.eyes)} ${T(p.eye_color)} eyes`)
  if (p.nose) parts.push(`${T(p.nose)} nose`)
  if (p.beard && p.beard !== 'none') parts.push(`${T(p.beard)} beard`)
  if (p.mustache && p.mustache !== 'none') parts.push(`${T(p.mustache)} moustache`)
  if (p.glasses === 'glasses') parts.push('wears glasses')
  for (const m of p.marks || []) parts.push(T(m).replace('scar ', 'scar on ').replace('mole cheek', 'mole on cheek').replace('birthmark forehead', 'birthmark on forehead'))
  const s = parts.filter(x => x.trim()).join(', ')
  return s.charAt(0).toUpperCase() + s.slice(1) + '.'
}

export default function Poster({ ctx }: { ctx: Ctx }) {
  const { id, data, profile } = ctx
  const ref = useRef<HTMLCanvasElement>(null)
  const [url, setUrl] = useState('')
  const [err, setErr] = useState('')
  const final = data.case.final_image as string | null
  const f = loadFile(id, data.case, profile)

  useEffect(() => {
    if (!final || !ref.current) return
    (async () => {
      const c = ref.current!.getContext('2d')!
      const face = await loadImg(final)
      // paper
      c.fillStyle = '#f3ead8'; c.fillRect(0, 0, PW, PH)
      for (let i = 0; i < 9000; i++) { c.fillStyle = `rgba(120,90,50,${Math.random() * 0.05})`; c.fillRect(Math.random() * PW, Math.random() * PH, 2, 2) }
      c.strokeStyle = '#1b1712'; c.lineWidth = 10; c.strokeRect(40, 40, PW - 80, PH - 80); c.lineWidth = 2; c.strokeRect(58, 58, PW - 116, PH - 116)
      // header
      c.fillStyle = '#9b1c1c'; c.textAlign = 'center'; c.font = 'bold 210px Georgia, "Times New Roman", serif'; c.fillText('WANTED', PW / 2, 270)
      c.fillStyle = '#1b1712'; c.font = 'bold 40px Georgia, serif'; c.fillText(`FOR ${(f.crime || 'QUESTIONING').toUpperCase()}`, PW / 2, 340)
      c.fillRect(140, 372, PW - 280, 3)
      // images
      const iw = 470, ih = 588, iy = 410, gx = (PW - 2 * iw - 60) / 2
      c.drawImage(pencil(face, iw, ih), gx, iy)
      cover(c, face, gx + iw + 60, iy, iw, ih)
      c.lineWidth = 4; c.strokeRect(gx, iy, iw, ih); c.strokeRect(gx + iw + 60, iy, iw, ih)
      c.font = 'italic 24px Georgia, serif'; c.fillText('Forensic pencil sketch', gx + iw / 2, iy + ih + 36); c.fillText('3D facial reconstruction', gx + iw * 1.5 + 60, iy + ih + 36)
      // details
      let y = iy + ih + 100
      c.textAlign = 'left'
      const rows: [string, string][] = [['Name', f.name || 'Unknown'], ['Alias', f.alias || '—'], ['Sex / Age', `${f.sex} · ${f.age || '—'} years`], ['Height / Build', `${f.height || '—'} · ${f.build || '—'}`],
        ['Last seen', [f.lastSeen, f.lastSeenDate].filter(Boolean).join(' · ') || '—'], ['Vehicle', f.vehicle || '—']]
      rows.forEach(([k, v], i) => {
        const x = i % 2 ? PW / 2 + 20 : 140, yy = y + Math.floor(i / 2) * 50
        c.font = 'bold 26px Georgia, serif'; c.fillText(k.toUpperCase() + ':', x, yy); const kw = c.measureText(k.toUpperCase() + ': ').width
        c.font = '26px Georgia, serif'; c.fillText(v.length > 26 ? v.slice(0, 25) + '…' : v, x + kw, yy)
      })
      y += 3 * 50 + 10
      c.font = 'bold 26px Georgia, serif'; c.fillText('DESCRIPTION:', 140, y); c.font = '24px Georgia, serif'
      y += 4 + wrap(c, describe(profile), 140, y + 34, PW - 280, 32, 3) + 30
      if (f.leads.trim()) { c.font = 'bold 26px Georgia, serif'; c.fillText('DETAILS:', 140, y); c.font = '24px Georgia, serif'; y += 4 + wrap(c, f.leads, 140, y + 34, PW - 280, 32, 4) + 20 }
      if (f.reward) { c.textAlign = 'center'; c.fillStyle = '#9b1c1c'; c.font = 'bold 44px Georgia, serif'; c.fillText(`REWARD ${f.reward}`, PW / 2, Math.max(y + 30, PH - 260)); c.fillStyle = '#1b1712' }
      // footer
      c.textAlign = 'center'; c.fillRect(140, PH - 220, PW - 280, 3)
      c.font = 'italic 26px Georgia, serif'; c.fillText('Anyone with information about this person is requested to', PW / 2, PH - 175)
      c.font = 'bold 44px Georgia, serif'; c.fillStyle = '#9b1c1c'; c.fillText('CONTACT RAJAJINAGAR POLICE STATION', PW / 2, PH - 112)
      c.fillStyle = '#1b1712'; c.font = '20px Georgia, serif'; c.fillText(`Case ref. ${data.case.id} · Do not attempt to apprehend this person yourself`, PW / 2, PH - 78)
      setUrl(ref.current!.toDataURL('image/png'))
    })().catch(e => setErr(String(e?.message || e)))
  }, [final])

  if (!final) return <div className="card p-14 text-center paper-bg"><div className="text-lg font-medium mb-1">Generate a face first</div><button className="btn btn-primary mt-3" onClick={() => ctx.go('interview')}>Go to Describe</button></div>

  const pdf = () => {
    const w = window.open('', '_blank'); if (!w) return
    w.document.write(`<title>Wanted poster ${data.case.id}</title><style>@page{size:A4;margin:0}body{margin:0}img{width:100%;display:block}</style><img src="${url}" onload="setTimeout(()=>print(),200)">`); w.document.close()
  }
  return (
    <div className="grid lg:grid-cols-[minmax(0,560px)_1fr] gap-6 items-start">
      <div className="card p-3"><canvas ref={ref} width={PW} height={PH} className="w-full h-auto rounded" /></div>
      <div className="card p-5">
        <div className="label mb-2">Export wanted poster</div>
        <p className="text-[13px] text-graphite mb-4">The poster uses the pencil sketch and 3D reconstruction of the current face, plus the details from <b>Suspect &amp; witnesses</b>. Edit those details and come back to update the poster.</p>
        <div className="flex flex-wrap gap-2">
          <a className={`btn btn-primary ${url ? '' : 'pointer-events-none opacity-50'}`} href={url} download={`wanted-${data.case.id}.png`}>Download image (PNG)</a>
          <button className="btn btn-ghost" disabled={!url} onClick={pdf}>Save as PDF</button>
          <button className="btn btn-ghost" onClick={() => ctx.go('file')}>Edit suspect details</button>
        </div>
        {err && <p className="text-[12px] text-warn mt-3">Could not build the poster: {err}</p>}
      </div>
    </div>
  )
}
