import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { FaceRig, loadHeadGeometry, lookFromProfile } from './rig'
import type { Profile } from './rig'
import { TARGET, addStudioLights } from './render'

export const VIEWS: Record<string, [number, number]> = { Front: [0, 0], 'Left 3/4': [-40, 0], Left: [-90, 0], 'Right 3/4': [40, 0], Right: [90, 0], Back: [180, 0] }

function Lights() {
  const { scene } = useThree()
  useEffect(() => { const n = scene.children.length; addStudioLights(scene); const added = scene.children.slice(n); return () => { added.forEach(a => scene.remove(a)) } }, [scene])
  return null
}

function Rig({ profile, seed, jitter }: { profile: Profile; seed: number; jitter: number }) {
  const [rig, setRig] = useState<FaceRig | null>(null)
  useEffect(() => { let on = true; loadHeadGeometry().then(g => { if (on) setRig(new FaceRig(g)) }); return () => { on = false } }, [])
  useEffect(() => { rig?.apply(lookFromProfile(profile), jitter, seed) }, [rig, profile, seed, jitter])
  return rig ? <primitive object={rig.root} /> : null
}

function Controls({ view, auto }: { view: string; auto: boolean }) {
  const ref = useRef<any>(null)
  const { camera } = useThree()
  useEffect(() => {
    const qv = new URLSearchParams(location.search).get('v')
    const [az] = VIEWS[qv && VIEWS[qv] ? qv : view] || [0, 0], r = 15.5, a = (az * Math.PI) / 180
    camera.position.set(TARGET.x + Math.sin(a) * r, 1.55, TARGET.z + Math.cos(a) * r - 0)
    camera.lookAt(TARGET); ref.current?.update()
  }, [view, camera])
  return <OrbitControls ref={ref} target={TARGET} enablePan={false} minDistance={7} maxDistance={26} autoRotate={auto} autoRotateSpeed={2.2} />
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
