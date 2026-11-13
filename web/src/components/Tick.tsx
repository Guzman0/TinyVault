import { useEffect, useRef, useState } from 'react'

const NUM = /^([\d,]*\.?\d+)(.*)$/s
const reduce = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * A number that rolls to its new value when it changes, so a change is noticed. Takes the
 * already formatted text ("1,151 MUSD", "0.0638 BTC") and keeps its decimals and unit.
 * Nothing moves on first render, only on a change.
 */
export function Tick({ text }: { text: string }) {
  const [shown, setShown] = useState(text)
  const prev = useRef(text)
  const [flash, setFlash] = useState(false)

  useEffect(() => {
    const from = prev.current
    prev.current = text
    const a = NUM.exec(from), b = NUM.exec(text)
    if (from === text || !a || !b || a[2] !== b[2] || reduce()) { setShown(text); return }
    const x0 = Number(a[1].replace(/,/g, '')), x1 = Number(b[1].replace(/,/g, ''))
    const dec = (b[1].split('.')[1] || '').length
    const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + b[2]
    const t0 = performance.now(), dur = 900
    let raf = 0
    setFlash(true)
    const step = (now: number) => {
      const p = Math.min((now - t0) / dur, 1), e = 1 - Math.pow(1 - p, 3)
      setShown(p < 1 ? fmt(x0 + (x1 - x0) * e) : text)
      if (p < 1) raf = requestAnimationFrame(step)
      else setTimeout(() => setFlash(false), 600)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [text])

  return <span className={`tick${flash ? ' moved' : ''}`}>{shown}</span>
}
