import { api } from '../api'
import { renderJobs } from './render'
import type { Job } from './render'
import type { Profile } from './rig'

/** Candidate A is the exact witness profile; B–D explore plausible uncertainty around it (seeded morph jitter). */
export async function generateVersion(caseId: string, profile: Profile, parent?: number, changes?: Profile) {
  const seeds = [0]
  const jobs: Job[] = seeds.map((s, i) => ({ profile, seed: s, jitter: i === 0 ? 0 : 1 }))
  const images = await renderJobs(jobs)
  return api.uploadVersion({ case_id: caseId, profile, images, seeds, parent, changes })
}

export type Final = { profile: Profile; seed: number; jitter: number } | null

export function finalOf(data: any): Final {
  const f = data.case.final_image as string | null
  if (!f) return null
  for (const v of data.versions) for (const c of v.candidates) if (f.endsWith(c.path)) return { profile: normalize(v.profile), seed: c.meta.seed ?? 0, jitter: c.meta.jitter ?? 0 }
  const v = data.versions.at(-1)   // final image is a variation / age render: work from the latest saved face
  return v ? { profile: normalize(v.profile), seed: 0, jitter: 0 } : null
}

export async function renderAssets(caseId: string, fin: NonNullable<Final>, items: { kind: string; label: string; profile: Profile; meta?: any }[]) {
  const images = await renderJobs(items.map(i => ({ profile: i.profile, seed: fin.seed, jitter: fin.jitter })))
  const out = []
  for (let i = 0; i < items.length; i++) out.push(await api.uploadAsset({ case_id: caseId, kind: items[i].kind, label: items[i].label, image: images[i], meta: items[i].meta || {}, profile: items[i].profile }))
  return out
}

export { VARIATIONS } from './logic'
import { normalize } from './logic'
