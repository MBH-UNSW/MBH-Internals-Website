import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../lib/auth.jsx'
import { listReviews } from '../lib/api.js'
import { STATUS, ago } from '../lib/status.js'

export function StatusPill({ status }) {
  return <span className={`status ${STATUS[status].cls}`}>{STATUS[status].label}</span>
}

function Card({ r, lead }) {
  const { nameOf, uid } = useAuth()
  const p = r.progress || {}
  const own = r.designer_id === uid
  const asLead = lead && !own
  const pct = p.total ? Math.round(((asLead ? p.lead_ok : p.answered) / p.total) * 100) : 0
  return (
    <a className="rcard" href={`#/review/${r.id}`}>
      <div className="rcard-top">
        <b>{r.project}</b>
        <StatusPill status={r.status} />
      </div>
      <span className="meta">{[r.board, r.revision && `rev ${r.revision}`].filter(Boolean).join(' · ') || 'No board / revision set'}</span>
      <span className="meta">
        {own ? 'You' : nameOf(r.designer_id)}
        {r.reviewer_id && ` → ${r.reviewer_id === uid ? 'you' : nameOf(r.reviewer_id)}`} · round {r.round} · {ago(r.updated_at)}
      </span>
      <div className="bar-line" role="img" aria-label={`${pct}% complete`}>
        <i style={{ width: pct + '%' }} />
      </div>
      <span className="meta">
        {asLead
          ? `${p.lead_ok}/${p.total} confirmed by lead · ${p.critical_open} critical unconfirmed${p.lead_flagged ? ` · ${p.lead_flagged} flagged` : ''}`
          : `${p.answered}/${p.total} answered`}
      </span>
    </a>
  )
}

function Group({ title, hint, rows, lead, empty }) {
  return (
    <section className="group">
      <h2>
        {title} <span>{rows.length}</span>
      </h2>
      {hint && <p className="hint">{hint}</p>}
      {rows.length ? (
        <div className="rgrid">
          {rows.map((r) => (
            <Card key={r.id} r={r} lead={lead} />
          ))}
        </div>
      ) : (
        <p className="empty small">{empty}</p>
      )}
    </section>
  )
}

export default function Dashboard() {
  const { me, uid } = useAuth()
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')
  const load = useCallback(() => listReviews().then(setRows).catch((e) => setErr(e.message)), [])
  useEffect(() => {
    load()
    const t = setInterval(() => !document.hidden && load(), 20000)
    return () => clearInterval(t)
  }, [load])

  if (!me) return null
  const isLead = me.role === 'lead'
  const mine = (rows || []).filter((r) => r.designer_id === uid)
  const others = (rows || []).filter((r) => r.designer_id !== uid)

  return (
    <>
      <div className="pagehead">
        <div>
          <h1 className="h1s">Hi {me.name.split(' ')[0]}</h1>
          <p className="sub2">{isLead ? 'You are an electrical lead.' : 'Send your board for review when every checklist item is answered.'}</p>
        </div>
        <a className="primary" href="#/new">
          + New review request
        </a>
      </div>
      {err && (
        <p className="msg err" role="alert">
          {err}
        </p>
      )}
      {!rows && !err && <p className="empty">Loading…</p>}
      {rows && (
        <>
          {isLead && (
            <>
              <Group title="Waiting for a reviewer" rows={others.filter((r) => r.status === 'submitted')} lead empty="Nothing in the queue." hint="Open one and press Start review to claim it." />
              <Group title="Being reviewed" rows={others.filter((r) => r.status === 'in_review')} lead empty="No reviews in progress." />
              <Group title="Sent back to designer" rows={others.filter((r) => r.status === 'changes_requested')} lead empty="None." />
              <Group title="Approved" rows={others.filter((r) => r.status === 'approved')} lead empty="None yet." />
            </>
          )}
          <Group
            title={isLead ? 'My own designs' : 'My review requests'}
            rows={mine}
            empty="You haven't made a request yet. Press “New review request”."
            hint={!isLead ? 'When a lead sends a review back, open it here to see their comments.' : undefined}
          />
        </>
      )}
    </>
  )
}
