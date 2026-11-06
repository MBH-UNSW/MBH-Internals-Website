import { useState } from 'react'
import { rpc } from '../lib/api.js'
import { go } from '../lib/router.js'
import { SCOPES } from '../lib/status.js'
import { LISTS } from '../data/checklist.js'

export default function NewReview() {
  const [f, setF] = useState({ project: '', board: '', revision: '', link: '', notes: '' })
  const [scopes, setScopes] = useState({ schematic: true, layout: false, bionic: false })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const chosen = Object.keys(scopes).filter((k) => scopes[k])

  async function submit(e) {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      const id = await rpc('create_review', {
        p_project: f.project,
        p_board: f.board,
        p_revision: f.revision,
        p_scopes: chosen,
        p_link: f.link,
        p_notes: f.notes,
      })
      go(`/review/${id}`)
    } catch (x) {
      setErr(x.message)
      setBusy(false)
    }
  }

  return (
    <form className="formcard" onSubmit={submit}>
      <h1 className="h1s">New review request</h1>
      <p className="sub2">This creates a private draft. Leads only see it once you submit.</p>
      <label className="fld">
        <span>Project *</span>
        <input required maxLength={120} value={f.project} onChange={set('project')} placeholder="e.g. TAH Controller" />
      </label>
      <div className="two">
        <label className="fld">
          <span>Board</span>
          <input maxLength={120} value={f.board} onChange={set('board')} placeholder="e.g. Main board" />
        </label>
        <label className="fld">
          <span>Revision</span>
          <input maxLength={40} value={f.revision} onChange={set('revision')} placeholder="e.g. B" />
        </label>
      </div>
      <label className="fld">
        <span>Link to the design (Altium 365 / Drive / Git)</span>
        <input type="url" maxLength={500} value={f.link} onChange={set('link')} placeholder="https://…" />
      </label>
      <label className="fld">
        <span>Notes for the reviewer</span>
        <textarea rows="3" maxLength={2000} value={f.notes} onChange={set('notes')} placeholder="What changed, what you're unsure about…" />
      </label>
      <fieldset>
        <legend>What are you asking to be reviewed?</legend>
        {Object.entries(SCOPES).map(([k, s]) => (
          <label key={k} className="scope">
            <input type="checkbox" checked={scopes[k]} onChange={(e) => setScopes({ ...scopes, [k]: e.target.checked })} />
            <span>
              <b>{s.label}</b> <em>({LISTS[k].items.length} checks)</em>
              <small>{s.desc}</small>
            </span>
          </label>
        ))}
      </fieldset>
      {err && (
        <p className="msg err" role="alert">
          {err}
        </p>
      )}
      <div className="actions">
        <button className="primary" disabled={busy || !chosen.length}>
          Create draft
        </button>
        <a className="ghostbtn" href="#/">
          Cancel
        </a>
      </div>
    </form>
  )
}
