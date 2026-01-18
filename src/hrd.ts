export type Direction = 'up' | 'down' | 'left' | 'right'

export type BlockKind = 'main' | 'v' | 'h' | 's'

export type BlockId =
  | 'cc'
  | 'v1'
  | 'v2'
  | 'v3'
  | 'v4'
  | 'h1'
  | 's1'
  | 's2'
  | 's3'
  | 's4'

export interface Block {
  id: BlockId
  kind: BlockKind
  w: number
  h: number
  x: number
  y: number
}

export interface Move {
  id: BlockId
  dir: Direction
}

export const GRID_COLS = 5
export const GRID_ROWS = 4

export const GOAL = { x: 3, y: 1 } as const

export function createStartBlocks(): Block[] {
  return [
    { id: 'cc', kind: 'main', w: 2, h: 2, x: 0, y: 1 },
    { id: 'v1', kind: 'v', w: 2, h: 1, x: 0, y: 3 },
    { id: 'v2', kind: 'v', w: 2, h: 1, x: 0, y: 0 },
    { id: 'v3', kind: 'v', w: 2, h: 1, x: 2, y: 3 },
    { id: 'v4', kind: 'v', w: 2, h: 1, x: 2, y: 0 },
    { id: 'h1', kind: 'h', w: 1, h: 2, x: 2, y: 1 },
    { id: 's1', kind: 's', w: 1, h: 1, x: 3, y: 2 },
    { id: 's2', kind: 's', w: 1, h: 1, x: 3, y: 1 },
    { id: 's3', kind: 's', w: 1, h: 1, x: 4, y: 2 },
    { id: 's4', kind: 's', w: 1, h: 1, x: 4, y: 1 },
  ]
}

export function cloneBlocks(blocks: Block[]): Block[] {
  return blocks.map((b) => ({ ...b }))
}

export function isSolved(blocks: Block[]): boolean {
  const cc = blocks.find((b) => b.id === 'cc')
  return !!cc && cc.x === GOAL.x && cc.y === GOAL.y
}

export function blocksToKey(blocks: Block[]): string {
  const sorted = [...blocks].sort((a, b) => (a.id < b.id ? -1 : 1))
  return sorted.map((b) => `${b.id}:${b.x},${b.y}`).join('|')
}

function buildGrid(blocks: Block[]): (BlockId | null)[][] {
  const grid: (BlockId | null)[][] = Array.from({ length: GRID_ROWS }, () =>
    Array.from({ length: GRID_COLS }, () => null),
  )
  for (const block of blocks) {
    for (let dy = 0; dy < block.h; dy++) {
      for (let dx = 0; dx < block.w; dx++) {
        const x = block.x + dx
        const y = block.y + dy
        if (x < 0 || x >= GRID_COLS || y < 0 || y >= GRID_ROWS) {
          throw new Error(`block out of bounds: ${block.id}`)
        }
        if (grid[y]![x] !== null) {
          throw new Error(`block overlap: ${block.id}`)
        }
        grid[y]![x] = block.id
      }
    }
  }
  return grid
}

function oppositeDir(dir: Direction): Direction {
  switch (dir) {
    case 'up':
      return 'down'
    case 'down':
      return 'up'
    case 'left':
      return 'right'
    case 'right':
      return 'left'
  }
}

function canMove(block: Block, dir: Direction, grid: (BlockId | null)[][]): boolean {
  if (dir === 'left') {
    if (block.x === 0) return false
    for (let dy = 0; dy < block.h; dy++) {
      if (grid[block.y + dy]![block.x - 1] !== null) return false
    }
    return true
  }
  if (dir === 'right') {
    if (block.x + block.w >= GRID_COLS) return false
    for (let dy = 0; dy < block.h; dy++) {
      if (grid[block.y + dy]![block.x + block.w] !== null) return false
    }
    return true
  }
  if (dir === 'up') {
    if (block.y === 0) return false
    for (let dx = 0; dx < block.w; dx++) {
      if (grid[block.y - 1]![block.x + dx] !== null) return false
    }
    return true
  }
  if (block.y + block.h >= GRID_ROWS) return false
  for (let dx = 0; dx < block.w; dx++) {
    if (grid[block.y + block.h]![block.x + dx] !== null) return false
  }
  return true
}

export function getPossibleMoves(blocks: Block[]): Move[] {
  const grid = buildGrid(blocks)
  const moves: Move[] = []
  for (const block of blocks) {
    ;(['up', 'down', 'left', 'right'] as const).forEach((dir) => {
      if (canMove(block, dir, grid)) moves.push({ id: block.id, dir })
    })
  }
  return moves
}

export function getPossibleDirs(blocks: Block[], id: BlockId): Direction[] {
  return getPossibleMoves(blocks)
    .filter((m) => m.id === id)
    .map((m) => m.dir)
}

export function tryApplyMove(blocks: Block[], move: Move): boolean {
  const grid = buildGrid(blocks)
  const block = blocks.find((b) => b.id === move.id)
  if (!block) return false
  if (!canMove(block, move.dir, grid)) return false
  switch (move.dir) {
    case 'left':
      block.x -= 1
      return true
    case 'right':
      block.x += 1
      return true
    case 'up':
      block.y -= 1
      return true
    case 'down':
      block.y += 1
      return true
  }
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pickOne<T>(items: T[], rnd: () => number): T {
  return items[Math.floor(rnd() * items.length)]!
}

function shuffleStepsForDifficulty(difficulty: number, gameIndex: number): number {
  const clamped = Math.min(5, Math.max(1, Math.floor(difficulty)))
  const base = [1, 12, 26, 42, 62][clamped - 1]!
  const growth = clamped === 1 ? 1 : 3
  const cap = clamped === 1 ? 20 : 60
  const extra = Math.min(cap, Math.max(0, gameIndex) * growth)
  return base + extra
}

export function generatePuzzle(params: {
  difficulty: number
  gameIndex: number
  seed: number
}): { blocks: Block[]; seed: number; steps: number } {
  const { difficulty, gameIndex } = params
  const seed = params.seed >>> 0
  const rnd = mulberry32(seed)

  const blocks = createStartBlocks()
  const steps = shuffleStepsForDifficulty(difficulty, gameIndex)

  let lastMove: Move | null = null
  let tries = 0

  for (let i = 0; i < steps; i++) {
    const all = getPossibleMoves(blocks)
    const prev = lastMove
    const filtered: Move[] =
      prev === null
        ? all
        : all.filter((m) => !(m.id === prev.id && m.dir === oppositeDir(prev.dir)))
    const chosen: Move = pickOne(filtered.length > 0 ? filtered : all, rnd)
    tryApplyMove(blocks, chosen)
    lastMove = chosen
    tries++
    if (tries > steps * 10) break
  }

  if (isSolved(blocks)) {
    for (let i = 0; i < 8; i++) {
      const chosen = pickOne(getPossibleMoves(blocks), rnd)
      tryApplyMove(blocks, chosen)
      if (!isSolved(blocks)) break
    }
  }

  return { blocks, seed, steps }
}
