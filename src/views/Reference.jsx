import { useState } from 'react'
import { LISTS, PRI } from '../data/checklist.js'
import { EXPLAINERS, ORDER, TOOL_IDS, Thumb } from '../components/Explainers.jsx'
import { TraceWidth, Divider } from '../components/Tools.jsx'
import ItemRow from '../components/ItemRow.jsx'
import ExplainModal from '../components/ExplainModal.jsx'
import { go } from '../lib/router.js'

export default function Reference({ tab }) {
  const [q, setQ] = useState('')
  const [pris, setPris] = useState({ C: true, H: true, M: true, L: true })
  const [modal, setModal] = useState(null)
  const active = tab || 'schematic'
  const list = LISTS[active]

  const openExplain = (x) => (TOOL_IDS.includes(x) ? go('/reference/resources') : setModal(x))
  const needle = q.trim().toLowerCase()
  const sections = new Map()
  for (const it of list?.items || []) {
    if (!pris[it.pri]) continue
    if (needle && !(it.text + it.note + it.section).toLowerCase().includes(needle)) continue
    sections.set(it.section, [...(sections.get(it.section) || []), it])
  }

  return (
    <>
      <h1 className="h1s">Reference</h1>
      <p className="sub2">The full checklist and the animated explainers. Read-only: to tick things off, <a href="#/new">start a review request</a>.</p>
      <nav className="tabs sub" role="tablist">
        {[...Object.entries(LISTS).map(([k, l]) => [k, l.label]), ['resources', 'Explainers & calculators']].map(([k, label]) => (
          <button key={k} role="tab" aria-selected={active === k} className={active === k ? 'on' : ''} onClick={() => go(k === 'schematic' ? '/reference' : `/reference/${k}`)}>{label}</button>
        ))}
      </nav>

      {list && (
        <>
          {active === 'bionic' && <p className="disclaimer">This is an engineering self-review aid. It is <b>not</b> evidence of compliance with medical-device standards (e.g. IEC 60601-1, ISO 14971).</p>}
          <div className="bar">
            <input className="search" type="search" placeholder="Search items…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search items" />
            <div className="chips">
              {Object.entries(PRI).map(([k, name]) => (
                <button key={k} className={`chip p${k} ${pris[k] ? 'on' : ''}`} aria-pressed={pris[k]} onClick={() => setPris((p) => ({ ...p, [k]: !p[k] }))}>{name}</button>
              ))}
            </div>
          </div>
          {sections.size === 0 && <p className="empty">No items match.</p>}
          {[...sections].map(([name, items]) => (
            <details key={name} className="sec" open>
              <summary><h2>{name}</h2><span className="count">{items.length}</span></summary>
              <ul>{items.map((it) => <ItemRow key={it.id} item={it} mode="browse" onExplain={openExplain} />)}</ul>
            </details>
          ))}
        </>
      )}

      {active === 'resources' && (
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
          <div className="tools"><TraceWidth /><Divider /></div>
        </>
      )}
      <ExplainModal id={modal} onClose={() => setModal(null)} onNav={setModal} />
    </>
  )
}
