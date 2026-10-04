// Consistency rules shared by the interview, the 3D face and the variations,
// so answers that cannot go together are never asked, shown or rendered.
import type { Schema } from '../sketch'
import type { Profile } from './rig'

const FACIAL_HAIR = ['beard', 'mustache', 'sideburns']

/** questions that do not apply to this person are hidden and not required */
export function hiddenKeys(p: Profile): Set<string> {
  const h = new Set<string>()
  if (p.sex === 'female') FACIAL_HAIR.forEach(k => h.add(k))
  if (p.hair_style === 'bald') h.add('hair_color')
  if (p.hair_style === 'long' || p.hair_style === 'bun') h.add('sideburns')
  return h
}

export function adaptSchema(s: Schema, p: Profile): Schema {
  const h = hiddenKeys(p)
  const steps = s.steps.map(st => ({ ...st, questions: st.questions.filter(q => !h.has(q.key)) })).filter(st => st.questions.length)
  return { ...s, steps, required: s.required.filter(k => !h.has(k)) }
}

/** keep the stored profile coherent after every change */
export function normalize(p: Profile): Profile {
  const n = { ...p }
  if (n.sex === 'female') { n.beard = 'none'; n.mustache = 'none'; n.sideburns = 'none' }
  if (n.hair_style === 'long' || n.hair_style === 'bun') { if (n.sideburns && n.sideburns !== 'none') n.sideburns = 'none' }
  return n
}

type Var = { label: string; change: (p: Profile) => Profile; applies: (p: Profile) => boolean }
const male = (p: Profile) => p.sex !== 'female'
const hasHair = (p: Profile) => p.hair_style && p.hair_style !== 'bald'

export const VARIATIONS: Record<string, Var> = {
  stubble: { label: 'Light stubble', change: p => ({ ...p, beard: 'stubble' }), applies: p => male(p) && p.beard !== 'stubble' },
  beard: { label: 'Full beard', change: p => ({ ...p, beard: 'full' }), applies: p => male(p) && p.beard !== 'full' },
  clean: { label: 'Clean-shaven', change: p => ({ ...p, beard: 'none', mustache: 'none' }), applies: p => male(p) && ((p.beard && p.beard !== 'none') || (p.mustache && p.mustache !== 'none')) },
  mustache: { label: 'Thick mustache', change: p => ({ ...p, mustache: 'thick' }), applies: p => male(p) && p.mustache !== 'thick' },
  glasses: { label: 'Glasses', change: p => ({ ...p, glasses: 'glasses' }), applies: p => p.glasses !== 'glasses' },
  no_glasses: { label: 'Without glasses', change: p => ({ ...p, glasses: 'none' }), applies: p => p.glasses === 'glasses' },
  shaved: { label: 'Shaved head', change: p => ({ ...p, hair_style: 'bald' }), applies: p => male(p) && p.hair_style !== 'bald' },
  short_hair: { label: 'Short hair', change: p => ({ ...p, hair_style: 'short' }), applies: p => p.hair_style !== 'short' && (!male(p) || p.hair_style === 'bald' || p.hair_style === 'long') },
  long_hair: { label: 'Longer hair', change: p => normalize({ ...p, hair_style: 'long' }), applies: p => p.hair_style !== 'long' },
  tied_back: { label: 'Hair tied back', change: p => normalize({ ...p, hair_style: 'bun' }), applies: p => !male(p) && p.hair_style !== 'bun' },
  darker_hair: { label: 'Darker hair', change: p => ({ ...p, hair_color: 'black' }), applies: p => p.hair_color !== 'black' && p.hair_color !== 'dark_brown' },
  lighter_hair: { label: 'Lighter hair', change: p => ({ ...p, hair_color: 'blond' }), applies: p => p.hair_color !== 'blond' && p.hair_color !== 'grey' },
}

/** variations that make a visible difference for this person (hair colour needs hair) */
export function variationsFor(p: Profile) {
  return Object.entries(VARIATIONS).filter(([k, v]) => v.applies(p) && (!k.endsWith('_hair') || k === 'long_hair' || k === 'short_hair' || hasHair(p)))
}
