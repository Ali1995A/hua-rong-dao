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

export function createBaseBlocks(): Block[] {
  return [
    { id: 'cc', kind: 'main', w: 2, h: 2, x: 2, y: 1 },
    { id: 'h1', kind: 'h', w: 1, h: 2, x: 0, y: 1 },
    { id: 'v2', kind: 'v', w: 2, h: 1, x: 0, y: 0 },
    { id: 'v4', kind: 'v', w: 2, h: 1, x: 2, y: 0 },
    { id: 'v1', kind: 'v', w: 2, h: 1, x: 0, y: 3 },
    { id: 'v3', kind: 'v', w: 2, h: 1, x: 2, y: 3 },
    { id: 's1', kind: 's', w: 1, h: 1, x: 4, y: 0 },
    { id: 's2', kind: 's', w: 1, h: 1, x: 4, y: 3 },
    { id: 's3', kind: 's', w: 1, h: 1, x: 1, y: 1 },
    { id: 's4', kind: 's', w: 1, h: 1, x: 1, y: 2 },
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

function desiredSolutionRange(difficulty: number, gameIndex: number): { min: number; max: number } {
  const d = Math.min(5, Math.max(1, Math.floor(difficulty)))
  const g = Math.max(0, Math.floor(gameIndex))
  if (d === 1) {
    const min = 4 + Math.min(2, g)
    const max = 8 + Math.min(4, g)
    return { min, max }
  }
  if (d === 2) return { min: 12, max: 22 }
  if (d === 3) return { min: 20, max: 32 }
  if (d === 4) return { min: 32, max: 40 }
  return { min: 40, max: 46 }
}

function ccDistanceToGoal(blocks: Block[]): number {
  const cc = blocks.find((b) => b.id === 'cc')
  if (!cc) return 999
  return Math.abs(GOAL.x - cc.x) + Math.abs(GOAL.y - cc.y)
}

function minGoalDistanceForDifficulty(difficulty: number): number {
  const d = Math.min(5, Math.max(1, Math.floor(difficulty)))
  return d === 1 ? 1 : d === 2 ? 2 : d === 3 ? 3 : d === 4 ? 4 : 4
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
  if (clamped === 1) return 18 + Math.min(10, Math.max(0, gameIndex) * 2)
  const base = [0, 26, 44, 62, 86][clamped - 1]!
  const extra = Math.min(70, Math.max(0, gameIndex) * 3)
  return base + extra
}

export function generatePuzzle(params: {
  difficulty: number
  gameIndex: number
  seed: number
}): { blocks: Block[]; seed: number; steps: number } {
  const { difficulty, gameIndex } = params
  const seed = params.seed >>> 0
  const desired = desiredSolutionRange(difficulty, gameIndex)
  const baseSteps = shuffleStepsForDifficulty(difficulty, gameIndex)

  const d = Math.min(5, Math.max(1, Math.floor(difficulty)))
  const minDist = minGoalDistanceForDifficulty(d)
  const strictMin = d <= 4

  const maxAttempts = d === 1 ? 18 : d === 2 ? 40 : d === 3 ? 52 : d === 4 ? 64 : 220
  let bestBlocks = createBaseBlocks()
  let bestSteps = baseSteps
  let bestError = Number.POSITIVE_INFINITY
  let bestLen = -1
  let bestDist = -1
  let bestAnyBlocks = createBaseBlocks()
  let bestAnyLen = Number.POSITIVE_INFINITY
  let bestAnyDist = -1

  const targetLen = Math.round((desired.min + desired.max) / 2)
  const solveBudget = d === 1 ? 22000 : d === 2 ? 70000 : d === 3 ? 110000 : d === 4 ? 150000 : 200000

  function scramble(blocks: Block[], rnd: () => number, steps: number): void {
    let lastMove: Move | null = null
    for (let i = 0; i < Math.max(1, steps); i++) {
      const all = getPossibleMoves(blocks)
      if (all.length === 0) break
      const prev = lastMove
      const filtered: Move[] =
        prev === null
          ? all
          : all.filter((m) => !(m.id === prev.id && m.dir === oppositeDir(prev.dir)))
      const chosen: Move = pickOne(filtered.length > 0 ? filtered : all, rnd)
      tryApplyMove(blocks, chosen)
      lastMove = chosen
    }
  }

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const rnd = mulberry32((seed + attempt * 0x9e3779b9) >>> 0)
    const blocks = createBaseBlocks()
    const steps = baseSteps + Math.floor(rnd() * (d === 5 ? 64 : 14)) - (d === 5 ? 32 : 7)
    scramble(blocks, rnd, steps)

    if (isSolved(blocks)) continue
    const dist = ccDistanceToGoal(blocks)
    if (dist < minDist) continue

    const sol = findShortestSolution(blocks, { maxNodes: solveBudget, maxDepth: 220 })
    if (!sol) continue
    const len = sol.length

    if (len < bestAnyLen || (len === bestAnyLen && dist > bestAnyDist)) {
      bestAnyLen = len
      bestAnyDist = dist
      bestAnyBlocks = blocks
    }

    if (len >= desired.min && len <= desired.max) return { blocks, seed, steps }
    if (strictMin && len < desired.min) continue

    if (d === 5) {
      const betterHard = len > bestLen || (len === bestLen && dist > bestDist)
      if (betterHard) {
        bestLen = len
        bestDist = dist
        bestBlocks = blocks
        bestSteps = steps
      }
      continue
    }

    const err = Math.abs(len - targetLen)
    const better =
      err < bestError ||
      (err === bestError && dist > bestDist) ||
      (err === bestError && dist === bestDist && len > bestLen)
    if (better) {
      bestError = err
      bestLen = len
      bestDist = dist
      bestBlocks = blocks
      bestSteps = steps
    }
  }

  if (d === 5 && bestLen > 0 && bestLen < desired.min) {
    const rnd = mulberry32((seed ^ 0xa5a5a5a5) >>> 0)
    for (let round = 0; round < 120; round++) {
      const fallback = createBaseBlocks()
      scramble(fallback, rnd, baseSteps + 120 + round * 8)
      if (isSolved(fallback)) continue
      if (ccDistanceToGoal(fallback) < minDist) continue
      const sol = findShortestSolution(fallback, { maxNodes: solveBudget, maxDepth: 240 })
      if (!sol) continue
      const len = sol.length
      if (len >= desired.min) {
        bestBlocks = fallback
        bestSteps = baseSteps + 120 + round * 8
        bestLen = len
        break
      }
      if (len > bestLen) {
        bestBlocks = fallback
        bestSteps = baseSteps + 120 + round * 8
        bestLen = len
      }
    }
  }

  if (!isSolved(bestBlocks) && ccDistanceToGoal(bestBlocks) >= minDist) {
    return { blocks: bestBlocks, seed, steps: bestSteps }
  }

  if (!strictMin && !isSolved(bestAnyBlocks) && ccDistanceToGoal(bestAnyBlocks) >= minDist) {
    return { blocks: bestAnyBlocks, seed, steps: baseSteps }
  }

  // Hard fallback: keep scrambling until it is not trivial for this difficulty.
  const rnd = mulberry32((seed + 0x2c1b3c6d) >>> 0)
  for (let round = 0; round < 44; round++) {
    const fallback = createBaseBlocks()
    const extra = (d === 1 ? 6 : d === 2 ? 18 : d === 3 ? 30 : d === 4 ? 42 : 58) + round * 3
    scramble(fallback, rnd, baseSteps + extra)
    if (isSolved(fallback)) continue
    if (ccDistanceToGoal(fallback) < minDist) continue
    const sol = findShortestSolution(fallback, { maxNodes: solveBudget, maxDepth: 240 })
    if (sol && (!strictMin || sol.length >= desired.min)) return { blocks: fallback, seed, steps: baseSteps + extra }
  }

  // Absolute last resort: return something not solved and not near goal.
  const last = createBaseBlocks()
  scramble(last, rnd, baseSteps + 80)
  if (isSolved(last)) scramble(last, rnd, 40)
  for (let i = 0; i < 44; i++) {
    if (isSolved(last) || ccDistanceToGoal(last) < minDist) scramble(last, rnd, 18)
    const sol = findShortestSolution(last, { maxNodes: solveBudget, maxDepth: 240 })
    if (sol && (!strictMin || sol.length >= desired.min)) break
    scramble(last, rnd, 26)
  }
  return { blocks: last, seed, steps: baseSteps + 80 }
}

export function findShortestSolution(
  start: Block[],
  params?: { maxNodes?: number; maxDepth?: number },
): Move[] | null {
  if (isSolved(start)) return []

  const maxNodes = Math.max(1, params?.maxNodes ?? 35000)
  const maxDepth = Math.max(1, params?.maxDepth ?? 140)

  const startKey = blocksToKey(start)

  type Parent = { prev: string; move: Move; depth: number }
  const parent = new Map<string, Parent>()
  const visited = new Set<string>()
  visited.add(startKey)

  const queue: { key: string; blocks: Block[]; depth: number }[] = [
    { key: startKey, blocks: cloneBlocks(start), depth: 0 },
  ]
  let qi = 0

  function scoreMove(m: Move, blocks: Block[]): number {
    const b = blocks.find((x) => x.id === m.id)
    if (!b) return 0
    const isCc = m.id === 'cc'
    const toward =
      m.dir === 'right'
        ? 3
        : m.dir === 'down'
          ? 1
          : m.dir === 'left'
            ? -1
            : -2
    const closerX = isCc ? Math.sign(GOAL.x - b.x) : 0
    const closerY = isCc ? Math.sign(GOAL.y - b.y) : 0
    const dirScore =
      (m.dir === 'right' ? 1 : m.dir === 'left' ? -1 : 0) * closerX +
      (m.dir === 'down' ? 1 : m.dir === 'up' ? -1 : 0) * closerY
    return (isCc ? 100 : 0) + toward * 2 + dirScore * 5
  }

  while (qi < queue.length && visited.size < maxNodes) {
    const cur = queue[qi++]!
    if (cur.depth >= maxDepth) continue

    const moves = getPossibleMoves(cur.blocks)
    moves.sort((a, b) => scoreMove(b, cur.blocks) - scoreMove(a, cur.blocks))

    for (const move of moves) {
      const nextBlocks = cloneBlocks(cur.blocks)
      if (!tryApplyMove(nextBlocks, move)) continue
      const k = blocksToKey(nextBlocks)
      if (visited.has(k)) continue
      visited.add(k)
      parent.set(k, { prev: cur.key, move, depth: cur.depth + 1 })
      if (isSolved(nextBlocks)) {
        const path: Move[] = []
        let at = k
        while (at !== startKey) {
          const p = parent.get(at)
          if (!p) break
          path.push(p.move)
          at = p.prev
        }
        path.reverse()
        return path
      }
      queue.push({ key: k, blocks: nextBlocks, depth: cur.depth + 1 })
    }
  }

  return null
}
