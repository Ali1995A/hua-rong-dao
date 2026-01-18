import './style.css'
import { ensureAudio, playApplause, playMoveTick } from './audio'
import {
  GOAL,
  GRID_COLS,
  GRID_ROWS,
  blocksToKey,
  generatePuzzle,
  findShortestSolution,
  getPossibleDirs,
  getPossibleMoves,
  isSolved,
  tryApplyMove,
  type Block,
  type BlockId,
  type Direction,
  type Move,
} from './hrd'
import { createFireworks } from './fx'
import { clearState, loadState, saveState, type PersistedStateV1 } from './storage'

type UiRefs = {
  board: HTMLDivElement
  fxCanvas: HTMLCanvasElement
  winOverlay: HTMLDivElement
  rotateOverlay: HTMLDivElement
  btnTiaoguoRotate: HTMLButtonElement
  hintArrow: HTMLDivElement
  movesEl: HTMLDivElement
  gameEl: HTMLDivElement
  nanduValueEl: HTMLDivElement
  btnKaishi: HTMLButtonElement
  btnChongzhi: HTMLButtonElement
  btnTishi: HTMLButtonElement
  btnJizhu: HTMLButtonElement
  btnNanduDown: HTMLButtonElement
  btnNanduUp: HTMLButtonElement
  btnXiaYiJu: HTMLButtonElement
}

type AppState = {
  difficulty: number
  remember: boolean
  gameIndex: number
  seed: number
  startedAt: number
  moves: number
  blocks: Block[]
  startKey: string
  celebrating: boolean
}

const DEFAULT_DIFFICULTY = 1

function clampDifficulty(n: number): number {
  return Math.min(5, Math.max(1, Math.floor(n)))
}

function newSeed(): number {
  const a = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0
  return (a + (((performance.now() * 1000) | 0) >>> 0)) >>> 0
}

function createLayout(app: HTMLElement): UiRefs {
  app.innerHTML = `
    <div class="root">
      <div class="topbar">
        <div class="cc-logo" aria-label="CC logo">CC</div>
        <div class="chips">
          <div class="chip" aria-label="ju">
            <div class="chip-icon">◌</div>
            <div class="chip-value" id="gameValue">1</div>
          </div>
          <div class="chip" aria-label="bu">
            <div class="chip-icon">↔</div>
            <div class="chip-value" id="movesValue">0</div>
          </div>
        </div>
      </div>

      <div class="main">
        <div class="stage">
          <div class="board-wrap">
            <div id="board" class="board" aria-label="hua rong dao">
              <canvas id="fxCanvas" class="fx-canvas"></canvas>
              <div class="grid" aria-hidden="true"></div>
              <div class="goal" aria-hidden="true"></div>
              <div id="hintArrow" class="hint-arrow hidden" aria-hidden="true"></div>
            </div>
          </div>
        </div>

        <div class="panel">
          <button id="btnKaishi" class="btn btn-primary" type="button" data-icon="▶">
            kai shi
          </button>
          <button id="btnChongzhi" class="btn" type="button" data-icon="↺">
            chong zhi
          </button>
          <button id="btnTishi" class="btn" type="button" data-icon="★">
            ti shi
          </button>

          <div class="nandu">
            <div class="nandu-title">nan du</div>
            <div class="nandu-row">
              <button id="btnNanduDown" class="btn btn-small" type="button" aria-label="nandu down">−</button>
              <div id="nanduValue" class="nandu-value" aria-label="nandu value">1</div>
              <button id="btnNanduUp" class="btn btn-small" type="button" aria-label="nandu up">＋</button>
            </div>
            <div class="nandu-dots" aria-hidden="true">
              <span class="dot" data-dot="1"></span>
              <span class="dot" data-dot="2"></span>
              <span class="dot" data-dot="3"></span>
              <span class="dot" data-dot="4"></span>
              <span class="dot" data-dot="5"></span>
            </div>
          </div>

          <button id="btnJizhu" class="btn btn-toggle" type="button" aria-pressed="false" data-icon="☁">
            ji zhu
          </button>
        </div>
      </div>

          <div id="rotateOverlay" class="overlay overlay-rotate hidden" role="dialog" aria-label="rotate">
        <div class="overlay-card">
          <div class="overlay-big">↻</div>
          <div class="overlay-sub">qing heng ping</div>
          <button id="btnTiaoguoRotate" class="btn btn-small btn-ghost" type="button">tiao guo</button>
        </div>
      </div>

      <div id="winOverlay" class="overlay overlay-win hidden" role="dialog" aria-label="win">
        <div class="overlay-card win-card">
          <div class="win-title">ya!</div>
          <div class="win-sub">hao bang</div>
          <button id="btnXiaYiJu" class="btn btn-primary" type="button" data-icon="➜">xia yi ju</button>
        </div>
      </div>
    </div>
  `

  return {
    board: app.querySelector('#board')!,
    fxCanvas: app.querySelector('#fxCanvas')!,
    winOverlay: app.querySelector('#winOverlay')!,
    rotateOverlay: app.querySelector('#rotateOverlay')!,
    btnTiaoguoRotate: app.querySelector('#btnTiaoguoRotate')!,
    hintArrow: app.querySelector('#hintArrow')!,
    movesEl: app.querySelector('#movesValue')!,
    gameEl: app.querySelector('#gameValue')!,
    nanduValueEl: app.querySelector('#nanduValue')!,
    btnKaishi: app.querySelector('#btnKaishi')!,
    btnChongzhi: app.querySelector('#btnChongzhi')!,
    btnTishi: app.querySelector('#btnTishi')!,
    btnJizhu: app.querySelector('#btnJizhu')!,
    btnNanduDown: app.querySelector('#btnNanduDown')!,
    btnNanduUp: app.querySelector('#btnNanduUp')!,
    btnXiaYiJu: app.querySelector('#btnXiaYiJu')!,
  }
}

function setDotsActive(level: number): void {
  document.querySelectorAll<HTMLElement>('.dot').forEach((el) => {
    const d = Number(el.dataset.dot)
    el.classList.toggle('dot-on', d <= level)
  })
}

function blockClass(kind: Block['kind']): string {
  switch (kind) {
    case 'main':
      return 'block block-main'
    case 'v':
      return 'block block-v'
    case 'h':
      return 'block block-h'
    case 's':
      return 'block block-s'
  }
}

function applyBlockVars(el: HTMLElement, block: Block, cell: number): void {
  el.style.setProperty('--w', String(block.w))
  el.style.setProperty('--h', String(block.h))
  el.style.setProperty('--tx', `${block.x * cell}px`)
  el.style.setProperty('--ty', `${block.y * cell}px`)
  el.style.setProperty('--ox', `0px`)
  el.style.setProperty('--oy', `0px`)
}

function setBoardSizeVars(board: HTMLElement): { cell: number; gx: number; gy: number } {
  const parent = board.parentElement ?? board
  const rect = parent.getBoundingClientRect()
  const padding = 8
  const cell = Math.max(
    44,
    Math.floor(Math.min((rect.width - padding * 2) / GRID_COLS, (rect.height - padding * 2) / GRID_ROWS)),
  )
  board.style.setProperty('--cell', `${cell}px`)
  board.style.setProperty('--bw', `${cell * GRID_COLS}px`)
  board.style.setProperty('--bh', `${cell * GRID_ROWS}px`)
  const gx = Math.floor((rect.width - cell * GRID_COLS) / 2)
  const gy = Math.floor((rect.height - cell * GRID_ROWS) / 2)
  const safeGx = Math.max(0, gx)
  const safeGy = Math.max(0, gy)
  board.style.setProperty('--gx', `${safeGx}px`)
  board.style.setProperty('--gy', `${safeGy}px`)
  board.style.setProperty('--goalx', `${safeGx + GOAL.x * cell}px`)
  board.style.setProperty('--goaly', `${safeGy + GOAL.y * cell}px`)
  return { cell, gx: safeGx, gy: safeGy }
}

function shouldShowRotateOverlay(): boolean {
  const bySize = window.innerWidth < window.innerHeight
  try {
    return window.matchMedia('(orientation: portrait)').matches || bySize
  } catch {
    return bySize
  }
}

function moveToDir(dx: number, dy: number): Direction | null {
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return null
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left'
  return dy > 0 ? 'down' : 'up'
}

function showHintArrow(
  refs: UiRefs,
  move: Move,
  cell: number,
  gx: number,
  gy: number,
  blocks: Block[],
): void {
  const block = blocks.find((b) => b.id === move.id)
  if (!block) return
  const arrow = refs.hintArrow

  const baseX = gx + block.x * cell
  const baseY = gy + block.y * cell
  const w = block.w * cell
  const h = block.h * cell

  let x = baseX
  let y = baseY
  let rot = 0

  switch (move.dir) {
    case 'up':
      x = baseX + w / 2
      y = baseY + 8
      rot = -90
      break
    case 'down':
      x = baseX + w / 2
      y = baseY + h - 8
      rot = 90
      break
    case 'left':
      x = baseX + 8
      y = baseY + h / 2
      rot = 180
      break
    case 'right':
      x = baseX + w - 8
      y = baseY + h / 2
      rot = 0
      break
  }

  arrow.style.setProperty('--ax', `${x}px`)
  arrow.style.setProperty('--ay', `${y}px`)
  arrow.style.setProperty('--ar', `${rot}deg`)
  arrow.classList.remove('hidden')
}

function hideHintArrow(refs: UiRefs): void {
  refs.hintArrow.classList.add('hidden')
}

function persistIfNeeded(state: AppState): void {
  if (!state.remember) return
  const payload: PersistedStateV1 = {
    v: 1,
    remember: state.remember,
    difficulty: state.difficulty,
    gameIndex: state.gameIndex,
    seed: state.seed,
    moves: state.moves,
    blocks: state.blocks,
    startedAt: state.startedAt,
  }
  saveState(payload)
}

function loadInitialState(): AppState {
  const saved = loadState()
  if (saved && saved.remember && Array.isArray(saved.blocks) && saved.blocks.length === 10) {
    if (isSolved(saved.blocks)) {
      const seed = newSeed()
      const difficulty = clampDifficulty(saved.difficulty)
      const gameIndex = Math.max(0, Math.floor(saved.gameIndex))
      const { blocks } = generatePuzzle({ difficulty, gameIndex, seed })
      return {
        difficulty,
        remember: true,
        gameIndex,
        seed,
        startedAt: Date.now(),
        moves: 0,
        blocks,
        startKey: blocksToKey(blocks),
        celebrating: false,
      }
    }

    const { blocks: initialBlocks } = generatePuzzle({
      difficulty: clampDifficulty(saved.difficulty),
      gameIndex: Math.max(0, Math.floor(saved.gameIndex)),
      seed: saved.seed >>> 0,
    })
    const startKey = blocksToKey(initialBlocks)
    return {
      difficulty: clampDifficulty(saved.difficulty),
      remember: true,
      gameIndex: Math.max(0, Math.floor(saved.gameIndex)),
      seed: saved.seed >>> 0,
      startedAt: typeof saved.startedAt === 'number' ? saved.startedAt : Date.now(),
      moves: Math.max(0, Math.floor(saved.moves)),
      blocks: saved.blocks,
      startKey,
      celebrating: false,
    }
  }

  const seed = newSeed()
  const difficulty = DEFAULT_DIFFICULTY
  const { blocks } = generatePuzzle({ difficulty, gameIndex: 0, seed })
  return {
    difficulty,
    remember: false,
    gameIndex: 0,
    seed,
    startedAt: Date.now(),
    moves: 0,
    blocks,
    startKey: blocksToKey(blocks),
    celebrating: false,
  }
}

function main(): void {
  const app = document.querySelector<HTMLDivElement>('#app')
  if (!app) return

  const refs = createLayout(app)
  const fireworks = createFireworks(refs.fxCanvas)

  let state: AppState = loadInitialState()
  for (let i = 0; i < 6 && isSolved(state.blocks); i++) {
    const seed = newSeed()
    const { blocks } = generatePuzzle({ difficulty: state.difficulty, gameIndex: state.gameIndex, seed })
    state = {
      ...state,
      seed,
      startedAt: Date.now(),
      moves: 0,
      blocks,
      startKey: blocksToKey(blocks),
      celebrating: false,
    }
  }
  let rotateDismissed = false

  const blockEls = new Map<BlockId, HTMLDivElement>()
  let cell = 80
  let gx = 0
  let gy = 0

  function syncTopUi(): void {
    refs.movesEl.textContent = String(state.moves)
    refs.gameEl.textContent = String(state.gameIndex + 1)
    refs.nanduValueEl.textContent = String(state.difficulty)
    setDotsActive(state.difficulty)
    refs.btnJizhu.setAttribute('aria-pressed', String(state.remember))
    refs.btnJizhu.classList.toggle('btn-toggle-on', state.remember)
  }

  function rebuildBlocks(): void {
    for (const el of blockEls.values()) el.remove()
    blockEls.clear()

    for (const block of state.blocks) {
      const el = document.createElement('div')
      el.className = blockClass(block.kind)
      el.dataset.id = block.id
      el.setAttribute('role', 'button')
      el.setAttribute('aria-label', block.id)
      applyBlockVars(el, block, cell)
      refs.board.appendChild(el)
      blockEls.set(block.id, el)
    }
  }

  function updateBlockPositions(): void {
    for (const block of state.blocks) {
      const el = blockEls.get(block.id)
      if (!el) continue
      applyBlockVars(el, block, cell)
      el.classList.toggle('block-movable', getPossibleDirs(state.blocks, block.id).length > 0)
    }
  }

  function resize(): void {
    const sized = setBoardSizeVars(refs.board)
    cell = sized.cell
    gx = sized.gx
    gy = sized.gy
    updateBlockPositions()
    fireworks.resize()
    const showRotate = shouldShowRotateOverlay() && !rotateDismissed && !state.celebrating
    refs.rotateOverlay.classList.toggle('hidden', !showRotate)
  }

  function setCelebrating(on: boolean): void {
    state.celebrating = on
    refs.winOverlay.classList.toggle('hidden', !on)
    if (on) {
      fireworks.start()
    } else {
      fireworks.stop()
    }
  }

  function win(): void {
    if (state.celebrating) return
    setCelebrating(true)
    playApplause()
    persistIfNeeded(state)
  }

  function afterMove(): void {
    syncTopUi()
    updateBlockPositions()
    persistIfNeeded(state)
    if (isSolved(state.blocks)) win()
  }

  function newPuzzle(): void {
    const seed = newSeed()
    const { blocks } = generatePuzzle({ difficulty: state.difficulty, gameIndex: state.gameIndex, seed })
    state.seed = seed
    state.startedAt = Date.now()
    state.moves = 0
    state.blocks = blocks
    state.startKey = blocksToKey(blocks)
    setCelebrating(false)
    rebuildBlocks()
    afterMove()
  }

  function resetPuzzle(): void {
    if (blocksToKey(state.blocks) === state.startKey) return
    const { blocks } = generatePuzzle({
      difficulty: state.difficulty,
      gameIndex: state.gameIndex,
      seed: state.seed,
    })
    state.startedAt = Date.now()
    state.moves = 0
    state.blocks = blocks
    state.startKey = blocksToKey(blocks)
    setCelebrating(false)
    rebuildBlocks()
    afterMove()
  }

  function nextPuzzle(): void {
    state.gameIndex += 1
    setCelebrating(false)
    newPuzzle()
  }

  function setDifficulty(level: number): void {
    const next = clampDifficulty(level)
    if (next === state.difficulty) return
    state.difficulty = next
    syncTopUi()
    newPuzzle()
  }

  function setRemember(on: boolean): void {
    state.remember = on
    syncTopUi()
    if (!on) clearState()
    persistIfNeeded(state)
  }

  function runHint(): void {
    if (state.celebrating) return
    const solution = findShortestSolution(state.blocks, { maxNodes: 22000, maxDepth: 90 })
    const next = solution && solution.length > 0 ? solution[0] : null
    const fallback = getPossibleMoves(state.blocks).find((m) => m.id === 'cc') ?? getPossibleMoves(state.blocks)[0]
    const move = next ?? fallback
    if (!move) return

    hideHintArrow(refs)
    for (const el of blockEls.values()) el.classList.remove('block-hint')

    const el = blockEls.get(move.id)
    if (el) el.classList.add('block-hint')
    showHintArrow(refs, move, cell, gx, gy, state.blocks)
    window.setTimeout(() => {
      for (const el of blockEls.values()) el.classList.remove('block-hint')
      hideHintArrow(refs)
    }, 1400)
  }

  refs.btnKaishi.addEventListener('click', () => void ensureAudio().then(newPuzzle))
  refs.btnChongzhi.addEventListener('click', () => void ensureAudio().then(resetPuzzle))
  refs.btnTishi.addEventListener('click', () => void ensureAudio().then(runHint))
  refs.btnNanduDown.addEventListener('click', () => void ensureAudio().then(() => setDifficulty(state.difficulty - 1)))
  refs.btnNanduUp.addEventListener('click', () => void ensureAudio().then(() => setDifficulty(state.difficulty + 1)))
  refs.btnJizhu.addEventListener('click', () => void ensureAudio().then(() => setRemember(!state.remember)))
  refs.btnXiaYiJu.addEventListener('click', () => void ensureAudio().then(nextPuzzle))
  refs.btnTiaoguoRotate.addEventListener('click', () => {
    rotateDismissed = true
    resize()
  })
  refs.winOverlay.addEventListener('click', (e) => {
    const target = e.target as HTMLElement | null
    if (target?.closest('button')) return
    void ensureAudio().then(nextPuzzle)
  })

  window.addEventListener('resize', resize)
  window.addEventListener('orientationchange', resize)

  let drag:
    | null
    | {
        id: BlockId
        pointerId: number
        startClientX: number
        startClientY: number
        startedAt: number
        moved: boolean
      } = null

  function getBlockIdFromTarget(target: EventTarget | null): BlockId | null {
    const el = target instanceof HTMLElement ? target.closest<HTMLElement>('[data-id]') : null
    const id = el?.dataset.id
    if (!id) return null
    return id as BlockId
  }

  function startDrag(id: BlockId, pointerId: number, clientX: number, clientY: number) {
    if (state.celebrating) return
    const el = blockEls.get(id)
    if (!el) return
    void ensureAudio()
    drag = {
      id,
      pointerId,
      startClientX: clientX,
      startClientY: clientY,
      startedAt: performance.now(),
      moved: false,
    }
    el.classList.add('block-dragging')
    hideHintArrow(refs)
  }

  function moveDrag(pointerId: number, clientX: number, clientY: number): void {
    if (!drag) return
    if (pointerId !== drag.pointerId) return
    const el = blockEls.get(drag.id)
    if (!el) return

    const dx = clientX - drag.startClientX
    const dy = clientY - drag.startClientY
    if (Math.abs(dx) + Math.abs(dy) > 6) drag.moved = true

    el.style.setProperty('--ox', `${dx}px`)
    el.style.setProperty('--oy', `${dy}px`)
  }

  function clearDrag(el: HTMLElement): void {
    el.style.setProperty('--ox', `0px`)
    el.style.setProperty('--oy', `0px`)
    el.classList.remove('block-dragging')
  }

  function endDrag(pointerId: number, clientX: number, clientY: number): void {
    if (!drag) return
    if (pointerId !== drag.pointerId) return
    const el = blockEls.get(drag.id)
    if (!el) {
      drag = null
      return
    }

    const dx = clientX - drag.startClientX
    const dy = clientY - drag.startClientY
    const timeMs = performance.now() - drag.startedAt
    clearDrag(el)

    const threshold = Math.max(10, cell * 0.22)
    const dir = Math.abs(dx) > threshold || Math.abs(dy) > threshold ? moveToDir(dx, dy) : null

    if (dir) {
      const ok = tryApplyMove(state.blocks, { id: drag.id, dir })
      if (ok) {
        state.moves += 1
        playMoveTick()
        afterMove()
      } else {
        updateBlockPositions()
      }
      drag = null
      return
    }

    if (!drag.moved && timeMs < 500) {
      const dirs = getPossibleDirs(state.blocks, drag.id)
      if (dirs.length === 1) {
        const ok = tryApplyMove(state.blocks, { id: drag.id, dir: dirs[0]! })
        if (ok) {
          state.moves += 1
          playMoveTick()
          afterMove()
        }
      } else {
        runHint()
      }
    }

    drag = null
  }

  const supportsPointer = 'PointerEvent' in window

  if (supportsPointer) {
    refs.board.addEventListener('pointerdown', (e) => {
      const id = getBlockIdFromTarget(e.target)
      if (!id) return
      if (state.celebrating) return
      const el = blockEls.get(id)
      if (!el) return
      void ensureAudio()
      e.preventDefault()
      el.setPointerCapture(e.pointerId)
      startDrag(id, e.pointerId, e.clientX, e.clientY)
    })

    refs.board.addEventListener('pointermove', (e) => {
      if (!drag) return
      if (e.pointerId !== drag.pointerId) return
      e.preventDefault()
      moveDrag(e.pointerId, e.clientX, e.clientY)
    })

    refs.board.addEventListener('pointerup', (e) => {
      if (!drag) return
      if (e.pointerId !== drag.pointerId) return
      e.preventDefault()
      endDrag(e.pointerId, e.clientX, e.clientY)
    })

    refs.board.addEventListener('pointercancel', (e) => {
      if (!drag) return
      if (e.pointerId !== drag.pointerId) return
      const el = blockEls.get(drag.id)
      if (el) clearDrag(el)
      drag = null
    })
  } else {
    const opts: AddEventListenerOptions = { passive: false }
    refs.board.addEventListener(
      'touchstart',
      (e) => {
        if (state.celebrating) return
        const t = e.changedTouches[0]
        if (!t) return
        const id = getBlockIdFromTarget(e.target)
        if (!id) return
        e.preventDefault()
        startDrag(id, t.identifier, t.clientX, t.clientY)
      },
      opts,
    )

    refs.board.addEventListener(
      'touchmove',
      (e) => {
        if (!drag) return
        const t = Array.from(e.touches).find((tt) => tt.identifier === drag!.pointerId)
        if (!t) return
        e.preventDefault()
        moveDrag(t.identifier, t.clientX, t.clientY)
      },
      opts,
    )

    refs.board.addEventListener(
      'touchend',
      (e) => {
        if (!drag) return
        const t = Array.from(e.changedTouches).find((tt) => tt.identifier === drag!.pointerId)
        if (!t) return
        e.preventDefault()
        endDrag(t.identifier, t.clientX, t.clientY)
      },
      opts,
    )

    refs.board.addEventListener(
      'touchcancel',
      () => {
        if (!drag) return
        const el = blockEls.get(drag.id)
        if (el) clearDrag(el)
        drag = null
      },
      opts,
    )
  }

  syncTopUi()
  resize()
  requestAnimationFrame(resize)
  window.setTimeout(resize, 300)
  rebuildBlocks()
  afterMove()
}

main()
