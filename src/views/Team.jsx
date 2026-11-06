import { useState } from 'react'
import { useAuth } from '../lib/auth.jsx'
import { rpc } from '../lib/api.js'

export default function Team() {
  const { me, people, refreshPeople, uid } = useAuth()
  const [err, setErr] = useState('')
  if (me?.role !== 'lead') return <p className="empty">Only leads can manage the team.</p>
  const list = Object.values(people).sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === 'lead' ? -1 : 1))

  async function toggle(p) {
    setErr('')
    try {
      await rpc('set_role', { p_user: p.id, p_role: p.role === 'lead' ? 'designer' : 'lead' })
      await refreshPeople()
    } catch (e) {
      setErr(e.message)
    }
  }

  return (
    <>
      <h1 className="h1s">Team</h1>
      <p className="sub2">New members create their own account with the team code. You can make them a lead here.</p>
      {err && (
        <p className="msg err" role="alert">
          {err}
        </p>
      )}
      <ul className="people">
        {list.map((p) => (
          <li key={p.id}>
            <div>
              <b>{p.name}</b>
              {p.id === uid && ' (you)'}
              <small>{p.email}</small>
            </div>
            <span className={`status ${p.role === 'lead' ? 'st-rev' : 'st-draft'}`}>{p.role === 'lead' ? 'Lead' : 'Designer'}</span>
            <button className="ghostbtn" onClick={() => toggle(p)}>
              {p.role === 'lead' ? 'Make designer' : 'Make lead'}
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}
