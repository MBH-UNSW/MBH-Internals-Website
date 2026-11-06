import { useCallback, useEffect, useState } from 'react'
import { AuthProvider, useAuth } from './lib/auth.jsx'
import { useRoute, go } from './lib/router.js'
import { listNotifications, rpc } from './lib/api.js'
import { ago } from './lib/status.js'
import Heart from './components/Heart.jsx'
import Login from './views/Login.jsx'
import Dashboard from './views/Dashboard.jsx'
import NewReview from './views/NewReview.jsx'
import Review from './views/Review.jsx'
import Team from './views/Team.jsx'
import Reference from './views/Reference.jsx'
import './App.css'

function Bell() {
  const [list, setList] = useState([])
  const [open, setOpen] = useState(false)
  const load = useCallback(() => listNotifications().then(setList).catch(() => {}), [])
  useEffect(() => {
    load()
    const t = setInterval(() => !document.hidden && load(), 20000)
    return () => clearInterval(t)
  }, [load])
  const unread = list.filter((n) => !n.read).length
  useEffect(() => {
    if (!open) return
    const k = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open])

  async function toggle() {
    const next = !open
    setOpen(next)
    if (next && unread) {
      await rpc('mark_notifications_read').catch(() => {})
      setTimeout(load, 3000) // keep the dots visible while the panel is open
    }
  }
  return (
    <div className="bell">
      <button className="iconbtn" onClick={toggle} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} aria-expanded={open}>
        🔔{unread > 0 && <i>{unread}</i>}
      </button>
      {open && (
        <div className="drop" role="menu">
          {list.length === 0 && <p className="empty small">No notifications yet.</p>}
          {list.map((n) => (
            <a key={n.id} href={n.review_id ? `#/review/${n.review_id}` : '#/'} className={n.read ? '' : 'unread'} onClick={() => setOpen(false)}>
              {n.text}
              <small>{ago(n.created_at)}</small>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

function Link({ to, children, match }) {
  return (
    <a href={`#${to}`} className={match ? 'on' : ''} aria-current={match ? 'page' : undefined}>
      {children}
    </a>
  )
}

function Shell() {
  const auth = useAuth()
  const route = useRoute()
  const signedIn = Boolean(auth.uid)
  const parts = route.split('/').filter(Boolean)

  let page
  if (parts[0] === 'reference') page = <Reference tab={parts[1]} />
  else if (auth.loading) page = <p className="empty">Loading…</p>
  else if (!signedIn) page = <Login />
  else if (!auth.me) page = <p className="empty">Setting up your profile… if this doesn't go away, sign out and back in.</p>
  else if (parts[0] === 'new') page = <NewReview />
  else if (parts[0] === 'review' && parts[1]) page = <Review key={parts[1]} id={parts[1]} />
  else if (parts[0] === 'team') page = <Team />
  else page = <Dashboard />

  const showLogin = !signedIn && parts[0] !== 'reference'

  return (
    <>
      {!showLogin && (
        <header className="top">
          <a className="brand" href="#/">
            <Heart size={34} />
            <span>
              Made For <em>Life</em>
            </span>
          </a>
          <nav className="mainnav" aria-label="Main">
            {signedIn && <Link to="/" match={!parts[0] || parts[0] === 'review' || parts[0] === 'new'}>Reviews</Link>}
            <Link to="/reference" match={parts[0] === 'reference'}>Reference</Link>
            {auth.me?.role === 'lead' && <Link to="/team" match={parts[0] === 'team'}>Team</Link>}
          </nav>
          <div className="who">
            {signedIn ? (
              <>
                <Bell />
                <span className="me">{auth.me?.name}{auth.me?.role === 'lead' && <em>Lead</em>}</span>
                <button className="ghostbtn" onClick={() => auth.signOut().then(() => go('/'))}>Sign out</button>
              </>
            ) : (
              <a className="primary" href="#/">Sign in</a>
            )}
          </div>
        </header>
      )}
      <main className={showLogin ? 'wide' : ''}>{page}</main>
      <footer>
        {auth.demo && <p className="demobanner">DEMO MODE – data lives only in this browser. Not the real backend.</p>}
        UNSW Bionic Heart · Electrical · Educational design review – not medical-device verification
      </footer>
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  )
}
