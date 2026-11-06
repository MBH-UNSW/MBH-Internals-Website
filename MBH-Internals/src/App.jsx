import { useEffect, useMemo, useState } from 'react'
import { LISTS, PRI } from './data/checklist.js'
import { EXPLAINERS, ORDER, Explainer, Thumb } from './components/Explainers.jsx'
import { TraceWidth, Divider } from './components/Tools.jsx'
import './App.css'

const KEY = 'ubh-pcb-checklist-v1'
const TOOL_IDS = ['tracewidth', 'divider']

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {}
  } catch {
    return {}
  }
}

function Heart({ size = 56 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path fill="#c60c0c" d="M14 10c3-4 8-3 10 1 3-3 8-3 10 2 9-1 22 7 22 24 0 14-14 24-23 27C24 59 8 48 8 32c0-6 2-9 5-11-3-3-3-8 1-11z" />
      <circle cx="19" cy="14" r="3" fill="#8f1d1d" />
    </svg>
  )
}

function Ring({ pct, label }) {
  const r = 26, c = 2 * Math.PI * r
  return (
    <div className="ring" title={label}>
      <svg width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={r} fill="none" stroke="#e3e3e3" strokeWidth="7" />
        <circle cx="32" cy="32" r={r} fill="none" stroke="#c60c0c" strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} transform="rotate(-90 32 32)" style={{ transition: 'stroke-dashoffset .5s' }} />
      </svg>
      <b>{Math.round(pct * 100)}%</b>
    </div>
  )
}

export default function App() {
  const [tab, setTab] = useState(() => (['schematic', 'layout', 'explainers'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'schematic'))
  const [state, setState] = useState(load) // { [id]: {me, rev, note} }
  const [q, setQ] = useState('')
  const [pris, setPris] = useState({ C: true, H: true, M: true, L: true })
  const [openOnly, setOpenOnly] = useState(false)
  const [modal, setModal] = useState(() => (location.hash.startsWith('#x-') ? location.hash.slice(3) : null))
  const [noteFor, setNoteFor] = useState(null)

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* private mode */ }
  }, [state])
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && setModal(null)
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])

  const set = (id, patch) => setState((s) => ({ ...s, [id]: { ...s[id], ...patch } }))
  const get = (id) => state[id] || {}

  const progress = useMemo(() => {
    const out = {}
    for (const [k, l] of Object.entries(LISTS)) {
      const n = l.items.length
      out[k] = {
        n,
        me: l.items.filter((i) => state[i.id]?.me).length / n,
        rev: l.items.filter((i) => state[i.id]?.rev).length / n,
        crit: l.items.filter((i) => i.pri === 'C' && !state[i.id]?.me).length,
      }
    }
    return out
  }, [state])

  function openExplain(x) {
    if (TOOL_IDS.includes(x)) {
      setTab('explainers')
      setTimeout(() => document.getElementById('tools')?.scrollIntoView({ behavior: 'smooth' }), 50)
    } else setModal(x)
  }

  function exportCsv() {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const rows = [['List', 'Section', 'Item', 'Priority', 'Self check', 'Reviewer check', 'Comment']]
    for (const l of Object.values(LISTS))
      for (const i of l.items) rows.push([l.label, i.section, i.text, PRI[i.pri], get(i.id).me ? 'TRUE' : 'FALSE', get(i.id).rev ? 'TRUE' : 'FALSE', get(i.id).note || ''])
    const blob = new Blob([rows.map((r) => r.map(esc).join(',')).join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'ubh-pcb-review.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  function reset() {
    if (confirm('Clear ALL ticks and comments on this device? This cannot be undone.')) setState({})
  }

  const list = LISTS[tab]
  let sections = []
  if (list) {
    const needle = q.trim().toLowerCase()
    const items = list.items.filter((i) => pris[i.pri] && (!openOnly || !get(i.id).me) && (!needle || (i.text + i.note + i.section).toLowerCase().includes(needle)))
    const map = new Map()
    for (const i of items) map.set(i.section, [...(map.get(i.section) || []), i])
    sections = [...map.entries()]
  }

  return (
    <>
      <div className="blob" aria-hidden="true" />
      <header className="top">
        <div className="brand">
          <Heart size={44} />
          <span>Made For <em>Life</em></span>
        </div>
        <nav className="tabs" role="tablist">
          {[...Object.entries(LISTS).map(([k, l]) => [k, l.label]), ['explainers', 'Explainers & tools']].map(([k, label]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{label}</button>
          ))}
        </nav>
      </header>

      <main>
        <section className="hero">
          <div>
            <h1>UNSW<br />PCB Self‑Review</h1>
            <div className="rule" />
            <p className="sub"><b>UNSW Bionic Heart</b> <i>· Electrical</i></p>
            <p className="lede">Tick every item yourself <b>before</b> the leads review. Anything you can't tick is a conversation to have, not a box to hide. Tap <span className="pill">▶ Explain</span> on an item to see why it matters.</p>
          </div>
          <div className="rings">
            {Object.entries(LISTS).map(([k, l]) => (
              <button key={k} className="ringcard" onClick={() => setTab(k)}>
                <Ring pct={progress[k].me} label="self-check progress" />
                <div>
                  <b>{l.label}</b>
                  <small>{Math.round(progress[k].me * progress[k].n)} / {progress[k].n} self-checked</small>
                  <small className={progress[k].crit ? 'warn' : 'ok'}>{progress[k].crit ? `${progress[k].crit} critical open` : 'all critical done ✓'}</small>
                </div>
              </button>
            ))}
          </div>
        </section>

        {list && (
          <>
            <div className="bar">
              <input className="search" type="search" placeholder="Search items…" value={q} onChange={(e) => setQ(e.target.value)} />
              <div className="chips">
                {Object.entries(PRI).map(([k, name]) => (
                  <button key={k} className={`chip p${k} ${pris[k] ? 'on' : ''}`} onClick={() => setPris((p) => ({ ...p, [k]: !p[k] }))}>{name}</button>
                ))}
                <button className={`chip ${openOnly ? 'on' : ''}`} onClick={() => setOpenOnly((v) => !v)}>Open only</button>
              </div>
              <div className="acts">
                <button onClick={exportCsv}>Export CSV</button>
                <button onClick={() => window.print()}>Print / PDF</button>
                <button className="ghost" onClick={reset}>Reset</button>
              </div>
            </div>

            <div className="legend"><span><i className="cb me" /> Me (self-check)</span><span><i className="cb rev" /> Reviewer (leads only)</span><span>Progress is saved in this browser only – use Export CSV to share it.</span></div>

            {sections.length === 0 && <p className="empty">No items match.</p>}
            {sections.map(([name, items]) => {
              const done = items.filter((i) => get(i.id).me).length
              return (
                <details key={name} className="sec" open>
                  <summary>
                    <h2>{name}</h2>
                    <span className="count">{done}/{items.length}</span>
                  </summary>
                  <ul>
                    {items.map((i) => {
                      const s = get(i.id)
                      return (
                        <li key={i.id} className={s.me ? 'done' : ''}>
                          <div className="checks">
                            <label title="Me – self-check"><input type="checkbox" checked={!!s.me} onChange={(e) => set(i.id, { me: e.target.checked })} /><i className="cb me" /></label>
                            <label title="Reviewer"><input type="checkbox" checked={!!s.rev} onChange={(e) => set(i.id, { rev: e.target.checked })} /><i className="cb rev" /></label>
                          </div>
                          <div className="body">
                            <p>{i.text}</p>
                            {i.note && <small>{i.note}</small>}
                            <div className="row">
                              <span className={`badge p${i.pri}`}>{PRI[i.pri]}</span>
                              {i.x && <button className="pill" onClick={() => openExplain(i.x)}>▶ {TOOL_IDS.includes(i.x) ? 'Calculator' : 'Explain'}</button>}
                              <button className="link" onClick={() => setNoteFor(noteFor === i.id ? null : i.id)}>{s.note ? '💬 Edit comment' : '+ Comment'}</button>
                            </div>
                            {(noteFor === i.id || s.note) && (noteFor === i.id ? (
                              <textarea autoFocus rows="2" placeholder="Comment for the reviewer…" value={s.note || ''} onChange={(e) => set(i.id, { note: e.target.value })} />
                            ) : (
                              <blockquote>{s.note}</blockquote>
                            ))}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </details>
              )
            })}
          </>
        )}

        {tab === 'explainers' && (
          <>
            <h2 className="h2">Animated explainers</h2>
            <p className="lede2">Short loops showing what goes wrong and what the fix looks like. Schematic views use the cream Altium sheet look; layout views use the dark PCB editor look.</p>
            <div className="grid">
              {ORDER.map((id) => (
                <button key={id} className="card" onClick={() => setModal(id)}>
                  <Thumb id={id} />
                  <b>{EXPLAINERS[id].title}</b>
                  <span>▶ Watch</span>
                </button>
              ))}
            </div>
            <h2 className="h2" id="tools">Calculators</h2>
            <div className="tools">
              <TraceWidth />
              <Divider />
            </div>
          </>
        )}
      </main>

      <footer>UNSW Bionic Heart · Electrical</footer>

      {modal && (
        <div className="modal" onClick={() => setModal(null)}>
          <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <button className="x" onClick={() => setModal(null)} aria-label="Close">✕</button>
            <Explainer id={modal} onNav={setModal} />
          </div>
        </div>
      )}
    </>
  )
}
