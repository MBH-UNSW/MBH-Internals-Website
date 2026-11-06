import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/auth.jsx'
import { getReview, rpc } from '../lib/api.js'
import { go } from '../lib/router.js'
import { LISTS } from '../data/checklist.js'
import { EVENT_TEXT, SCOPES, ago } from '../lib/status.js'
import ItemRow from '../components/ItemRow.jsx'
import ExplainModal from '../components/ExplainModal.jsx'
import { TOOL_IDS, ORDER } from '../components/Explainers.jsx'
import { StatusPill } from './Dashboard.jsx'

const FILTERS = [
  ['all', 'All items'],
  ['open', 'Not answered yet'],
  ['critical', 'Critical only'],
  ['issue', 'Issues found'],
  ['na', 'Marked N/A'],
  ['flagged', 'Flagged by lead'],
  ['unconfirmed', 'Not confirmed by lead'],
]

export default function Review({ id }) {
  const { uid, me, nameOf } = useAuth()
  const [d, setD] = useState(undefined) // undefined = loading, null = not found
  const [err, setErr] = useState('')
  const [tab, setTab] = useState(null)
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')
  const [explain, setExplain] = useState(null)
  const [summary, setSummary] = useState('')
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      setD(await getReview(id))
    } catch (e) {
      setErr(e.message)
    }
  }, [id])

  useEffect(() => {
    load()
    const t = setInterval(() => !document.hidden && load(), 20000)
    return () => clearInterval(t)
  }, [load])

  const r = d?.review
  const isDesigner = r?.designer_id === uid
  const isLead = me?.role === 'lead' && !isDesigner
  const canEdit = isDesigner && ['draft', 'changes_requested'].includes(r?.status)
  const reviewing = isLead && r?.status === 'in_review' && r?.reviewer_id === uid
  const perms = { self: canEdit, lead: reviewing, comment: canEdit || reviewing }

  const scopes = useMemo(() => (r ? Object.keys(SCOPES).filter((k) => r.scopes.includes(k)) : []), [r])
  const active = tab && scopes.includes(tab) ? tab : scopes[0]
  const allItems = useMemo(() => scopes.flatMap((k) => LISTS[k].items), [scopes])

  const stats = useMemo(() => {
    if (!d) return {}
    const s = (i) => d.items[i.id] || {}
    const crit = allItems.filter((i) => i.pri === 'C')
    return {
      total: allItems.length,
      answered: allItems.filter((i) => s(i).self_status).length,
      leadOk: allItems.filter((i) => s(i).lead_status === 'ok').length,
      flagged: allItems.filter((i) => s(i).lead_status === 'issue').length,
      issues: allItems.filter((i) => s(i).self_status === 'issue').length,
      critUnconfirmed: crit.filter((i) => s(i).lead_status !== 'ok').length,
    }
  }, [d, allItems])

  const commentsBy = useMemo(() => {
    const m = {}
    for (const c of d?.comments || []) (m[c.item_id || '_'] ||= []).push(c)
    return m
  }, [d])

  async function act(fn) {
    setErr('')
    setBusy(true)
    try {
      await fn()
    } catch (e) {
      setErr(e.message)
    } finally {
      await load()
      setBusy(false)
    }
  }

  function patchItem(itemId, patch) {
    setD((x) => ({ ...x, items: { ...x.items, [itemId]: { ...x.items[itemId], item_id: itemId, ...patch } } }))
  }
  const setSelf = (itemId, v) => {
    patchItem(itemId, { self_status: v })
    rpc('set_self_status', { p_review: id, p_item: itemId, p_status: v }).catch((e) => setErr(e.message)).finally(load)
  }
  const setLead = (itemId, v) => {
    patchItem(itemId, { lead_status: v })
    rpc('set_lead_status', { p_review: id, p_item: itemId, p_status: v }).catch((e) => setErr(e.message)).finally(load)
  }
  const addComment = async (itemId, body) => {
    try {
      await rpc('add_comment', { p_review: id, p_item: itemId, p_body: body })
      await load()
    } catch (e) {
      setErr(e.message)
      throw e
    }
  }
  const openExplain = (x) => (TOOL_IDS.includes(x) ? go('/reference/resources') : setExplain(x))

  if (d === undefined) return <p className="empty">{err || 'Loading…'}</p>
  if (d === null) return <p className="empty">This review doesn't exist, or you don't have access to it. <a href="#/">Back to reviews</a></p>

  const pass = (it) => {
    const st = d.items[it.id] || {}
    if (q.trim() && !(it.text + it.note + it.section).toLowerCase().includes(q.trim().toLowerCase())) return false
    switch (filter) {
      case 'open': return !st.self_status
      case 'critical': return it.pri === 'C'
      case 'issue': return st.self_status === 'issue'
      case 'na': return st.self_status === 'na'
      case 'flagged': return st.lead_status === 'issue'
      case 'unconfirmed': return st.lead_status !== 'ok'
      default: return true
    }
  }
  const sections = new Map()
  for (const it of LISTS[active]?.items.filter(pass) || []) sections.set(it.section, [...(sections.get(it.section) || []), it])
  const pct = (n) => (stats.total ? Math.round((n / stats.total) * 100) : 0)

  return (
    <div className="review">
      <a className="back" href="#/">← All reviews</a>

      <header className="rhead">
        <div>
          <h1 className="h1s">{r.project}</h1>
          <p className="sub2">
            {[r.board, r.revision && `revision ${r.revision}`].filter(Boolean).join(' · ') || 'No board / revision set'} · designer <b>{isDesigner ? 'you' : nameOf(r.designer_id)}</b>
            {r.reviewer_id && <> · lead <b>{r.reviewer_id === uid ? 'you' : nameOf(r.reviewer_id)}</b></>} · round {r.round}
          </p>
          {r.link && <p className="sub2"><a href={r.link} target="_blank" rel="noreferrer noopener">Open design files ↗</a></p>}
          {r.notes && <p className="notes">{r.notes}</p>}
        </div>
        <div className="rhead-side">
          <StatusPill status={r.status} />
          <button className="ghostbtn" onClick={() => window.print()}>Print / PDF</button>
        </div>
      </header>

      {err && <p className="msg err" role="alert">{err} <button className="link" onClick={() => setErr('')}>dismiss</button></p>}

      {/* ---------- what happens next ---------- */}
      <section className={`panel ${r.status}`}>
        {isDesigner && r.status === 'draft' && (
          <>
            <h2>Answer every item, then submit</h2>
            <p>For each check choose <b>✓ Verified</b>, <b>N/A</b> (say why) or <b>⚠ Issue</b> (say what). You can't submit until all {stats.total} are answered. {stats.total - stats.answered} to go.</p>
            <div className="actions">
              <button className="primary" disabled={busy} onClick={() => act(() => rpc('submit_review', { p_id: id }))}>Submit for review</button>
              <button className="ghostbtn" onClick={() => setEditing((v) => !v)}>Edit details</button>
              <button className="ghostbtn danger" disabled={busy} onClick={() => confirm('Delete this draft?') && act(async () => { await rpc('delete_review', { p_id: id }); go('/') })}>Delete draft</button>
            </div>
          </>
        )}
        {isDesigner && r.status === 'changes_requested' && (
          <>
            <h2>{nameOf(r.reviewer_id)} sent this back</h2>
            {r.decision_summary && <blockquote>{r.decision_summary}</blockquote>}
            <p>{stats.flagged} item(s) are flagged. Fix the design, update your answer if it changed, <b>reply on each flagged item</b>, then resubmit. The lead will be notified.</p>
            <div className="actions">
              <button className="ghostbtn" onClick={() => { setFilter('flagged'); window.scrollTo({ top: 400, behavior: 'smooth' }) }}>Show flagged items</button>
              <button className="primary" disabled={busy} onClick={() => act(() => rpc('submit_review', { p_id: id }))}>Resubmit (round {r.round + 1})</button>
              <button className="ghostbtn" onClick={() => setEditing((v) => !v)}>Edit details</button>
            </div>
          </>
        )}
        {isDesigner && r.status === 'submitted' && (<><h2>Waiting for a lead</h2><p>Leads have been notified. You'll get a notification when someone starts and when they decide. This request is locked meanwhile.</p></>)}
        {isDesigner && r.status === 'in_review' && (<><h2>{nameOf(r.reviewer_id)} is reviewing</h2><p>You'll be notified when they finish. This request is locked meanwhile.</p></>)}
        {isDesigner && r.status === 'approved' && (<><h2>Approved by {nameOf(r.reviewer_id)} 🎉</h2>{r.decision_summary && <blockquote>{r.decision_summary}</blockquote>}<p>If the design changes, make a new request for the new revision – this approval only covers revision {r.revision || 'as submitted'}.</p></>)}

        {isLead && r.status === 'submitted' && (
          <>
            <h2>{nameOf(r.designer_id)} is waiting for a review{r.round > 1 ? ` (round ${r.round})` : ''}</h2>
            <p>Start the review to claim it. The designer is told, and their answers stay locked while you review.</p>
            <div className="actions"><button className="primary" disabled={busy} onClick={() => act(() => rpc('start_review', { p_id: id }))}>Start review</button></div>
          </>
        )}
        {isLead && r.status === 'in_review' && r.reviewer_id !== uid && (<><h2>{nameOf(r.reviewer_id)} is reviewing this</h2><p>You can read it but not change it.</p></>)}
        {reviewing && (
          <>
            <h2>Your review</h2>
            <p>
              Mark anything wrong with <b>⚑ Needs change</b> and comment on it. Then <b>Accept all remaining</b> to agree with everything you didn't flag.
              {' '}{stats.critUnconfirmed} critical item(s) not confirmed yet; {stats.flagged} flagged; {stats.issues} the designer marked as an issue.
            </p>
            <div className="actions">
              <button className="ghostbtn" disabled={busy} onClick={() => act(() => rpc('lead_accept_remaining', { p_id: id }))}>Accept all remaining</button>
            </div>
            <label className="fld"><span>Summary for the designer</span><textarea rows="2" maxLength={2000} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Overall feedback…" /></label>
            <div className="actions">
              <button className="primary warn" disabled={busy} onClick={() => act(() => rpc('decide_review', { p_id: id, p_decision: 'changes', p_summary: summary }))}>Send back with changes requested</button>
              <button className="primary good" disabled={busy} onClick={() => act(() => rpc('decide_review', { p_id: id, p_decision: 'approve', p_summary: summary }))}>Approve</button>
            </div>
          </>
        )}
        {isLead && r.status === 'changes_requested' && (<><h2>Sent back to {nameOf(r.designer_id)}</h2>{r.decision_summary && <blockquote>{r.decision_summary}</blockquote>}<p>You'll be notified when they resubmit.</p></>)}
        {isLead && r.status === 'approved' && (<><h2>Approved by {nameOf(r.reviewer_id)}</h2>{r.decision_summary && <blockquote>{r.decision_summary}</blockquote>}</>)}
        {editing && canEdit && <EditDetails r={r} onDone={() => { setEditing(false); load() }} />}
      </section>

      <div className="stats">
        <div><b>{stats.answered}/{stats.total}</b><span>answered by designer</span><div className="bar-line"><i style={{ width: pct(stats.answered) + '%' }} /></div></div>
        <div><b>{stats.leadOk}/{stats.total}</b><span>confirmed by lead</span><div className="bar-line"><i style={{ width: pct(stats.leadOk) + '%' }} /></div></div>
        <div><b>{stats.critUnconfirmed}</b><span>critical not confirmed</span></div>
        <div><b>{stats.flagged}</b><span>flagged by lead</span></div>
      </div>

      {/* ---------- checklist ---------- */}
      <nav className="tabs sub" role="tablist">
        {scopes.map((k) => <button key={k} role="tab" aria-selected={active === k} className={active === k ? 'on' : ''} onClick={() => setTab(k)}>{SCOPES[k].label}</button>)}
      </nav>
      {active === 'bionic' && <p className="disclaimer">This is an engineering self-review aid. It is <b>not</b> evidence of compliance with medical-device standards (e.g. IEC 60601-1, ISO 14971).</p>}
      <div className="bar">
        <input className="search" type="search" placeholder="Search items…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search items" />
        <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter items">
          {FILTERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      {sections.size === 0 && <p className="empty">No items match this filter.</p>}
      {[...sections].map(([name, items]) => (
        <details key={name} className="sec" open>
          <summary>
            <h2>{name}</h2>
            <span className="count">{items.filter((i) => d.items[i.id]?.self_status).length}/{items.length}</span>
          </summary>
          <ul>
            {items.map((it) => (
              <ItemRow key={it.id} item={it} mode="review" st={d.items[it.id]} comments={commentsBy[it.id] || []} perms={perms} nameOf={nameOf}
                onSelf={(v) => setSelf(it.id, v)} onLead={(v) => setLead(it.id, v)} onComment={(b) => addComment(it.id, b)} onExplain={openExplain} />
            ))}
          </ul>
        </details>
      ))}

      {/* ---------- history ---------- */}
      <section className="timeline">
        <h2>History</h2>
        <ol>
          {[...d.events].reverse().map((e) => (
            <li key={e.id}>
              <b>{e.actor_id === uid ? 'You' : nameOf(e.actor_id)}</b> {EVENT_TEXT[e.kind] || e.kind} <em>(round {e.round} · {ago(e.created_at)})</em>
              {e.note && <p>“{e.note}”</p>}
            </li>
          ))}
        </ol>
      </section>

      <ExplainModal id={explain} onClose={() => setExplain(null)} onNav={(x) => setExplain(ORDER.includes(x) ? x : null)} />
    </div>
  )
}

function EditDetails({ r, onDone }) {
  const [f, setF] = useState({ project: r.project, board: r.board, revision: r.revision, link: r.link || '', notes: r.notes })
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  async function save(e) {
    e.preventDefault()
    try {
      await rpc('update_review', { p_id: r.id, p_project: f.project, p_board: f.board, p_revision: f.revision, p_link: f.link, p_notes: f.notes })
      onDone()
    } catch (x) { setErr(x.message) }
  }
  return (
    <form className="editform" onSubmit={save}>
      <div className="two">
        <label className="fld"><span>Project</span><input required value={f.project} onChange={set('project')} maxLength={120} /></label>
        <label className="fld"><span>Board</span><input value={f.board} onChange={set('board')} maxLength={120} /></label>
      </div>
      <div className="two">
        <label className="fld"><span>Revision</span><input value={f.revision} onChange={set('revision')} maxLength={40} /></label>
        <label className="fld"><span>Design link</span><input type="url" value={f.link} onChange={set('link')} maxLength={500} /></label>
      </div>
      <label className="fld"><span>Notes</span><textarea rows="2" value={f.notes} onChange={set('notes')} maxLength={2000} /></label>
      {err && <p className="msg err">{err}</p>}
      <div className="actions"><button className="primary">Save</button></div>
    </form>
  )
}
