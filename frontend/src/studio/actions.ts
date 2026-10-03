import { api } from '../api'
import { renderJobs } from './render'
import type { Job } from './render'
import type { Profile } from './rig'

/** Candidate A is the exact witness profile; B–D explore plausible uncertainty around it (seeded morph jitter). */
export async function generateVersion(caseId: string, profile: Profile, parent?: number, changes?: Profile) {
  const base = 100 + Math.floor(Math.random() * 9000)
  const seeds = [0, base, base + 1, base + 2]
  const jobs: Job[] = seeds.map((s, i) => ({ profile, seed: s, jitter: i === 0 ? 0 : 1 }))
  const images = await renderJobs(jobs)
  return api.uploadVersion({ case_id: caseId, profile, images, seeds, parent, changes })
}

export type Final = { profile: Profile; seed: number; jitter: number } | null

export function finalOf(data: any): Final {
  const f = data.case.final_image as string | null
  if (!f) return null
  for (const v of data.versions) for (const c of v.candidates) if (f.endsWith(c.path)) return { profile: v.profile, seed: c.meta.seed ?? 0, jitter: c.meta.jitter ?? 0 }
  return null
}

export async function renderAssets(caseId: string, fin: NonNullable<Final>, items: { kind: string; label: string; profile: Profile; meta?: any }[]) {
  const images = await renderJobs(items.map(i => ({ profile: i.profile, seed: fin.seed, jitter: fin.jitter })))
  const out = []
  for (let i = 0; i < items.length; i++) out.push(await api.uploadAsset({ case_id: caseId, kind: items[i].kind, label: items[i].label, image: images[i], meta: items[i].meta || {}, profile: items[i].profile }))
  return out
}

export const VARIATIONS: Record<string, { label: string; change: (p: Profile) => Profile }> = {
  stubble: { label: 'Light stubble', change: p => ({ ...p, beard: 'stubble' }) },
  beard: { label: 'Full beard', change: p => ({ ...p, beard: 'full' }) },
  mustache: { label: 'Thick mustache', change: p => ({ ...p, mustache: 'thick' }) },
  glasses: { label: 'Glasses', change: p => ({ ...p, glasses: 'glasses' }) },
  shaved: { label: 'Shaved head', change: p => ({ ...p, hair_style: 'bald' }) },
  darker_hair: { label: 'Darker hair', change: p => ({ ...p, hair_color: 'black' }) },
  lighter_hair: { label: 'Lighter hair', change: p => ({ ...p, hair_color: 'blond' }) },
  long_hair: { label: 'Longer hair', change: p => ({ ...p, hair_style: 'long' }) },
}
