import type { ReactNode } from 'react'

export type Tone = 'paper' | 'warm' | 'ink' | 'sheet' | 'green'
export type Glyph = 'cycle' | 'vault' | 'ledger' | 'receipt' | 'scale'

/** One section of the page: its own band of colour, an icon and its title. */
export function Entry({ index, title, tone, glyph, children }: { label?: string; index: number; title?: ReactNode; tone?: Tone; glyph?: Glyph; children: ReactNode }) {
  return (
    <div className={`entry${tone ? ` band band-${tone}` : ''}`} id={`rail-${index}`}>
      <div className="band-inner">
        {title && (
          <h2 className="entry-title">
            {glyph && <Icon name={glyph} />}
            <span>{title}</span>
          </h2>
        )}
        {children}
      </div>
    </div>
  )
}

/** Small drawn marks, one per section, in the line weight of the logo. */
function Icon({ name }: { name: Glyph }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  return (
    <svg className="entry-icon" viewBox="0 0 40 40" aria-hidden="true">
      <rect x="1" y="1" width="38" height="38" rx="11" className="entry-icon-bg" />
      {name === 'cycle' && (
        <g {...p}>
          <circle cx="20" cy="20" r="5.5" />
          <path d="M11 15a10 10 0 0 1 17-3" /><path d="M28 9v3.5h-3.5" />
          <path d="M29 25a10 10 0 0 1-17 3" /><path d="M12 31v-3.5h3.5" />
        </g>
      )}
      {name === 'vault' && (
        <g {...p}>
          <rect x="9" y="9" width="22" height="22" rx="5" />
          <circle cx="20" cy="20" r="5" />
          <path d="M20 15v-2.5M20 27.5V25M15 20h-2.5M27.5 20H25" />
        </g>
      )}
      {name === 'ledger' && (
        <g {...p}>
          <path d="M10 13h20M10 20h20M10 27h12" />
          <circle cx="27.5" cy="27" r="3.5" />
        </g>
      )}
      {name === 'receipt' && (
        <g {...p}>
          <path d="M12 9h16v22l-2.7-1.8-2.6 1.8-2.7-1.8-2.7 1.8-2.6-1.8L12 31z" />
          <path d="M16 15h8M16 19.5h8M16 24h5" />
        </g>
      )}
      {name === 'scale' && (
        <g {...p}>
          <path d="M20 10v20M14 30h12M11 14h18" />
          <path d="M11 14l-4 8a4 4 0 0 0 8 0zM29 14l-4 8a4 4 0 0 0 8 0z" />
        </g>
      )}
    </svg>
  )
}
