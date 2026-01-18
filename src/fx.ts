export type FireworksController = {
  start: () => void
  stop: () => void
  resize: () => void
}

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  hue: number
  size: number
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

export function createFireworks(canvas: HTMLCanvasElement): FireworksController {
  const ctxMaybe = canvas.getContext('2d')
  if (!ctxMaybe) {
    return { start: () => {}, stop: () => {}, resize: () => {} }
  }
  const ctx: CanvasRenderingContext2D = ctxMaybe

  let raf = 0
  let running = false
  let particles: Particle[] = []
  let lastBurstAt = 0

  function resize() {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1))
    const rect = canvas.getBoundingClientRect()
    canvas.width = Math.floor(rect.width * dpr)
    canvas.height = Math.floor(rect.height * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  function burst() {
    const rect = canvas.getBoundingClientRect()
    const cx = rand(rect.width * 0.2, rect.width * 0.8)
    const cy = rand(rect.height * 0.15, rect.height * 0.6)
    const hue = rand(300, 360)
    const count = Math.floor(rand(26, 46))
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2)
      const sp = rand(1.2, 4.4)
      particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0,
        maxLife: rand(36, 60),
        hue: hue + rand(-18, 18),
        size: rand(2.2, 3.6),
      })
    }
  }

  function step() {
    if (!running) return
    raf = requestAnimationFrame(step)

    const rect = canvas.getBoundingClientRect()
    ctx.clearRect(0, 0, rect.width, rect.height)

    const t = performance.now()
    if (t - lastBurstAt > 380) {
      burst()
      lastBurstAt = t
    }

    particles = particles.filter((p) => p.life < p.maxLife)
    for (const p of particles) {
      p.life += 1
      p.vy += 0.06
      p.x += p.vx
      p.y += p.vy
      p.vx *= 0.985
      p.vy *= 0.985
      const alpha = 1 - p.life / p.maxLife
      ctx.fillStyle = `hsla(${p.hue}, 90%, 70%, ${alpha})`
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  function start() {
    if (running) return
    running = true
    lastBurstAt = 0
    particles = []
    resize()
    step()
  }

  function stop() {
    running = false
    cancelAnimationFrame(raf)
    raf = 0
    particles = []
    const rect = canvas.getBoundingClientRect()
    ctx.clearRect(0, 0, rect.width, rect.height)
  }

  return { start, stop, resize }
}
