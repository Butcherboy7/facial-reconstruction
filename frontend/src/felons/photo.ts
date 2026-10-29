// Turns a face render into a booking photograph (height-chart wall, shirt, ID placard, flash look, film grain)
// and draws inked fingerprints. Everything is canvas-only so it works offline at the expo.
import type { Felon } from './data'

const loadImg = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = src })

function hash(x: number, y: number, s: number) { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296 }
function vnoise(x: number, y: number, s: number) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf)
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}
const sm = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t) }

const BG = [215, 220, 224]   // studio background colour of the 3D renders (#d7dce0)
const SHIRTS = ['#2d3138', '#4a4f57', '#5b4a3c', '#1f2a3a', '#6b6f73', '#3b4a3e', '#7a6a58', '#26282b']

export async function mugshot(src: string, f: Felon, idx: number, photo?: string) {
  const W = 400, H = 500
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H
  const c = cv.getContext('2d')!
  if (photo) {   // a real booking photograph is on file: use it and add the placard
    const im = await loadImg(photo)
    c.drawImage(im, 0, 0, W, H)
    placard(c, f, idx, W, H)
    return grade(c, W, H, 0.95, 8)
  }
  // wall + height chart
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#c9ccc8'); g.addColorStop(1, '#b3b7b3'); c.fillStyle = g; c.fillRect(0, 0, W, H)
  c.strokeStyle = 'rgba(30,30,30,.55)'; c.fillStyle = 'rgba(30,30,30,.7)'; c.font = 'bold 13px Arial'
  const top = 6 + (f.height - 150) * -2.2 + 40   // taller people sit higher against the chart
  for (let k = 0; k < 14; k++) {
    const y = 10 + k * 34, cm = 200 - k * 5 + Math.round((top - 40) / 7)
    c.lineWidth = k % 2 ? 1 : 2; c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke()
    if (k % 2 === 0) { c.fillText(String(cm), 6, y - 4); c.fillText(String(cm), W - 32, y - 4) }
    c.lineWidth = 1; c.beginPath(); c.moveTo(0, y + 17); c.lineTo(24, y + 17); c.moveTo(W - 24, y + 17); c.lineTo(W, y + 17); c.stroke()
  }
  // face render with its studio background keyed out
  const img = await loadImg(src)
  const fc = document.createElement('canvas'); fc.width = img.width; fc.height = img.height
  const fx = fc.getContext('2d')!; fx.drawImage(img, 0, 0)
  const d = fx.getImageData(0, 0, img.width, img.height), p = d.data
  for (let i = 0; i < p.length; i += 4) { const dist = Math.abs(p[i] - BG[0]) + Math.abs(p[i + 1] - BG[1]) + Math.abs(p[i + 2] - BG[2]); p[i + 3] = 255 * sm(10, 34, dist) }
  fx.putImageData(d, 0, 0)
  // soft shadow on the wall behind the head (flash from the camera)
  const fw = W * 0.92, fh = fw * img.height / img.width
  c.save(); c.filter = 'blur(10px) brightness(0)'; c.globalAlpha = 0.28; c.drawImage(fc, (W - fw) / 2 + 16, 12, fw, fh); c.restore()
  c.drawImage(fc, (W - fw) / 2, 4, fw, fh)
  // shirt over the bare shoulders
  const sy = H * 0.8
  c.fillStyle = SHIRTS[idx % SHIRTS.length]
  c.beginPath(); c.moveTo(0, sy + 22); c.bezierCurveTo(W * 0.2, sy - 4, W * 0.32, sy - 14, W * 0.4, sy - 14)
  c.quadraticCurveTo(W * 0.5, sy + 26, W * 0.6, sy - 14); c.bezierCurveTo(W * 0.68, sy - 14, W * 0.8, sy - 4, W, sy + 22); c.lineTo(W, H); c.lineTo(0, H); c.closePath(); c.fill()
  c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 3; c.beginPath(); c.moveTo(W * 0.4, sy - 14); c.quadraticCurveTo(W * 0.5, sy + 26, W * 0.6, sy - 14); c.stroke()
  placard(c, f, idx, W, H)
  return grade(c, W, H, 0.78, 16)
}

function placard(c: CanvasRenderingContext2D, f: Felon, idx: number, W: number, H: number) {
  const px = 92, py = H - 92, pw = W - 184, ph = 86
  c.fillStyle = '#121314'; c.fillRect(px, py, pw, ph); c.strokeStyle = '#d8d8d8'; c.lineWidth = 2; c.strokeRect(px + 4, py + 4, pw - 8, ph - 8)
  c.fillStyle = '#f2f2f2'; c.textAlign = 'center'; c.font = 'bold 13px "Courier New", monospace'; c.fillText('CRIMINAL RECORDS BUREAU', W / 2, py + 22)
  c.font = 'bold 21px "Courier New", monospace'; c.fillText(f.id, W / 2, py + 47)
  c.font = 'bold 12px "Courier New", monospace'; c.fillText(`${f.name.toUpperCase().slice(0, 24)}`, W / 2, py + 64); c.fillText(`${String(f.convicted)}-${String(3 + (idx % 9)).padStart(2, '0')}-${String(10 + idx).padStart(2, '0')}`, W / 2, py + 79)
  c.textAlign = 'left'
}

/** camera look: slight desaturation, flash contrast, warm cast, vignette, grain */
function grade(c: CanvasRenderingContext2D, W: number, H: number, sat: number, grain: number) {
  const o = c.getImageData(0, 0, W, H), q = o.data
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, l = 0.3 * q[i] + 0.59 * q[i + 1] + 0.11 * q[i + 2]
    const vig = 1 - 0.32 * Math.pow(Math.hypot((x - W / 2) / W, (y - H * 0.42) / H) * 1.6, 2), n = (Math.random() - 0.5) * grain
    for (let k = 0; k < 3; k++) {
      let v = l + (q[i + k] - l) * sat                      // desaturate
      v = (v - 128) * 1.1 + 128 + [6, 2, -6][k]               // contrast + warm
      q[i + k] = Math.max(0, Math.min(255, v * vig + n))
    }
  }
  c.putImageData(o, 0, 0)
  return c.canvas.toDataURL('image/jpeg', 0.86)
}

// ---- inked fingerprint: ridges are level lines of a pattern field (whorl / loop / arch), warped and broken by noise ----
const fpCache = new Map<number, string>()
export function fingerprint(seed0: number) {
  const seed = (seed0 * 7919) % 1000003
  const hit = fpCache.get(seed); if (hit) return hit
  const W = 180, H = 230, cv = document.createElement('canvas'); cv.width = W; cv.height = H
  const c = cv.getContext('2d')!, o = c.createImageData(W, H), q = o.data
  const r = (k: number) => hash(seed, k, 11)
  const type = ['loop', 'whorl', 'loop', 'arch', 'whorl'][Math.floor(r(1) * 5)]
  const cx = (r(2) - 0.5) * 0.2, cy = -0.05 + (r(3) - 0.5) * 0.15, side = r(4) < 0.5 ? -1 : 1, freq = 17 + r(5) * 4, tw = (r(6) - 0.5) * 0.6
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = (x - W / 2) / (W * 0.5), v = (y - H / 2) / (H * 0.5)
    const ex = u / 0.86, ey = v / 0.95, rr = Math.hypot(ex, ey * 0.92)
    const edge = rr + (vnoise(u * 5, v * 5, seed) - 0.5) * 0.12
    const i = (y * W + x) * 4
    let ink = 0
    if (edge < 1) {
      const a = u - cx, b = v - cy
      let dd: number
      if (type === 'whorl') { const ang = Math.atan2(b, a); dd = Math.hypot(a, b * 0.85) + (ang / (2 * Math.PI)) / freq * (r(7) < 0.5 ? 1 : 2) }
      else if (type === 'loop') {   // U-shaped ridges round a short segment leaning to one side, plain arches above it
        const sx = cx + side * 0.25, sy = cy + 0.55, t = Math.max(0, Math.min(1, ((u - cx) * (sx - cx) + (v - cy) * (sy - cy)) / ((sx - cx) ** 2 + (sy - cy) ** 2)))
        const dl = Math.hypot(u - (cx + t * (sx - cx)), v - (cy + t * (sy - cy)))
        const arch = (cy - v) + 0.25 * Math.exp(-((u - cx) ** 2) * 3)
        dd = v < cy ? Math.min(dl, Math.max(dl, arch + 0.02)) : dl
        dd = dd * (1 - sm(-0.5, -0.9, v)) + (arch + 0.4) * sm(-0.5, -0.9, v)
      } else dd = -(v - cy) + 0.3 * Math.exp(-((u - cx) ** 2) * 5) * (1 - sm(0.2, 0.9, Math.abs(v)))
      dd += tw * u * v * 0.15 + (vnoise(u * 3, v * 3, seed + 1) - 0.5) * 0.05
      const ridge = Math.cos(2 * Math.PI * dd * freq)
      const breaks = sm(0.15, 0.3, vnoise(u * 28, v * 28, seed + 2)) * sm(0.08, 0.22, vnoise(u * 60, v * 60, seed + 3))
      const pressure = 1 - sm(0.55, 1.0, edge)
      ink = sm(-0.15, 0.45, ridge) * breaks * (0.35 + 0.65 * pressure) * (0.75 + 0.25 * vnoise(u * 12, v * 12, seed + 4))
    }
    const paper = 248 - vnoise(x * 0.4, y * 0.4, 5) * 10
    const val = paper * (1 - ink * 0.9)
    q[i] = val; q[i + 1] = val; q[i + 2] = val + 2; q[i + 3] = 255
  }
  c.putImageData(o, 0, 0)
  const url = cv.toDataURL('image/png'); fpCache.set(seed, url)
  return url
}
export const fingerprintType = (seed0: number) => ['Ulnar loop', 'Plain whorl', 'Radial loop', 'Plain arch', 'Double-loop whorl'][Math.floor(hash((seed0 * 7919) % 1000003, 1, 11) * 5)]
