import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { FaceRig, loadHeadGeometry, lookFromProfile, X0 } from './rig'
import type { Profile } from './rig'

export const W = 512, H = 640
export const TARGET = new THREE.Vector3(X0, 1.45, 1)

export function addStudioLights(scene: THREE.Scene, renderer?: THREE.WebGLRenderer) {
  if (renderer) {   // soft studio reflections: natural skin sheen and believable lens highlights
    const pm = new THREE.PMREMGenerator(renderer)
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.22
    pm.dispose()
  }
  scene.add(new THREE.HemisphereLight(0xfff4ea, 0x6a5a52, renderer ? 0.7 : 0.95))
  const key = new THREE.DirectionalLight(0xfff1e4, 2.3); key.position.set(4, 5, 9); scene.add(key)
  const fill = new THREE.DirectionalLight(0xd6e4ff, 0.7); fill.position.set(-7, 1.5, 5); scene.add(fill)
  const rim = new THREE.DirectionalLight(0xffffff, 1.1); rim.position.set(-3, 4, -8); scene.add(rim)
}

let ctx: { r: THREE.WebGLRenderer; scene: THREE.Scene; cam: THREE.PerspectiveCamera; rig: FaceRig } | null = null

async function init() {
  if (ctx) return ctx
  const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
  r.setSize(W, H, false); r.setPixelRatio(1)
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#d7dce0')
  addStudioLights(scene, r)
  const cam = new THREE.PerspectiveCamera(26, W / H, 0.1, 100)
  cam.position.set(X0, 1.55, 15.5); cam.lookAt(TARGET)
  const rig = new FaceRig(await loadHeadGeometry())
  scene.add(rig.root)
  ctx = { r, scene, cam, rig }
  return ctx
}

export type Job = { profile: Profile; seed?: number; jitter?: number }

/** Render each job (witness profile → 3D face) to a JPEG data-URL, front view, neutral studio lighting. */
export async function renderJobs(jobs: Job[]): Promise<string[]> {
  const c = await init()
  const out: string[] = []
  for (const j of jobs) {
    c.rig.apply(lookFromProfile(j.profile), j.jitter ?? 0, j.seed ?? 1)
    c.r.render(c.scene, c.cam)
    out.push(c.r.domElement.toDataURL('image/jpeg', 0.93))
    await new Promise(res => setTimeout(res, 0))
  }
  return out
}

// ---- option thumbnails for the interview (each choice rendered on the current face) ----
export type Frame = 'head' | 'eyes' | 'nose' | 'mouth' | 'lower'
const FRAMES: Record<Frame, { y: number; d: number; w: number; h: number }> = {
  head: { y: 1.45, d: 15.2, w: 240, h: 300 },
  eyes: { y: 2.0, d: 3.1, w: 360, h: 180 },
  nose: { y: 1.25, d: 4.3, w: 300, h: 200 },
  mouth: { y: 0.45, d: 4.3, w: 300, h: 200 },
  lower: { y: 0.3, d: 6.5, w: 300, h: 240 },
}

export async function renderThumbs(base: Profile, key: string, ids: string[], frame: Frame): Promise<string[]> {
  const c = await init(), f = FRAMES[frame]
  c.r.setSize(f.w, f.h, false); c.cam.aspect = f.w / f.h
  c.cam.position.set(X0, f.y, 2.3 + f.d); c.cam.lookAt(X0, f.y, 1); c.cam.updateProjectionMatrix()
  const out: string[] = []
  for (const id of ids) {
    c.rig.apply(lookFromProfile({ ...base, [key]: id }), 0, 1)
    c.r.render(c.scene, c.cam)
    out.push(c.r.domElement.toDataURL('image/jpeg', 0.85))
  }
  c.r.setSize(W, H, false); c.cam.aspect = W / H; c.cam.position.set(X0, 1.55, 15.5); c.cam.lookAt(TARGET); c.cam.updateProjectionMatrix()
  return out
}
