import * as THREE from 'three'
import { X0 } from './rig'
import type { Look } from './rig'

// A basic, generic head built from simple shapes: no scan, no holes. Every witness answer changes a shape or a colour.
const CY = 1.65, RY0 = 2.3, RZ = 2.0, RX0 = 1.55
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const sm = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t) }
const gauss = (d: number, s: number) => Math.exp(-((d / s) ** 2))

type P = { rx: number; ry: number; taper: number; chinZ: number; cheek: number; chinPt: number }

function mulberry(a: number) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }

function headPoint(dx: number, dy: number, dz: number, m: number, p: P, out: THREE.Vector3) {
  let x = p.rx * dx * m, y = CY + p.ry * dy * m, z = RZ * dz * m
  const t = sm(1.7, 0.0, y)
  x *= 1 - (p.taper + p.chinPt * sm(0.6, -0.5, y)) * t
  if (dz > 0) z += p.chinZ * t * dz
  x *= 1 + p.cheek * gauss(y - 1.1, 0.7)
  out.set(X0 + x, y, z)
}

function surf(x: number, y: number, p: P) {
  const t = sm(1.7, 0.0, y)
  const rx = p.rx * (1 - p.taper * t) * (1 + p.cheek * gauss(y - 1.1, 0.7))
  return RZ * Math.sqrt(Math.max(0.04, 1 - (x / rx) ** 2 - ((y - CY) / p.ry) ** 2)) + (p.chinZ * t * 0.5)
}

/** partial ellipsoid shell following the head surface (used for the head itself, hair caps and beard) */
function shell(p: P, m: number, o: { phiStart?: number; phiLen?: number; thetaStart?: number; thetaLen?: number; tilt?: number } = {}) {
  const g = new THREE.SphereGeometry(1, 56, 40, o.phiStart ?? 0, o.phiLen ?? Math.PI * 2, o.thetaStart ?? 0, o.thetaLen ?? Math.PI)
  const pos = g.attributes.position as THREE.BufferAttribute, v = new THREE.Vector3(), tl = o.tilt ?? 0
  const c = Math.cos(tl), s = Math.sin(tl)
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
    headPoint(x, y * c - z * s, y * s + z * c, m, p, v); pos.setXYZ(i, v.x, v.y, v.z)
  }
  g.computeVertexNormals()
  return g
}

export class BasicRig {
  root = new THREE.Group()
  private body = new THREE.Group()

  constructor() { this.root.add(this.body) }

  private clear() {
    this.body.traverse((o: any) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose?.() })
    this.root.remove(this.body); this.body = new THREE.Group(); this.root.add(this.body)
  }

  apply(L: Look, jitter = 0, seed = 1) {
    this.clear()
    const r = mulberry(seed), j = (a: number) => (jitter ? (r() - 0.5) * 2 * a * jitter : 0)
    const skin = new THREE.Color(L.skin).lerp(new THREE.Color('#8a8a8a'), 0.06 * L.age)
    const hairC = new THREE.Color(L.hair).lerp(new THREE.Color('#b9b9bc'), 0.8 * L.grey)
    const mat = (c: THREE.ColorRepresentation, rough = 0.78, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: rough, ...extra })
    const skinM = mat(skin, 0.8), darkSkin = skin.clone().multiplyScalar(0.8)
    const add = (g: THREE.BufferGeometry, m: THREE.Material, pos: [number, number, number], scale: [number, number, number] = [1, 1, 1], rot: [number, number, number] = [0, 0, 0]) => {
      const me = new THREE.Mesh(g, m); me.position.set(...pos); me.scale.set(...scale); me.rotation.set(...rot); this.body.add(me); return me
    }
    const sph = new THREE.SphereGeometry(1, 24, 18)

    const w = L.width + j(0.1), jaw = L.jaw + j(0.12)
    const p: P = {
      rx: RX0 * (1 + w * 0.8 + 0.04), ry: RY0 * (1 + (L.length + j(0.08)) * 1.3),
      taper: clamp(0.5 - jaw * 1.8, 0.1, 0.75), chinZ: L.chinZ * 0.5 + j(0.08), cheek: (L.cheek + j(0.1)) * 0.35 + L.bone * 0.1, chinPt: L.chinPoint * 0.6,
    }
    const eyeY = 1.98 + L.foreheadH * 0.05

    // head, neck, shoulders
    this.body.add(new THREE.Mesh(shell(p, 1), skinM))
    add(new THREE.CylinderGeometry(0.85, 1.0, 1.6, 24), skinM, [X0, -0.5, -0.15])
    add(sph, skinM, [X0, -1.7, -0.2], [3.0, 1.1, 1.5])
    // ears
    for (const s of [-1, 1]) {
      const ex = X0 + s * (p.rx * 0.97 + 0.02)
      add(sph, skinM, [ex, 1.75, -0.1], [0.16, 0.5 * L.earS, 0.34 * L.earS], [0, s * L.earOut * 0.6, s * -0.12])
      add(sph, mat(darkSkin), [ex + s * 0.03, 1.75, -0.05], [0.07, 0.3 * L.earS, 0.18 * L.earS])
    }

    // nose
    const nz = surf(0, 1.2, p), nw = L.noseW + j(0.15), nl = L.noseL + j(0.1)
    add(sph, skinM, [X0, 1.6, surf(0, 1.6, p) + 0.1], [0.15 * (1 + nw * 0.4), 0.42, 0.1 + L.noseBridge])
    add(sph, skinM, [X0, 1.2 + L.noseUp * 0.1 - L.noseHook * 0.06, nz + 0.26 + nl * 0.9], [0.23 * (1 + nw), 0.2, 0.27])
    for (const s of [-1, 1]) {
      add(sph, skinM, [X0 + s * 0.26 * (1 + nw), 1.12, nz + 0.1], [0.14 * (1 + nw * 0.5), 0.13, 0.15])
      add(sph, mat('#3b2418'), [X0 + s * 0.12, 1.03 + L.noseUp * 0.08, nz + 0.4 + nl * 0.9], [0.055, 0.035, 0.05])
    }

    // eyes (flat shapes laid on the head surface)
    const sp = L.eyeSpacing, ehw = 0.3 * L.eyeW, ehh = clamp(0.135 * L.eyeH, 0.06, 0.2)
    const circ = new THREE.CircleGeometry(1, 40)
    for (const s of [-1, 1]) {
      const cx = 0.62 * sp, z0 = surf(cx, eyeY, p) + 0.03
      const g = new THREE.Group(); g.position.set(X0 + s * cx, eyeY, z0); g.rotation.y = s * (cx / p.rx) * 0.5; g.rotation.z = -s * L.eyeTilt
      const put = (m: THREE.Material, sc: [number, number], pos: [number, number, number]) => { const me = new THREE.Mesh(circ, m); me.scale.set(sc[0], sc[1], 1); me.position.set(...pos); g.add(me) }
      const nm = (c: THREE.ColorRepresentation, o = 0, op = 1) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2 - o, polygonOffsetUnits: -2 - o, transparent: op < 1, opacity: op })
      put(nm('#9a6b5a', 0, 0.35), [ehw * 1.35, ehh * 2.3], [0, ehh * 0.4, -0.004])                         // soft socket shadow
      put(nm('#1c1210', 0.5), [ehw + 0.03 + (L.female ? 0.02 : 0), ehh + 0.03 + (L.female ? 0.02 : 0)], [0, 0, 0])   // lid outline / lashes
      put(nm('#f1eeea', 1), [ehw, ehh], [0, 0, 0.004])
      const ir = Math.min(0.115, ehh * 0.98)
      put(nm(L.iris, 2), [ir, ir], [0, -ehh * 0.02, 0.008])
      put(nm('#050303', 3), [ir * 0.45, ir * 0.45], [0, -ehh * 0.02, 0.012])
      put(nm('#ffffff', 4), [ir * 0.2, ir * 0.2], [-ir * 0.35, ir * 0.35, 0.016])
      if (L.eyeLid > 0) put(nm(skin, 5), [ehw * 1.08, ehh * (0.35 + 0.15 * L.eyeLid)], [0, ehh * 0.8, 0.02])  // hooded lid
      this.body.add(g)
    }

    // brows
    const bc = new THREE.Color(L.hair).multiplyScalar(0.8)
    for (const s of [-1, 1]) {
      const inn = 0.22 * sp, out = 1.18 * sp, by = 2.5 + L.browUp
      const pts = [0, 0.5, 1].map(t => { const x = inn + (out - inn) * t; return new THREE.Vector3(X0 + s * x, by + L.browArch * 0.035 * Math.sin(t * Math.PI) - 0.1 * t * t, surf(x, by, p) + 0.04) })
      const th = clamp(0.034 + 0.02 * L.browT, 0.015, 0.1)
      this.body.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, th, 8, false), mat(bc, 0.9)))
    }

    // mouth
    const my = 0.5, mz = surf(0, my, p) + 0.07, mw = 0.46 * L.mouthW
    add(sph, mat(L.lip_c, 0.55), [X0, my + 0.07, mz], [mw, 0.075 * L.lipUp, 0.13])
    add(sph, mat(L.lip_c, 0.55), [X0, my - 0.07, mz], [mw * 0.92, 0.1 * L.lipLo, 0.13])
    add(new THREE.BoxGeometry(1, 0.025, 0.05), mat('#3a1a18'), [X0, my, mz + 0.1], [mw * 1.9, 1, 1])

    // beard / mustache / sideburns
    const hc = new THREE.Color(L.hair).lerp(new THREE.Color('#b9b9bc'), 0.6 * L.grey)
    if (L.beard > 0.05) {
      const dens = L.beard
      const bm = mat(hc, 0.95, { transparent: dens < 0.9, opacity: dens < 0.5 ? 0.3 : dens < 0.9 ? 0.6 : 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })
      if (L.goatee > 0.5) this.body.add(new THREE.Mesh(shell(p, 1.03, { phiStart: Math.PI / 2 - 0.5, phiLen: 1.0, thetaStart: 2.25, thetaLen: 0.8 }), bm))
      else this.body.add(new THREE.Mesh(shell(p, 1.03, { phiStart: Math.PI / 2 - 1.15, phiLen: 2.3, thetaStart: 2.05, thetaLen: Math.PI - 2.05 }), bm))
    }
    if (L.must > 0.05) {
      const mm = mat(hc, 0.95)
      for (const s of [-1, 1]) add(sph, mm, [X0 + s * mw * 0.5, my + 0.3, mz + 0.03], [mw * 0.56, 0.06 + 0.04 * L.must, 0.1], [0, 0, -s * 0.15])
    }
    if (L.side > 0.05) for (const s of [-1, 1]) add(sph, mat(hc, 0.95), [X0 + s * (p.rx * 0.93), 1.95 - L.side * 0.2, 0.55], [0.07, 0.35 + L.side * 0.3, 0.3])

    // marks
    const pink = mat('#c47f78', 0.6), dk = mat('#2b1a14', 0.7)
    if (L.marks.includes('scar_left_cheek')) add(new THREE.BoxGeometry(0.03, 0.42, 0.02), pink, [X0 + 0.95, 0.95, surf(0.95, 0.95, p) + 0.04], [1, 1, 1], [0, 0.3, 0.5])
    if (L.marks.includes('scar_right_cheek')) add(new THREE.BoxGeometry(0.03, 0.42, 0.02), pink, [X0 - 0.95, 0.95, surf(0.95, 0.95, p) + 0.04], [1, 1, 1], [0, -0.3, -0.5])
    if (L.marks.includes('scar_eyebrow')) add(new THREE.BoxGeometry(0.03, 0.3, 0.02), pink, [X0 - 0.75, 2.5, surf(0.75, 2.5, p) + 0.06], [1, 1, 1], [0, -0.2, 0.3])
    if (L.marks.includes('mole_cheek')) add(sph, dk, [X0 + 1.05, 0.65, surf(1.05, 0.65, p) + 0.02], [0.05, 0.05, 0.03])
    if (L.marks.includes('birthmark_forehead')) add(sph, mat(skin.clone().multiplyScalar(0.62), 0.8), [X0 + 0.5, 3.0, surf(0.5, 3.0, p) + 0.01], [0.2, 0.15, 0.03])
    if (L.marks.includes('freckles')) for (let i = 0; i < 18; i++) { const s = i % 2 ? 1 : -1, fx = 0.2 + (i * 0.137) % 0.85, fy = 1.15 + ((i * 0.211) % 0.45); add(sph, mat(skin.clone().multiplyScalar(0.72), 0.8), [X0 + s * fx, fy, surf(fx, fy, p) + 0.01], [0.035, 0.035, 0.02]) }
    if (L.marks.includes('wrinkles') || L.age > 0.5) {
      const lm = mat(skin.clone().multiplyScalar(0.7), 0.9, { transparent: true, opacity: 0.45 })
      for (let k = 0; k < 3; k++) add(new THREE.BoxGeometry(1.4 - k * 0.2, 0.02, 0.02), lm, [X0, 2.85 + k * 0.17, surf(0, 2.85 + k * 0.17, p) + 0.02])
      for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.02, 0.5, 0.02), lm, [X0 + s * 0.65, 0.85, surf(0.65, 0.85, p) + 0.03], [1, 1, 1], [0, 0, s * 0.3])
    }

    // hair
    const st = L.style
    if (st !== 'bald') {
      const hm = mat(hairC, 0.9, { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })
      const a = clamp(0.55 + L.hairline * 0.6 - L.recede * 0.25, 0.3, 0.95)
      const m = st === 'buzz' ? 1.015 : st === 'swept' ? 1.06 : st === 'curly' ? 1.03 : 1.04
      const tl = st === 'long' ? 1.85 : 1.45
      this.body.add(new THREE.Mesh(shell(p, m, { thetaLen: tl, tilt: -a }), hm))
      if (st === 'swept') add(sph, hm, [X0 - 0.3, 3.5, 1.05], [1.1, 0.35, 0.8], [0.4, 0, 0.35])
      if (st === 'curly') for (let i = 0; i < 90; i++) {
        const th = r() * 1.25, ph = r() * Math.PI * 2, v = new THREE.Vector3()
        headPoint(Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph), 1.07, p, v)
        if (v.z < 0.9 && v.y < 3.2) continue
        add(sph, hm, [v.x, v.y, v.z], [0.2, 0.2, 0.2])
      }
      if (st === 'long') {
        add(sph, hm, [X0, 0.6, -1.4], [1.8, 2.4, 0.75])
        for (const s of [-1, 1]) add(sph, hm, [X0 + s * 1.75, 0.9, -0.2], [0.34, 1.7, 0.95])
      }
      if (st === 'bun') add(sph, hm, [X0, 3.85, -1.1], [0.65, 0.65, 0.65])
    }

    // glasses
    if (L.glasses) {
      const fm = mat('#1b1c20', 0.35, { metalness: 0.4 }), lens = new THREE.MeshStandardMaterial({ color: '#cfe3ee', transparent: true, opacity: 0.16, roughness: 0.05 })
      const zf = surf(0.62 * sp, eyeY, p) + 0.14
      for (const s of [-1, 1]) {
        const cx = X0 + s * 0.62 * sp
        add(new THREE.TorusGeometry(0.46, 0.04, 8, 36), fm, [cx, eyeY, zf], [1.05, 0.78, 1])
        add(circ, lens, [cx, eyeY, zf - 0.01], [0.48, 0.36, 1])
        add(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 6), fm, [cx + s * 0.6, eyeY + 0.05, zf - 0.75], [1, 1, 1], [Math.PI / 2, 0, 0])
      }
      add(new THREE.BoxGeometry(0.3, 0.05, 0.05), fm, [X0, eyeY + 0.05, zf])
    }
  }
}
