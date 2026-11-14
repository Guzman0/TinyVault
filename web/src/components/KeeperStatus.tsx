import { useEffect, useState } from 'react'

const REPO = 'Guzman0/TinyVault'

type Run = { at: number; url: string; ok: boolean | null }

/**
 * When the public keeper last ran, from GitHub's public API (no key, 60 reads an hour per visitor).
 * Its log lists every account's ratio and any close it sent.
 */
export function KeeperStatus() {
  const [run, setRun] = useState<Run | null | 'error'>(null)
  useEffect(() => {
    fetch(`https://api.github.com/repos/${REPO}/actions/workflows/keeper.yml/runs?per_page=5`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((j) => {
        const r = (j.workflow_runs ?? []).find((x: { status: string }) => x.status === 'completed') ?? j.workflow_runs?.[0]
        setRun(r ? { at: Date.parse(r.updated_at), url: r.html_url, ok: r.conclusion ? r.conclusion === 'success' : null } : 'error')
      })
      .catch(() => setRun('error'))
  }, [])
  const logs = `https://github.com/${REPO}/actions/workflows/keeper.yml`
  if (run === null) return null
  if (run === 'error') return <p className="muted small">The keeper's runs and logs are public on <a href={logs} target="_blank" rel="noreferrer">GitHub</a>.</p>
  return (
    <p className="muted small">
      The keeper last checked every account {ago(run.at)}
      {run.ok === false ? ', and that run failed' : ''}. <a href={run.url} target="_blank" rel="noreferrer">Read its log</a>.
      {' '}Anyone can also run it, or close an account from this table, and earn the bonus.
    </p>
  )
}

function ago(t: number) {
  const m = Math.max(0, Math.round((Date.now() - t) / 60_000))
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`
}
