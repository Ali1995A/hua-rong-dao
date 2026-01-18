type AudioReady = {
  ctx: AudioContext
}

let audioReady: AudioReady | null = null

export async function ensureAudio(): Promise<void> {
  if (audioReady) {
    if (audioReady.ctx.state === 'suspended') await audioReady.ctx.resume()
    return
  }
  const Ctx = window.AudioContext || (window as any).webkitAudioContext
  if (!Ctx) return
  const ctx: AudioContext = new Ctx()
  audioReady = { ctx }
  if (ctx.state === 'suspended') await ctx.resume()
}

function now(): number {
  return audioReady?.ctx.currentTime ?? 0
}

export function playMoveTick(): void {
  if (!audioReady) return
  const t0 = now()
  const ctx = audioReady.ctx
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = 'triangle'
  osc.frequency.setValueAtTime(520, t0)
  osc.frequency.exponentialRampToValueAtTime(320, t0 + 0.05)

  gain.gain.setValueAtTime(0.0001, t0)
  gain.gain.exponentialRampToValueAtTime(0.08, t0 + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.06)

  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.start(t0)
  osc.stop(t0 + 0.07)
}

function makeNoiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const len = Math.max(1, Math.floor(seconds * ctx.sampleRate))
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * 0.8
  return buf
}

function playClap(at: number): void {
  if (!audioReady) return
  const ctx = audioReady.ctx
  const src = ctx.createBufferSource()
  src.buffer = makeNoiseBuffer(ctx, 0.06)

  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 1400
  bp.Q.value = 1.2

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(0.7, at + 0.005)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.08)

  src.connect(bp)
  bp.connect(gain)
  gain.connect(ctx.destination)
  src.start(at)
  src.stop(at + 0.1)
}

export function playApplause(): void {
  if (!audioReady) return
  const t0 = now()
  const bursts = 14
  for (let i = 0; i < bursts; i++) {
    const jitter = (Math.random() - 0.5) * 0.04
    const at = t0 + i * 0.075 + jitter
    playClap(at)
  }
}

