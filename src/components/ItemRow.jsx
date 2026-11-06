import { useState } from 'react'
import { PRI } from '../data/checklist.js'
import { TOOL_IDS } from './Explainers.jsx'

const SELF = [
  ['verified', '✓', 'Verified', 'Checked against the design and correct'],
  ['na', '', 'N/A', 'Does not apply to this design (say why)'],
  ['issue', '⚠', 'Issue', 'Checked and a problem was found (say what)'],
]
const LEAD = [
  ['ok', '✓', 'Agree', 'Lead agrees with the designer'],
  ['issue', '⚑', 'Needs change', 'Designer must fix or explain this'],
]

/**
 * One checklist line.
 * mode 'browse'  -> reference only
 * mode 'review'  -> shows designer status (+ lead status) and the comment thread
 */
export default function ItemRow({ item, mode, st = {}, comments = [], perms = {}, nameOf, onSelf, onLead, onComment, onExplain }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  const needsWhy = mode === 'review' && perms.self && (st.self_status === 'na' || st.self_status === 'issue') && !comments.some((c) => c.author_role === 'designer')
  const flagged = st.lead_status === 'issue'
  const show = open || needsWhy || flagged
  const showLead = mode === 'review' && (perms.lead || st.lead_status)

  async function send(e) {
    e.preventDefault()
    if (!text.trim()) return
    setBusy(true)
    try {
      await onComment(text.trim())
      setText('')
      setOpen(true)
    } catch {
      /* the page shows the error */
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className={`item ${flagged ? 'flag' : ''}`}>
      <div className="item-main">
        <p>{item.text}</p>
        {item.note && <small>{item.note}</small>}
        <div className="row">
          <span className={`badge p${item.pri}`}>{PRI[item.pri]}</span>
          {item.x && <button className="pill" onClick={() => onExplain(item.x)}>▶ {TOOL_IDS.includes(item.x) ? 'Calculator' : 'Explain'}</button>}
          {mode === 'review' && (
            <button className="link" onClick={() => setOpen((v) => !v)} aria-expanded={show}>
              {comments.length ? `💬 ${comments.length} comment${comments.length > 1 ? 's' : ''}` : perms.comment ? '+ Comment' : ''}
            </button>
          )}
        </div>
      </div>

      {mode === 'review' && (
        <div className="item-status">
          <div className="seg3" role="group" aria-label="Designer's answer">
            <span className="who">Designer</span>
            {SELF.map(([v, sym, label, tip]) => (
              <button key={v} className={`s-${v} ${st.self_status === v ? 'on' : ''}`} disabled={!perms.self} aria-pressed={st.self_status === v} title={tip}
                onClick={() => onSelf(st.self_status === v ? null : v)}>
                {sym && <b>{sym}</b>} {label}
              </button>
            ))}
          </div>
          {showLead && (
            <div className="seg3 lead" role="group" aria-label="Lead's review">
              <span className="who">Lead</span>
              {LEAD.map(([v, sym, label, tip]) => (
                <button key={v} className={`l-${v} ${st.lead_status === v ? 'on' : ''}`} disabled={!perms.lead} aria-pressed={st.lead_status === v} title={tip}
                  onClick={() => onLead(st.lead_status === v ? null : v)}>
                  <b>{sym}</b> {label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {mode === 'review' && show && (
        <div className="thread">
          {needsWhy && <p className="hint">Add a comment explaining why this is {st.self_status === 'na' ? 'not applicable' : 'an issue'}.</p>}
          {comments.map((c) => (
            <div key={c.id} className={`cmt ${c.author_role}`}>
              <b>{nameOf(c.author_id)}</b> <em>{c.author_role === 'lead' ? 'Lead' : 'Designer'} · round {c.round}</em>
              <p>{c.body}</p>
            </div>
          ))}
          {perms.comment && (
            <form onSubmit={send}>
              <input value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} placeholder={perms.lead ? 'Tell the designer what to change…' : 'Reply or explain…'} aria-label="Comment" />
              <button disabled={busy || !text.trim()}>Add</button>
            </form>
          )}
        </div>
      )}
    </li>
  )
}
