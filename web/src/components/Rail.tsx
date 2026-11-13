import type { ReactNode } from 'react'

/** One section of the page, with its title on the paper. */
export function Entry({ index, title, children }: { label?: string; index: number; title?: ReactNode; children: ReactNode }) {
  return (
    <div className="entry" id={`rail-${index}`}>
      {title && <h2 className="entry-title">{title}</h2>}
      {children}
    </div>
  )
}
