import type { Block, BlockId } from './hrd'

export type PersistedStateV1 = {
  v: 1
  remember: boolean
  difficulty: number
  gameIndex: number
  seed: number
  moves: number
  blocks: Block[]
  startedAt: number
}

const KEY = 'hua-rong-dao:v1'

export function loadState(): PersistedStateV1 | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedStateV1
    if (!parsed || parsed.v !== 1) return null
    if (!Array.isArray(parsed.blocks)) return null
    if (typeof parsed.difficulty !== 'number') return null
    if (typeof parsed.gameIndex !== 'number') return null
    if (typeof parsed.seed !== 'number') return null
    if (typeof parsed.moves !== 'number') return null
    return parsed
  } catch {
    return null
  }
}

export function saveState(state: PersistedStateV1): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // ignore
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}

export function isValidBlockId(id: string): id is BlockId {
  return (
    id === 'cc' ||
    id === 'v1' ||
    id === 'v2' ||
    id === 'v3' ||
    id === 'v4' ||
    id === 'h1' ||
    id === 's1' ||
    id === 's2' ||
    id === 's3' ||
    id === 's4'
  )
}

