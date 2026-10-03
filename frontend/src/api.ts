export type Opt = { id: string; label: string; phrase: string; p: Record<string, number | string> }
export type Question = { key: string; q: string; kind: 'chips' | 'sketch' | 'swatch' | 'age' | 'multi'; options?: Opt[] }
export type Step = { id: string; title: string; questions: Question[] }
export type Profile = Record<string, any>

async function j(path: string, init?: RequestInit) {
  const r = await fetch(path, { headers: { 'content-type': 'application/json' }, ...init })
  if (!r.ok) {
    let m = r.statusText
    try { m = (await r.json()).detail || m } catch { /* ignore */ }
    throw new Error(m)
  }
  return r.json()
}
const post = (p: string, b: any) => j(p, { method: 'POST', body: JSON.stringify(b) })

export const api = {
  schema: (): Promise<{ steps: Step[]; required: string[] }> => j('/api/schema'),
  status: (): Promise<any> => j('/api/status'),
  cases: (): Promise<any[]> => j('/api/cases'),
  createCase: (b: any) => post('/api/cases', b),
  detail: (id: string): Promise<any> => j(`/api/cases/${id}`),
  saveProfile: (id: string, profile: Profile) => j(`/api/cases/${id}/profile`, { method: 'PUT', body: JSON.stringify({ profile }) }),
  generate: (case_id: string, profile: Profile) => post('/api/generate-face', { case_id, profile }),
  refine: (case_id: string, base_version: number, changes: Profile) => post('/api/refine-face', { case_id, base_version, changes }),
  select: (case_id: string, version_id: number, index: number) => post('/api/select-reconstruction', { case_id, version_id, index }),
  uploadVersion: (b: any) => post('/api/upload-version', b),
  previewPhoto: (b: any) => post('/api/preview-photo', b),
  uploadAsset: (b: any) => post('/api/upload-asset', b),
  sketch: (case_id: string) => post('/api/generate-sketch', { case_id }),
  model3d: (case_id: string) => post('/api/generate-3d', { case_id }),
  age: (case_id: string, ages: number[]) => post('/api/age-simulate', { case_id, ages }),
  variation: (case_id: string, variations: string[]) => post('/api/appearance-variation', { case_id, variations }),
  setFinal: (case_id: string, path: string) => post('/api/set-final', { case_id, path }),
  search: (case_id: string) => post('/api/search-database', { case_id }),
  refs: (): Promise<any[]> => j('/api/references'),
}
