import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FUNCS, VARY, SKIN_FRAG, HAIR_FRAG } from './shaders'

export const X0 = -0.07
export const EYE_CX = 0.615, EYE_CY = 1.74
export type Profile = Record<string, any>

// ---------- witness profile -> rig parameters ----------
const HAIR: Record<string, string> = { black: '#1a1a1c', dark_brown: '#3a2a20', brown: '#6b4a32', blond: '#c9a463', red: '#98421f', grey: '#9a9a9c' }
const SKIN: Record<string, string> = { very_light: '#f1d3bf', light: '#e2b693', medium: '#c48f66', olive: '#b0804f', brown: '#8a5634', dark: '#5a3624' }
const EYE: Record<string, string> = { brown: '#4a2c18', hazel: '#7a5a2a', green: '#4d7a4f', blue: '#4478a8', grey: '#78858f' }
const EYES: Record<string, [number, number, number, number]> = { // w,h,tilt,lid
  almond: [1, 1, 0, 0], round: [.92, 1.45, 0, 0], narrow: [1.05, .55, 0, 0], hooded: [1, .8, 0, 1], deep_set: [1, .85, 0, .6], upturned: [1, .9, .09, 0] }
const BROWS: Record<string, [number, number]> = { thin_arched: [-.9, 4], medium: [0, 1.5], thick_straight: [1.3, 0], thick_arched: [1.3, 4], bushy: [2.6, 2] }
const NOSE: Record<string, { w: number; l: number; hook: number; up: number }> = {
  straight: { w: 0, l: 0, hook: 0, up: 0 }, broad: { w: .32, l: -.02, hook: 0, up: 0 }, narrow: { w: -.2, l: .04, hook: 0, up: 0 },
  hooked: { w: -.04, l: .05, hook: 1, up: 0 }, upturned: { w: -.05, l: -.08, hook: 0, up: 1 }, long: { w: 0, l: .16, hook: 0, up: 0 } }
const MOUTH: Record<string, [number, number, number]> = { thin: [1, .55, .7], medium: [1, 1, 1.2], full: [1.05, 1.6, 1.9], wide: [1.3, 1, 1.2], small: [.74, 1, 1.2] }

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const sm = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t) }
const g2 = (dx: number, sx: number, dy: number, sy: number) => Math.exp(-((dx / sx) ** 2 + (dy / sy) ** 2))

export type Look = {
  // geometry morphs
  width: number; jaw: number; length: number; chinZ: number; chinPoint: number; cleft: number; foreheadH: number
  noseW: number; noseL: number; noseBridge: number; noseHook: number; noseUp: number; brow: number; cheek: number; bone: number; lip: number
  earS: number; earOut: number; female: number; age: number
  // surface params
  skin: string; hair: string; iris: string; lip_c: string
  eyeSpacing: number; eyeW: number; eyeH: number; eyeTilt: number; eyeLid: number
  browT: number; browArch: number; browUp: number
  mouthW: number; lipUp: number; lipLo: number
  beard: number; goatee: number; must: number; side: number
  style: string; hairline: number; recede: number; grey: number
  marks: string[]; glasses: boolean
}

export function lookFromProfile(p: Profile): Look {
  const fs = ({ oval: [0, 0, 0], round: [.1, -.06, .1], square: [.05, -.02, .22], heart: [.02, .03, -.2], long: [-.06, .12, -.04], diamond: [-.01, .02, -.15] } as any)[p.face_shape] || [0, 0, 0]
  const jawK = ({ soft: 0, strong: .12, angular: .2, narrow: -.14 } as any)[p.jaw] ?? 0
  const female = p.sex === 'female' ? 1 : 0
  const nose = NOSE[p.nose] || NOSE.straight
  const ns = ({ small: -.1, medium: 0, large: .12 } as any)[p.nose_size] ?? 0
  const ey = EYES[p.eyes] || EYES.almond
  const br = BROWS[p.eyebrows] || BROWS.medium
  const mo = MOUTH[p.mouth] || MOUTH.medium
  const age = clamp(((p.age ?? 35) - 25) / 40, 0, 1.2)
  const skinKey = p.skin || 'medium'
  const dark = skinKey === 'dark' || skinKey === 'brown'
  const eyeKey = p.eye_color || (dark ? 'brown' : 'hazel')
  const hairC = HAIR[p.hair_color] || HAIR.dark_brown
  const lipBase = new THREE.Color(SKIN[skinKey] || SKIN.medium).lerp(new THREE.Color(dark ? (female ? '#5a2026' : '#4a1f20') : (female ? '#b4485a' : '#b04a46')), female ? 0.68 : 0.6).getStyle()
  const beardV = ({ none: 0, stubble: .38, short: .72, full: 1, goatee: .9 } as any)[p.beard ?? 'none']
  const hs = p.hair_style || (female ? 'long' : 'short')   // sensible look before the hair question is answered
  return {
    width: .04 + fs[0] - .06 * female, jaw: fs[2] + jawK - .15 * female, length: -.03 + fs[1] + (p.chin === 'projecting' ? .02 : 0) - (p.chin === 'receding' ? .02 : 0),
    chinZ: ({ receding: -.2, medium: 0, projecting: .26, cleft: .05, pointed: .06 } as any)[p.chin] ?? 0, chinPoint: (p.chin === 'pointed' ? .35 : p.jaw === 'narrow' ? .12 : 0) + .1 * female, cleft: p.chin === 'cleft' ? 1 : 0,
    foreheadH: ({ low: -.18, medium: 0, high: .22 } as any)[p.forehead] ?? 0,
    noseW: nose.w + ns * .9 - .12 * female, noseL: nose.l * 2 + ns - .06 * female, noseBridge: p.nose === 'hooked' ? .08 : 0, noseHook: nose.hook, noseUp: nose.up, brow: .09 - .05 * female + (p.eyes === 'deep_set' ? .08 : 0),
    cheek: p.cheeks === 'full' ? .22 : p.cheeks === 'hollow' ? -.2 : 0, bone: (p.cheeks === 'high_cheekbones' || p.face_shape === 'diamond' ? .2 : 0) + .08 * female, lip: (mo[1] - 1) * .05,
    earS: (({ small: .82, medium: 1, large: 1.22, protruding: 1.15 } as any)[p.ears] ?? 1) * (hs === 'long' ? .6 : 1), earOut: hs === 'long' ? -0.75 : (p.ears === 'protruding' ? .35 : 0), female, age,
    skin: SKIN[skinKey] || SKIN.medium, hair: hairC, iris: EYE[eyeKey] || EYE.brown, lip_c: lipBase,
    eyeSpacing: ({ close: .88, average: 1, wide: 1.14 } as any)[p.eye_spacing] ?? 1, eyeW: ey[0] + .05 * female, eyeH: ey[1] + .12 * female, eyeTilt: ey[2], eyeLid: ey[3],
    browT: br[0] - .5 * female, browArch: br[1] + 0.5 * female, browUp: p.forehead === 'high' ? .05 : 0,
    mouthW: mo[0] * (1 - .04 * female), lipUp: mo[1] + female * .3, lipLo: mo[2] + female * .3,
    beard: female ? 0 : p.beard === 'goatee' ? .9 : beardV, goatee: p.beard === 'goatee' ? 1 : 0,
    must: female ? 0 : ({ none: 0, thin: .55, thick: 1, handlebar: 1 } as any)[p.mustache ?? 'none'], side: female ? 0 : ({ none: 0, short: .3, long: 1 } as any)[p.sideburns ?? 'none'],
    style: hs, hairline: ({ low: -.15, medium: 0, high: .2 } as any)[p.forehead] ?? 0, recede: hs === 'receding' ? 1 : 0, grey: clamp(((p.age ?? 35) - 42) / 28, 0, 1) * (p.hair_color === 'grey' ? 0 : 1),
    marks: p.marks || [], glasses: p.glasses === 'glasses',
  }
}

// ---------- the rig ----------
let geoPromise: Promise<THREE.BufferGeometry> | null = null
let MAPS: { normal: THREE.Texture; detail: THREE.Texture } | null = null

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src })
}

/** scan albedo -> high-pass ratio map (skin micro-variation only; broad colour is replaced by the witness skin tone) */
async function loadMaps() {
  const [nImg, cImg] = await Promise.all([loadImage('/models/Infinite-Level_02_Tangent_SmoothUV.jpg'), loadImage('/models/Map-COL.jpg')])
  const normal = new THREE.Texture(nImg); normal.flipY = false; normal.needsUpdate = true; normal.wrapS = normal.wrapT = THREE.RepeatWrapping
  const S = 1024
  const a = document.createElement('canvas'); a.width = a.height = S
  const ca = a.getContext('2d', { willReadFrequently: true })!; ca.drawImage(cImg, 0, 0, S, S)
  const b = document.createElement('canvas'); b.width = b.height = S
  const cb = b.getContext('2d', { willReadFrequently: true })!; cb.filter = 'blur(22px)'; cb.drawImage(cImg, 0, 0, S, S)
  const da = ca.getImageData(0, 0, S, S), db = cb.getImageData(0, 0, S, S)
  for (let i = 0; i < da.data.length; i += 4) {
    const l = (da.data[i] * 0.3 + da.data[i + 1] * 0.59 + da.data[i + 2] * 0.11) + 8
    const m = (db.data[i] * 0.3 + db.data[i + 1] * 0.59 + db.data[i + 2] * 0.11) + 8
    const v = Math.max(0, Math.min(255, (l / m) * 127.5))
    da.data[i] = da.data[i + 1] = da.data[i + 2] = v; da.data[i + 3] = 255
  }
  ca.putImageData(da, 0, 0)
  const detail = new THREE.CanvasTexture(a); detail.flipY = false; detail.needsUpdate = true; detail.wrapS = detail.wrapT = THREE.RepeatWrapping
  MAPS = { normal, detail }
}

export function loadHeadGeometry() {
  if (!geoPromise) geoPromise = Promise.all([new GLTFLoader().loadAsync('/models/head.glb'), loadMaps().catch(() => {})]).then(([g]) => {
    let geo: THREE.BufferGeometry | null = null
    g.scene.traverse((o: any) => { if (o.isMesh && !geo) geo = o.geometry })
    return geo!
  })
  return geoPromise
}

export class FaceRig {
  root = new THREE.Group()
  geo: THREE.BufferGeometry
  base: Float32Array
  head: THREE.Mesh
  hair: THREE.Mesh
  extras = new THREE.Group()
  eyes = new THREE.Group()
  plugMat!: THREE.MeshStandardMaterial
  eyeMeshes: THREE.Mesh[] = []
  U: Record<string, THREE.IUniform> = {}
  private glassGroup: THREE.Group | null = null
  private bun: THREE.Mesh
  private curtain: THREE.Mesh

  constructor(src: THREE.BufferGeometry) {
    this.geo = src.clone()
    this.smoothEyes()
    this.base = new Float32Array((this.geo.attributes.position as THREE.BufferAttribute).array as Float32Array)
    const num = (v: number) => ({ value: v })
    const names = ['uEyeX', 'uHairline', 'uRecede', 'uBackEdge', 'uSideLong', 'uStyle', 'uEyeSpacing', 'uEyeW', 'uEyeH', 'uEyeTilt', 'uEyeLid', 'uBrowT', 'uBrowArch', 'uBrowUp',
      'uMouthW', 'uLipUp', 'uLipLo', 'uBeard', 'uMust', 'uSide', 'uGoatee', 'uAge', 'uGrey', 'uFemale', 'uScarL', 'uScarR', 'uMole', 'uBirth', 'uFreckle', 'uWrinkleMark', 'uScarBrow', 'uThick', 'uFrontVol', 'uCurl']
    names.forEach(n => (this.U[n] = num(0)))
    this.U.uWrinkleMark.value = 1
    this.U.uSkin = { value: new THREE.Color('#c48f66') }; this.U.uHair = { value: new THREE.Color('#3a2a20') }
    this.U.uIris = { value: new THREE.Color('#4a2c18') }; this.U.uLip = { value: new THREE.Color('#a86a5a') }
    this.U.uDetail = { value: MAPS?.detail ?? new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1) }
    if (!MAPS) (this.U.uDetail.value as THREE.DataTexture).needsUpdate = true

    const skin = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.8, metalness: 0, sheen: 0.15, sheenRoughness: 0.6, sheenColor: new THREE.Color("#ffd9c8"), clearcoat: 0, clearcoatRoughness: 0.5 })
    if (MAPS) { skin.normalMap = MAPS.normal; skin.normalScale.set(0.3, 0.3) }
    skin.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, this.U)
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + VARY).replace('#include <begin_vertex>', '#include <begin_vertex>\n vObj = position; vObjN = normal; vDet = uv;')
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + VARY + FUNCS + SKIN_FRAG)
        .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb = paintFace(vObj, normalize(vObjN), uSkin);')
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = skinRough(vObj, roughnessFactor);')
    }
    this.head = new THREE.Mesh(this.geo, skin)

    const hairMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.78, metalness: 0 })
    hairMat.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, this.U)
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + VARY + FUNCS + '\nuniform float uThick; uniform float uFrontVol; uniform float uCurl;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vObj = position; vObjN = normal;
          float hm = hairMaskSoft(position);
          float nz = vnoise(position.xy*7.0 + position.z*3.0);
          float curl = uCurl * (vnoise(position.xy*22.0 + position.z*9.0) - 0.4) * 0.5;
          float th = (uThick*(0.92 + 0.2*nz) + curl + uFrontVol*smoothstep(2.4,3.7,position.y)*smoothstep(0.2,1.8,position.z)) * hm;
          transformed += normal * th;
          transformed.x += sign(position.x - X0) * smoothstep(1.6,-0.6,position.y) * 0.3 * uSideLong * hm;`)
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + VARY + FUNCS + HAIR_FRAG)
        .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n if (hairMask(vObj) < 0.5) discard;')
        .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb = hairColor(vObj);')
    }
    this.hair = new THREE.Mesh(this.geo, hairMat)
    const bunMat = new THREE.MeshStandardMaterial({ color: '#3a2a20', roughness: 0.75, map: strandTexture(4, 2) })
    this.bun = new THREE.Mesh(new THREE.SphereGeometry(0.8, 40, 28), bunMat); this.bun.position.set(X0, 3.55, -1.45); this.bun.scale.set(1, 0.82, 0.9); this.bun.rotation.x = -0.5; this.bun.visible = false
    this.curtain = makeCurtain()
    this.makeEyes()
    this.root.add(this.head, this.hair, this.bun, this.curtain, this.extras, this.eyes)
  }

  private makeEyes() {
    this.plugMat = new THREE.MeshStandardMaterial({ color: '#c48f66', roughness: 0.7 })
    for (const s of [-1, 1]) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 20), this.head.material as THREE.Material)   // painted like the face
      m.userData.side = s; this.eyes.add(m); this.eyeMeshes.push(m)
    }
  }

  /** close the open mouth in the scan and gently even out the under-jaw / neck, leaving lips and chin untouched */
  private smoothEyes() {
    this.closeMouth()
    const pos = this.geo.attributes.position as THREE.BufferAttribute
    const idx = this.geo.index!.array
    const nb: number[][] = Array.from({ length: pos.count }, () => [])
    for (let i = 0; i < idx.length; i += 3) { const a = idx[i], b = idx[i + 1], c = idx[i + 2]; nb[a].push(b, c); nb[b].push(a, c); nb[c].push(a, b) }
    const w = new Float32Array(pos.count)
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) - X0, y = pos.getY(i), z = pos.getZ(i)
      if (z < 0.2) continue
      w[i] = sm(-0.5, -0.75, y) * (1 - sm(-1.5, -1.9, y)) * (1 - sm(1.5, 2.2, Math.abs(x)))
    }
    // Taubin smoothing (shrink / inflate pairs) so the neck keeps its volume
    const step = (k: number) => {
      const next = new Float32Array(pos.array as Float32Array)
      for (let i = 0; i < pos.count; i++) {
        if (w[i] < 0.02 || !nb[i].length) continue
        let ax = 0, ay = 0, az = 0; for (const j of nb[i]) { ax += pos.getX(j); ay += pos.getY(j); az += pos.getZ(j) }
        const n = nb[i].length, f = k * w[i]
        next[i * 3] += (ax / n - pos.getX(i)) * f; next[i * 3 + 1] += (ay / n - pos.getY(i)) * f; next[i * 3 + 2] += (az / n - pos.getZ(i)) * f
      }
      pos.array.set(next)
    }
    for (let it = 0; it < 30; it++) { step(0.6); step(-0.63) }
    pos.needsUpdate = true
  }

  /** fill the mouth opening (boundary loop just behind the lips) with a fan so no inner mouth / teeth show */
  private closeMouth() {
    const g = this.geo, pos = g.attributes.position as THREE.BufferAttribute, idx = Array.from(g.index!.array)
    const cnt = new Map<string, number>(), dir = new Map<string, [number, number]>()
    for (let i = 0; i < idx.length; i += 3) for (let k = 0; k < 3; k++) {
      const a = idx[i + k], b = idx[i + (k + 1) % 3], key = a < b ? a + ',' + b : b + ',' + a
      cnt.set(key, (cnt.get(key) || 0) + 1); dir.set(key, [a, b])
    }
    const next = new Map<number, number>()
    for (const [key, c] of cnt) if (c === 1) { const [a, b] = dir.get(key)!; const x = (pos.getX(a) + pos.getX(b)) / 2 - X0, y = (pos.getY(a) + pos.getY(b)) / 2, z = (pos.getZ(a) + pos.getZ(b)) / 2
      if (Math.abs(x) < 0.6 && y > 0.1 && y < 0.6 && z > 1.7) next.set(b, a) }
    if (next.size < 8) return
    const start = next.keys().next().value as number
    const loop: number[] = []; let cur = start
    for (let guard = 0; guard < 500; guard++) { loop.push(cur); const nx = next.get(cur); if (nx === undefined || nx === start) break; cur = nx }
    if (loop.length < 8) return
    let cx = 0, cy = 0, cz = 0; for (const i of loop) { cx += pos.getX(i); cy += pos.getY(i); cz += pos.getZ(i) }
    cx /= loop.length; cy /= loop.length; cz /= loop.length
    const n = pos.count, arr = new Float32Array(n * 3 + 3); arr.set(pos.array as Float32Array); arr.set([cx, cy, cz + 0.02], n * 3)
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3))
    for (const name of Object.keys(g.attributes)) {
      if (name === 'position') continue
      const at = g.attributes[name] as THREE.BufferAttribute, s = at.itemSize, src = at.array as Float32Array
      const out = new (src.constructor as any)(src.length + s); out.set(src); for (let k = 0; k < s; k++) out[src.length + k] = src[loop[0] * s + k]
      g.setAttribute(name, new THREE.BufferAttribute(out, s, at.normalized))
    }
    for (let k = 0; k < loop.length; k++) idx.push(loop[(k + 1) % loop.length], loop[k], n)
    g.setIndex(idx)
  }

  apply(L: Look, jitter = 0, seed = 1) {
    const r = mulberry(seed)
    const j = (a: number) => (jitter ? (r() - 0.5) * 2 * a * jitter : 0)
    const J = { width: j(.1), jaw: j(.14), length: j(.08), nose: j(.18), cheek: j(.18), brow: j(.06), lip: j(.03), chin: j(.16) }
    const pos = this.geo.attributes.position as THREE.BufferAttribute
    const b = this.base, a = pos.array as Float32Array
    for (let i = 0; i < pos.count; i++) {
      let x = b[i * 3], y = b[i * 3 + 1], z = b[i * 3 + 2]
      let qx = x - X0
      {
        // eye region: spacing / width / opening / tilt reshape the real lid geometry
        const ax0 = Math.abs(qx), we = g2(ax0 - EYE_CX, 0.5, y - EYE_CY, 0.42)
        if (we > 0.001) {
          const sgn = Math.sign(qx)
          const sy = 1, sx = 1
          qx = sgn * (EYE_CX + (ax0 - EYE_CX) * (1 + (sx - 1) * we) + (L.eyeSpacing - 1) * 0.5 * we)
        }
      }
      const head = sm(-0.9, 0.3, y) * (1 - sm(3.7, 4.2, y))
      qx *= 1 + (L.width + J.width) * head
      const wj = Math.exp(-(((y - 0.2) / 0.85) ** 2)) * (z > -1.2 ? 1 : 0.4)
      qx *= 1 + (L.jaw + J.jaw) * 0.3 * wj
      qx *= 1 - 0.07 * Math.exp(-(((y + 0.05) / 0.75) ** 2)) * (z > 0 ? 1 : 0.5)   // the scan's heavy lower cheeks, slimmed
      qx *= 1 - L.chinPoint * Math.exp(-(((y + 0.35) / 0.5) ** 2))
      // face length: lower face drops, bust follows
      y -= (L.length + J.length) * 4.5 * sm(1.3, -0.4, y)
      const ax = Math.abs(qx)
      // nose
      const wn = g2(qx, 0.75, y - 1.4, 0.55) * sm(1.0, 2.2, z)
      qx *= 1 + L.noseW * wn
      z += (L.noseL + J.nose) * g2(qx, 0.32, y - 1.28, 0.32) * 1.2
      z += L.noseBridge * 3 * g2(qx, 0.2, y - 1.65, 0.35)
      z += L.noseHook * 0.22 * g2(qx, 0.22, y - 1.65, 0.28)
      y += L.noseUp * 0.12 * g2(qx, 0.4, y - 1.3, 0.3) - L.noseHook * 0.08 * g2(qx, 0.3, y - 1.25, 0.3)
      z += L.noseUp * 0.1 * g2(qx, 0.35, y - 1.25, 0.25)
      // brow / eye sockets / cheeks / lips / chin
      z += (L.brow + J.brow) * g2(ax - 0.95, 0.75, y - 2.42, 0.22) * sm(0.6, 1.6, z)
      z += 0.05 * g2(ax - 0.68, 0.6, y - 1.98, 0.3) * sm(1.2, 2, z)
      z += (L.cheek + J.cheek) * 0.55 * g2(ax - 1.35, 0.55, y - 1.0, 0.5) * sm(0.5, 1.6, z)
      z += L.bone * 0.5 * g2(ax - 1.6, 0.5, y - 1.55, 0.35) * sm(0.5, 1.6, z)
      z += (L.lip + J.lip) * 6 * g2(qx, 0.5, y - 0.55, 0.18) * sm(1.2, 2.2, z)
      z += (L.chinZ + J.chin) * g2(qx, 0.6, y + 0.35, 0.45) * sm(1.0, 2.0, z)
      z -= L.cleft * 0.07 * g2(qx, 0.05, y + 0.3, 0.25) * sm(1.0, 2.0, z)
      if (L.female) {   // slimmer neck and bust, no Adam's apple, softer brow bone
        qx *= 1 - 0.13 * L.female * sm(-0.45, -1.3, y)
        z -= 0.1 * L.female * g2(qx, 0.4, y + 1.3, 0.4) * sm(0.3, 1.0, z)
        z -= 0.04 * L.female * g2(ax - 0.7, 0.6, y - 2.4, 0.25) * sm(0.8, 1.8, z)
      }
      // ears (scale + protrusion)
      if (ax > 2.0 && z < 1.1 && y > 0.5 && y < 3.4) {
        const w = sm(2.0, 2.3, ax) * sm(-0.2, 0.2, 1.1 - z)
        const cx = Math.sign(qx) * 2.55, cy = 1.95
        qx += (qx - cx) * (L.earS - 1) * w + Math.sign(qx) * L.earOut * w
        y += (y - cy) * (L.earS - 1) * w
      }
      // forehead height / cranium
      y += L.foreheadH * 0.9 * sm(2.2, 3.6, y)
      // ageing: slight jowl / softening
      y -= L.age * 0.06 * g2(ax - 1.5, 0.5, y - 0.1, 0.4)
      a[i * 3] = X0 + qx; a[i * 3 + 1] = y; a[i * 3 + 2] = z
    }
    pos.needsUpdate = true
    {
      const headF = sm(-0.9, 0.3, EYE_CY) * (1 - sm(3.7, 4.2, EYE_CY))
      const cx = EYE_CX * (1 + (L.width + J.width) * headF) + (L.eyeSpacing - 1) * 0.5
      this.U.uEyeX.value = cx
      for (const m of this.eyeMeshes) {   // vertices in head object space so the face paint (eyes) continues across the filler
        m.geometry.dispose(); m.geometry = new THREE.SphereGeometry(0.34, 24, 20).translate(X0 + m.userData.side * cx, EYE_CY - 0.04, 1.5)
      }
    }
    this.geo.computeVertexNormals()
    this.geo.computeBoundingSphere()
    this.setLook(L)
  }

  private setLook(L: Look) {
    const U = this.U, v = (k: string, x: number) => { U[k].value = x }
    this.plugMat.color.set(L.skin).multiplyScalar(0.8)
    ;(U.uSkin.value as THREE.Color).set(L.skin); (U.uHair.value as THREE.Color).set(L.hair); (U.uIris.value as THREE.Color).set(L.iris); (U.uLip.value as THREE.Color).set(L.lip_c)
    v('uEyeSpacing', L.eyeSpacing); v('uEyeW', L.eyeW); v('uEyeH', L.eyeH); v('uEyeTilt', L.eyeTilt); v('uEyeLid', L.eyeLid)
    v('uBrowT', L.browT); v('uBrowArch', L.browArch); v('uBrowUp', L.browUp)
    v('uMouthW', L.mouthW); v('uLipUp', L.lipUp); v('uLipLo', L.lipLo)
    v('uBeard', L.beard); v('uGoatee', L.goatee); v('uMust', L.must); v('uSide', L.side)
    v('uAge', L.age); v('uGrey', L.grey); v('uFemale', L.female)
    v('uScarL', L.marks.includes('scar_left_cheek') ? 1 : 0); v('uScarR', L.marks.includes('scar_right_cheek') ? 1 : 0)
    v('uScarBrow', L.marks.includes('scar_eyebrow') ? 1 : 0); v('uMole', L.marks.includes('mole_cheek') ? 1 : 0)
    v('uBirth', L.marks.includes('birthmark_forehead') ? 1 : 0); v('uFreckle', L.marks.includes('freckles') ? 1 : 0)
    v('uWrinkleMark', L.marks.includes('wrinkles') ? 1.6 : 1)
    // hair style
    const st = L.style
    const none = st === 'bald'
    v('uStyle', none ? 0 : 1); v('uHairline', L.hairline); v('uRecede', L.recede)
    v('uBackEdge', st === 'long' ? 0.6 : st === 'buzz' ? 1.9 : 1.55); v('uSideLong', 0)
    this.curtain.visible = st === 'long'
    { const cm = this.curtain.material as THREE.MeshStandardMaterial; cm.color.set(L.hair).lerp(new THREE.Color('#a8a8aa'), 0.7 * L.grey).multiplyScalar(1.5); cm.emissive.set(L.hair).lerp(new THREE.Color('#a8a8aa'), 0.7 * L.grey).multiplyScalar(0.28) }
    this.curtain.scale.set(1 + Math.max(0, L.width) * 0.9, 1, 1)
    v('uThick', ({ buzz: 0.035, short: 0.15, receding: 0.15, swept: 0.19, curly: 0.2, long: 0.2, bun: 0.15 } as any)[st] ?? 0.15)
    v('uFrontVol', st === 'swept' ? 0.3 : st === 'curly' ? 0.15 : 0); v('uCurl', st === 'curly' ? 1 : 0)
    this.hair.visible = !none
    this.bun.visible = st === 'bun'
    ;(this.bun.material as THREE.MeshStandardMaterial).color.set(L.hair).lerp(new THREE.Color('#a8a8aa'), 0.7 * L.grey).multiplyScalar(1.4)
    this.buildGlasses(L.glasses)
  }

  /** glasses fitted to the morphed head: lenses rest on the nose bridge, arms follow the side of the head over the ears */
  private buildGlasses(on: boolean) {
    if (this.glassGroup) { this.extras.remove(this.glassGroup); this.glassGroup = null }
    if (!on) return
    const pos = this.geo.attributes.position as THREE.BufferAttribute
    const ey = 1.8, es = this.U.uEyeX.value as number
    let bridgeZ = -9, browZ = -9
    const side = [1.25, 0.6, 0.0, -0.45].map(() => 0)
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) - X0, y = pos.getY(i), z = pos.getZ(i), ax = Math.abs(x)
      if (ax < 0.16 && Math.abs(y - (ey - 0.02)) < 0.1) bridgeZ = Math.max(bridgeZ, z)
      if (Math.abs(ax - es) < 0.2 && Math.abs(y - (ey + 0.42)) < 0.1) browZ = Math.max(browZ, z)
      if (Math.abs(y - (ey + 0.1)) < 0.14) [1.25, 0.6, 0.0, -0.45].forEach((zs, k) => { if (Math.abs(z - zs) < 0.16) side[k] = Math.max(side[k], ax) })
    }
    const zf = Math.max(bridgeZ + 0.02, browZ + 0.06)   // lens plane: on the bridge, clear of the brow
    const gp = new THREE.Group()
    const frameM = new THREE.MeshPhysicalMaterial({ color: '#1c1d21', roughness: 0.3, metalness: 0.25, clearcoat: 0.7, clearcoatRoughness: 0.2 })
    const lensM = new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.1, roughness: 0.03, clearcoat: 1, depthWrite: false })
    const w = 0.47, h = 0.33, wrap = 0.14
    const hinge: THREE.Vector3[] = []
    for (const s of [-1, 1]) {
      const lens = new THREE.Group(); lens.position.set(X0 + s * es, ey, zf); lens.rotation.y = s * wrap
      const pts: THREE.Vector3[] = []
      for (let k = 0; k < 64; k++) {
        const t = (k / 64) * Math.PI * 2, c = Math.cos(t), sn = Math.sin(t)
        const sx = Math.sign(c) * Math.pow(Math.abs(c), 0.42), sy = Math.sign(sn) * Math.pow(Math.abs(sn), 0.5)
        pts.push(new THREE.Vector3(sx * w, sy * h - (sy < 0 ? 0.04 * (1 - Math.abs(sx)) : 0), 0))
      }
      lens.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 128, 0.026, 8, true), frameM))
      const glass = new THREE.Mesh(new THREE.CircleGeometry(1, 48), lensM); glass.scale.set(w * 0.99, h * 0.99, 1); lens.add(glass)
      gp.add(lens); lens.updateMatrixWorld()
      hinge.push(new THREE.Vector3(s * w, 0.06, 0).applyMatrix4(lens.matrix))
      // arm: hinge -> along the temple -> over the ear -> down behind it
      const hx = hinge[hinge.length - 1]
      const at = (k: number, dy: number, z: number) => new THREE.Vector3(X0 + s * (side[k] + 0.05), ey + dy, z)
      const arm = new THREE.CatmullRomCurve3([hx, new THREE.Vector3(hx.x + s * 0.06, hx.y, hx.z - 0.25), at(0, 0.1, 1.25), at(1, 0.1, 0.6), at(2, 0.12, 0.0), at(3, -0.05, -0.45), new THREE.Vector3(X0 + s * (side[3] - 0.05), ey - 0.45, -0.75)])
      gp.add(new THREE.Mesh(new THREE.TubeGeometry(arm, 48, 0.022, 6, false), frameM))
      const pad = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), lensM); pad.scale.set(0.6, 1.2, 0.6); pad.position.set(X0 + s * 0.16, ey - 0.1, bridgeZ - 0.06); gp.add(pad)
    }
    // bridge over the nose, joining the inner top corners of the two rims
    const rims = gp.children.filter(c => c.type === 'Group')   // [left (s=-1), right (s=1)]
    const inL = new THREE.Vector3(w, 0.08, 0).applyMatrix4(rims[0].matrix), inR = new THREE.Vector3(-w, 0.08, 0).applyMatrix4(rims[1].matrix)
    gp.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([inL, new THREE.Vector3(X0, ey + 0.13, zf + 0.03), inR]), 16, 0.024, 6, false), frameM))
    this.glassGroup = gp; this.extras.add(gp)
  }

  dispose() { this.geo.dispose() }
}

/** fine light/dark strand streaks (greyscale, tinted by the material colour) */
function strandTexture(rx: number, ry: number) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128
  const x = c.getContext('2d')!; x.fillStyle = '#bdbdbd'; x.fillRect(0, 0, 512, 128)
  for (let i = 0; i < 1600; i++) {
    const v = 120 + Math.random() * 135; x.strokeStyle = `rgba(${v},${v},${v},${0.25 + Math.random() * 0.35})`; x.lineWidth = 0.6 + Math.random()
    x.beginPath(); const px = Math.random() * 512; x.moveTo(px, -4); x.bezierCurveTo(px + (Math.random() - 0.5) * 10, 40, px + (Math.random() - 0.5) * 10, 90, px + (Math.random() - 0.5) * 8, 132); x.stroke()
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** long hair: a smooth curtain from the crown, behind the ears, down to the shoulders */
function makeCurtain() {
  const curve = new THREE.CatmullRomCurve3([[1.3, 3.55], [1.95, 3.1], [2.42, 2.55], [2.82, 1.8], [2.8, 0.9], [2.5, -0.2], [2.16, -1.1], [1.86, -1.55]].map(([r, y]) => new THREE.Vector3(r, y, 0)))
  const prof = curve.getPoints(40).map(p => new THREE.Vector2(p.x, p.y))
  const g = new THREE.LatheGeometry(prof, 80, Math.PI * 0.24, Math.PI * 1.52)   // front edges frame the face and cover the ears
  const pos = g.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {   // taper the strands toward the nape and curl the bottom edge slightly inward
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
    const low = THREE.MathUtils.smoothstep(-y, 0.2, 1.6)
    // the front edges tuck in against the temples and cheeks, so no gap shows the ears from the front
    const edge = 1 - THREE.MathUtils.smoothstep(Math.abs(Math.atan2(x, z)), Math.PI * 0.24, Math.PI * 0.24 + 0.5)
    const tuck = 1 - 0.24 * edge * THREE.MathUtils.smoothstep(y, -0.6, 0.6) * (1 - THREE.MathUtils.smoothstep(y, 2.4, 3.1))
    pos.setXYZ(i, x * tuck * (1 - 0.1 * low), y, z * tuck * (1 - 0.18 * low) - 0.05 * low)
  }
  g.computeVertexNormals()
  const t = strandTexture(3, 1)
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#3a2a20', map: t, roughness: 0.75, side: THREE.DoubleSide, emissive: '#000000' }))
  m.position.set(X0, 0, -0.15); m.visible = false
  return m
}

function mulberry(a: number) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
