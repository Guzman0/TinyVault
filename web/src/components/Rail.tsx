import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * The ledger's margin rule. Every section of the page is an entry in the margin: a coin-shaped
 * bullet on one orange line. The line fills as you read down; the section in view is lit.
 */
export function Rail({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [marks, setMarks] = useState<{ y: number; label: string }[]>([])
  const [active, setActive] = useState(0)

  useEffect(() => {
    const root = ref.current
    if (!root) return
    const measure = () => {
      const top = root.getBoundingClientRect().top + window.scrollY
      const items = [...root.querySelectorAll<HTMLElement>('[data-rail]')]
      setMarks(items.map((el) => ({ y: el.getBoundingClientRect().top + window.scrollY - top + parseFloat(getComputedStyle(el).paddingTop) + 22, label: el.dataset.rail || '' })))
    }
    const onScroll = () => {
      const top = root.getBoundingClientRect().top + window.scrollY
      const mid = window.scrollY + window.innerHeight * 0.5 - top
      const items = [...root.querySelectorAll<HTMLElement>('[data-rail]')]
      let i = 0
      items.forEach((el, k) => { if (el.getBoundingClientRect().top + window.scrollY - top <= mid) i = k })
      setActive(i)
    }
    measure(); onScroll()
    const ro = new ResizeObserver(() => { measure(); onScroll() })
    ro.observe(root)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', measure)
    return () => { ro.disconnect(); window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', measure) }
  }, [])

  const fill = marks[active]?.y ?? 0
  return (
    <div className="rail-wrap" ref={ref}>
      <div className="rail" aria-hidden="true">
        <div className="rail-line" />
        <div className="rail-fill" style={{ height: fill }} />
        {marks.map((m, i) => (
          <a key={i} href={`#rail-${i}`} tabIndex={-1} className={`rail-mark${i < active ? ' past' : ''}${i === active ? ' on' : ''}`} style={{ top: m.y }}>
            <span className="rail-coin" />
            <span className="rail-label">{m.label}</span>
          </a>
        ))}
      </div>
      <div className="rail-content">{children}</div>
    </div>
  )
}

/** One entry in the margin. */
export function Entry({ label, index, title, children }: { label: string; index: number; title?: ReactNode; children: ReactNode }) {
  return (
    <div className="entry" data-rail={label} id={`rail-${index}`}>
      {title && <h2 className="entry-title">{title}</h2>}
      {children}
    </div>
  )
}
