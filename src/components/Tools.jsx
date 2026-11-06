import { useState } from 'react'

const num = (v) => (Number.isFinite(+v) ? +v : 0)
const fmt = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : '–')

function Field({ label, unit, value, set, step = 'any' }) {
  return (
    <label className="fld">
      <span>{label}</span>
      <div>
        <input type="number" inputMode="decimal" step={step} value={value} onChange={(e) => set(e.target.value)} />
        {unit && <em>{unit}</em>}
      </div>
    </label>
  )
}

export function TraceWidth() {
  const [i, setI] = useState(1)
  const [dt, setDt] = useState(10)
  const [amb, setAmb] = useState(25)
  const [oz, setOz] = useState(1)
  const [len, setLen] = useState(50)
  const [ext, setExt] = useState(true)
  // IPC-2221: I = k * dT^0.44 * A^0.725   (A in mil^2, k = 0.048 outer / 0.024 inner)
  const k = ext ? 0.048 : 0.024
  const area = Math.pow(num(i) / (k * Math.pow(Math.max(num(dt), 0.1), 0.44)), 1 / 0.725)
  const mil = area / (1.378 * Math.max(num(oz), 0.1))
  const min = mil * 0.0254 // mm, the calculated minimum
  const rec = min * 1.5 // mm, with engineering margin
  const t = num(oz) * 35e-6 // m
  const drop = (w) => (w > 0 ? ((1.72e-8 * (num(len) / 1000)) / ((w / 1000) * t)) * num(i) : NaN) // volts, copper at 20 °C
  return (
    <div className="tool">
      <h3>Trace width (IPC-2221)</h3>
      <p>An estimate, not a thermal validation. Use it to sanity-check, then add margin.</p>
      <div className="fields">
        <Field label="Current" unit="A" value={i} set={setI} />
        <Field label="Allowed temp rise" unit="°C" value={dt} set={setDt} />
        <Field label="Ambient" unit="°C" value={amb} set={setAmb} />
        <Field label="Copper" unit="oz" value={oz} set={setOz} />
        <Field label="Trace length" unit="mm" value={len} set={setLen} />
        <label className="fld">
          <span>Layer</span>
          <select value={ext ? 'e' : 'i'} onChange={(e) => setExt(e.target.value === 'e')}>
            <option value="e">Outer</option>
            <option value="i">Inner</option>
          </select>
        </label>
      </div>
      <div className="result">
        <strong>{fmt(min)} mm</strong>
        <span>calculated minimum ({fmt(mil, 1)} mil)</span>
      </div>
      <div className="result">
        <strong>{fmt(rec)} mm</strong>
        <span>suggested with ×1.5 margin · drop ≈ {fmt(drop(rec) * 1000, 0)} mV over {len} mm</span>
      </div>
      <p className="assump">
        Assumes still air, a single isolated trace, copper at 20 °C, and a final trace temperature of about {fmt(num(amb) + num(dt), 0)} °C (ambient + rise). Neighbouring
        heat, pours, vias and enclosures change this – verify high-current paths thermally.
      </p>
    </div>
  )
}

export function Divider() {
  const [mode, setMode] = useState('div')
  const [vin, setVin] = useState(5)
  const [r1, setR1] = useState(10)
  const [r2, setR2] = useState(10)
  const [vref, setVref] = useState(0.8)
  const [tol, setTol] = useState(1)
  const a = num(r1), b = num(r2), e = num(tol) / 100
  const out = (x, y) => (mode === 'div' ? (x + y ? (num(vin) * y) / (x + y) : 0) : num(vref) * (1 + (y ? x / y : 0)))
  const nominal = out(a, b)
  const lo = Math.min(out(a * (1 + e), b * (1 - e)), out(a * (1 - e), b * (1 + e)))
  const hi = Math.max(out(a * (1 + e), b * (1 - e)), out(a * (1 - e), b * (1 + e)))
  const iDiv = mode === 'div' ? num(vin) / ((a + b) * 1000) : nominal / (b * 1000)
  return (
    <div className="tool">
      <h3>Divider &amp; feedback check</h3>
      <p>Recalculate from the actual resistor values. Ideal maths – it ignores load current and the regulator's own tolerance.</p>
      <div className="seg small">
        <button className={mode === 'div' ? 'on' : ''} onClick={() => setMode('div')}>Voltage divider</button>
        <button className={mode === 'fb' ? 'on' : ''} onClick={() => setMode('fb')}>Regulator feedback</button>
      </div>
      <div className="fields">
        {mode === 'div' ? <Field label="Vin" unit="V" value={vin} set={setVin} /> : <Field label="Vref (FB pin)" unit="V" value={vref} set={setVref} />}
        <Field label="Resistor tolerance" unit="%" value={tol} set={setTol} />
        <Field label={mode === 'div' ? 'R1 (top)' : 'R1 (Vout→FB)'} unit="kΩ" value={r1} set={setR1} />
        <Field label={mode === 'div' ? 'R2 (bottom)' : 'R2 (FB→GND)'} unit="kΩ" value={r2} set={setR2} />
      </div>
      <p className="formula">{mode === 'div' ? 'Vout = Vin × R2 / (R1 + R2)' : 'Vout = Vref × (1 + R1 / R2)'}</p>
      <div className="result">
        <strong>{fmt(nominal, 3)} V</strong>
        <span>
          worst case {fmt(lo, 3)} – {fmt(hi, 3)} V · divider current {fmt(iDiv * 1e6, 0)} µA
        </span>
      </div>
      {mode === 'fb' && <p className="assump">Take Vref and the recommended feedback topology from your regulator's datasheet – not every regulator uses this form.</p>}
    </div>
  )
}
