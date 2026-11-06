import { useState } from 'react'
import { useAuth } from '../lib/auth.jsx'
import Heart from '../components/Heart.jsx'

export default function Login() {
  const auth = useAuth()
  const [mode, setMode] = useState('in')
  const [f, setF] = useState({ name: '', email: '', password: '', teamCode: '' })
  const [err, setErr] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setErr('')
    setInfo('')
    setBusy(true)
    try {
      if (mode === 'in') await auth.signIn(f.email.trim(), f.password)
      else {
        const r = await auth.signUp({ ...f, email: f.email.trim(), name: f.name.trim(), teamCode: f.teamCode.trim() })
        if (r.needsEmailConfirm) setInfo('Account created. Check your email and click the confirmation link, then sign in.')
      }
    } catch (x) {
      setErr(x.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <div className="blob" aria-hidden="true" />
      <div className="login-grid">
        <div>
          <Heart size={52} />
          <h1>
            UNSW
            <br />
            PCB Design Review
          </h1>
          <div className="rule" />
          <p className="lede">
            Self-check your schematic and layout, send it to an electrical lead, and get the review back here. Anything you can't verify is a conversation to
            have, not a box to hide.
          </p>
          {auth.demo && (
            <div className="demobox">
              <b>Demo mode</b> – try the workflow as different people (password <code>demo1234</code>, team code <code>demo</code>):
              <div className="actions">
                {[['Alex (designer)', 'alex@demo.test'], ['Jo (designer)', 'jo@demo.test'], ['Sam (lead)', 'sam@demo.test']].map(([l, e]) => (
                  <button type="button" key={e} className="ghostbtn" onClick={() => auth.signIn(e, 'demo1234')}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
          )}
          <p className="lede">
            <a href="#/reference">Browse the checklist and explainers without signing in →</a>
          </p>
        </div>
        <form className="authcard" onSubmit={submit}>
          {!auth.configured ? (
            <>
              <h2>Backend not connected</h2>
              <p>
                This site needs its Supabase project details. Follow the setup steps in <b>README.md</b>, then restart. You can still use the{' '}
                <a href="#/reference">reference pages</a>.
              </p>
            </>
          ) : (
            <>
              <div className="seg small">
                <button type="button" className={mode === 'in' ? 'on' : ''} onClick={() => setMode('in')}>
                  Sign in
                </button>
                <button type="button" className={mode === 'up' ? 'on' : ''} onClick={() => setMode('up')}>
                  Create account
                </button>
              </div>
              {mode === 'up' && (
                <label className="fld">
                  <span>Your name</span>
                  <input required value={f.name} onChange={set('name')} autoComplete="name" />
                </label>
              )}
              <label className="fld">
                <span>Email</span>
                <input required type="email" value={f.email} onChange={set('email')} autoComplete="email" />
              </label>
              <label className="fld">
                <span>Password{mode === 'up' ? ' (min 8 characters)' : ''}</span>
                <input
                  required
                  type="password"
                  minLength={mode === 'up' ? 8 : undefined}
                  value={f.password}
                  onChange={set('password')}
                  autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
                />
              </label>
              {mode === 'up' && (
                <label className="fld">
                  <span>Team code (ask an electrical lead)</span>
                  <input required value={f.teamCode} onChange={set('teamCode')} autoComplete="off" />
                </label>
              )}
              {err && (
                <p className="msg err" role="alert">
                  {err}
                </p>
              )}
              {info && (
                <p className="msg ok" role="status">
                  {info}
                </p>
              )}
              <button className="primary" disabled={busy}>
                {busy ? 'Please wait…' : mode === 'in' ? 'Sign in' : 'Create account'}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  )
}
