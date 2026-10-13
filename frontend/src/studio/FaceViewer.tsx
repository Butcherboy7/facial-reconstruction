import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { FaceRig, loadHeadGeometry, lookFromProfile } from './rig'
import type { Profile } from './rig'
import { TARGET, addStudioLights } from './render'

export const VIEWS: Record<string, [number, number]> = { Front: [0, 0], 'Left 3/4': [-40, 0], Left: [-90, 0], 'Right 3/4': [40, 0], Right: [90, 0], Back: [180, 0] }

function Lights() {
  const { scene, gl } = useThree()
  useEffect(() => { const n = scene.children.length; addStudioLights(scene, gl); const added = scene.children.slice(n); return () => { added.forEach(a => scene.remove(a)); scene.environment?.dispose(); scene.environment = null } }, [scene, gl])
  return null
}

function Rig({ profile, seed, jitter }: { profile: Profile; seed: number; jitter: number }) {
  const [rig, setRig] = useState<FaceRig | null>(null)
  useEffect(() => { let on = true; loadHeadGeometry().then(g => { if (on) setRig(new FaceRig(g)) }); return () => { on = false } }, [])
  useEffect(() => { rig?.apply(lookFromProfile(profile), jitter, seed) }, [rig, profile, seed, jitter])
  return rig ? <primitive object={rig.root} /> : null
}

// dev close-ups: ?zr=8 camera radius, ?ty=0.5 aim height (e.g. the mouth)
const DEV = new URLSearchParams(location.search)
const DEV_TARGET = DEV.get('ty') ? new THREE.Vector3(TARGET.x, Number(DEV.get('ty')), TARGET.z) : TARGET

function Controls({ view, auto }: { view: string; auto: boolean }) {
  const ref = useRef<any>(null)
  const { camera } = useThree()
  useEffect(() => {
    const qv = DEV.get('v')
    const [az] = VIEWS[qv && VIEWS[qv] ? qv : view] || [0, 0], a = (az * Math.PI) / 180
    const r = Number(DEV.get('zr')) || 15.5
    camera.position.set(DEV_TARGET.x + Math.sin(a) * r, DEV_TARGET.y + 1.55 - TARGET.y, DEV_TARGET.z + Math.cos(a) * r)
    camera.lookAt(DEV_TARGET); ref.current?.update()
  }, [view, camera])
  return <OrbitControls ref={ref} target={DEV_TARGET} enablePan={false} minDistance={DEV.get('zr') ? 2 : 7} maxDistance={26} autoRotate={auto} autoRotateSpeed={2.2} />
}

export default function FaceViewer({ profile, seed = 1, jitter = 0, view = 'Front', auto = false, className = '' }:
  { profile: Profile; seed?: number; jitter?: number; view?: string; auto?: boolean; className?: string }) {
  return (
    <div className={className} style={{ background: 'radial-gradient(circle at 50% 38%, #eceff1, #cfd5d9)' }}>
      <Canvas camera={{ fov: 26, position: [TARGET.x, 1.55, 15.5], near: 0.1, far: 100 }} dpr={[1, 1.5]} gl={{ antialias: true }}>
        <Lights />
        <Rig profile={profile} seed={seed} jitter={jitter} />
        <Controls view={view} auto={auto} />
      </Canvas>
    </div>
  )
}
