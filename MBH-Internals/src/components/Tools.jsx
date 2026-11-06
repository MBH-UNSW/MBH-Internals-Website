import { useState } from 'react'

const num = (v) => (Number.isFinite(+v) ? +v : 0)

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
  const [oz, setOz] = useState(1)
  const [ext, setExt] = useState(true)
  // IPC-2221: I = k * dT^0.44 * A^0.725  (A in mil^2)
  const k = ext ? 0.048 : 0.024
  const area = Math.pow(num(i) / (k * Math.pow(Math.max(num(dt), 0.1), 0.44)), 1 / 0.725)
  const mil = area / (1.378 * Math.max(num(oz), 0.1))
  const mm = mil * 0.0254
  return (
    <div className="tool">
      <h3>Trace width (IPC-2221)</h3>
      <p>Minimum width for a current. Real boards: add margin and use wider where you can.</p>
      <div className="fields">
        <Field label="Current" unit="A" value={i} set={setI} />
        <Field label="Temp rise" unit="°C" value={dt} set={setDt} />
        <Field label="Copper" unit="oz" value={oz} set={setOz} />
        <label className="fld">
          <span>Layer</span>
          <select value={ext ? 'e' : 'i'} onChange={(e) => setExt(e.target.value === 'e')}>
            <option value="e">Outer</option>
            <option value="i">Inner</option>
          </select>
        </label>
      </div>
      <div className="result">
        <strong>{mm > 0 && Number.isFinite(mm) ? mm.toFixed(2) : '–'} mm</strong>
        <span>{Number.isFinite(mil) ? mil.toFixed(1) : '–'} mil</span>
      </div>
    </div>
  )
}

export function Divider() {
  const [mode, setMode] = useState('div')
  const [vin, setVin] = useState(5)
  const [r1, setR1] = useState(10)
  const [r2, setR2] = useState(10)
  const [vref, setVref] = useState(0.8)
  const a = num(r1), b = num(r2)
  const out = mode === 'div' ? (a + b ? (num(vin) * b) / (a + b) : 0) : num(vref) * (1 + (b ? a / b : 0))
  return (
    <div className="tool">
      <h3>Divider & feedback check</h3>
      <p>Recalculate from the actual resistor values, not from a reference design.</p>
      <div className="seg small">
        <button className={mode === 'div' ? 'on' : ''} onClick={() => setMode('div')}>Voltage divider</button>
        <button className={mode === 'fb' ? 'on' : ''} onClick={() => setMode('fb')}>Buck/LDO feedback</button>
      </div>
      <div className="fields">
        {mode === 'div' ? <Field label="Vin" unit="V" value={vin} set={setVin} /> : <Field label="Vref (FB pin)" unit="V" value={vref} set={setVref} />}
        <Field label={mode === 'div' ? 'R1 (top)' : 'R1 (Vout→FB)'} unit="kΩ" value={r1} set={setR1} />
        <Field label={mode === 'div' ? 'R2 (bottom)' : 'R2 (FB→GND)'} unit="kΩ" value={r2} set={setR2} />
      </div>
      <p className="formula">{mode === 'div' ? 'Vout = Vin × R2 / (R1 + R2)' : 'Vout = Vref × (1 + R1 / R2)'}</p>
      <div className="result">
        <strong>{Number.isFinite(out) ? out.toFixed(3) : '–'} V</strong>
        <span>{mode === 'fb' ? 'check Vref in the IC datasheet' : ''}</span>
      </div>
    </div>
  )
}
