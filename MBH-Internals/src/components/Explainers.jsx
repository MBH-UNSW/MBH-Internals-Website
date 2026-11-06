import { useState } from 'react'

/* ---------- tiny SVG toolkit (Altium-ish look) ---------- */
const WIRE = '#1c2f7a' // schematic wire
const BODY = '#8a1c1c' // schematic part outline
const FILL = '#fff6b8'
const COP = '#e5251b' // PCB top copper
const BOT = '#3b82f6' // PCB bottom copper / returns
const FLOW = '#e5251b'

function Dots({ d, n = 4, dur = 3, color = FLOW, r = 3.4, rev = false }) {
  return Array.from({ length: n }, (_, i) => (
    <circle key={i} r={r} fill={color} className="glow">
      <animateMotion dur={`${dur}s`} begin={`${-(dur * i) / n}s`} repeatCount="indefinite" path={d} keyPoints={rev ? '1;0' : '0;1'} keyTimes="0;1" calcMode="linear" />
    </circle>
  ))
}

function Wire({ d, w = 2, c = WIRE, dash }) {
  return <path d={d} fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dash} />
}

const Txt = ({ x, y, children, c = BODY, s = 11, a = 'middle', b }) => (
  <text x={x} y={y} fill={c} fontSize={s} textAnchor={a} fontWeight={b ? 700 : 500} fontFamily="Inter, system-ui, sans-serif">
    {children}
  </text>
)

const Box = ({ x, y, w, h, label, sub }) => (
  <g>
    <rect x={x} y={y} width={w} height={h} fill={FILL} stroke={BODY} strokeWidth="2" />
    <Txt x={x + w / 2} y={y + h / 2 + (sub ? -2 : 4)} b>{label}</Txt>
    {sub && <Txt x={x + w / 2} y={y + h / 2 + 12} s={9}>{sub}</Txt>}
  </g>
)

const Res = ({ x, y, v = false, label }) => (
  <g>
    <rect x={v ? x - 5 : x} y={v ? y : y - 5} width={v ? 10 : 28} height={v ? 28 : 10} fill={FILL} stroke={BODY} strokeWidth="1.8" />
    {label && <Txt x={v ? x + 14 : x + 14} y={v ? y + 16 : y - 9} a={v ? 'start' : 'middle'} s={10}>{label}</Txt>}
  </g>
)

const Cap = ({ x, y, label }) => (
  <g stroke={BODY} strokeWidth="2.4">
    <line x1={x - 9} y1={y} x2={x + 9} y2={y} />
    <line x1={x - 9} y1={y + 7} x2={x + 9} y2={y + 7} />
    {label && <text x={x + 14} y={y + 8} fill={BODY} stroke="none" fontSize="10" fontFamily="Inter">{label}</text>}
  </g>
)

const Gnd = ({ x, y }) => (
  <g stroke={WIRE} strokeWidth="2">
    <line x1={x} y1={y} x2={x} y2={y + 6} />
    <line x1={x - 10} y1={y + 6} x2={x + 10} y2={y + 6} />
    <line x1={x - 6} y1={y + 10} x2={x + 6} y2={y + 10} />
    <line x1={x - 2.5} y1={y + 14} x2={x + 2.5} y2={y + 14} />
  </g>
)

const Diode = ({ x, y, up = false }) => (
  // vertical diode centred on x, spanning y..y+24, anode at bottom if up
  <g stroke={BODY} strokeWidth="2" fill={FILL}>
    {up ? <path d={`M${x - 8},${y + 18} L${x + 8},${y + 18} L${x},${y + 4} Z`} /> : <path d={`M${x - 8},${y + 4} L${x + 8},${y + 4} L${x},${y + 18} Z`} />}
    <line x1={x - 8} y1={up ? y + 4 : y + 18} x2={x + 8} y2={up ? y + 4 : y + 18} />
  </g>
)

const Dot = ({ x, y }) => <circle cx={x} cy={y} r="3.3" fill={WIRE} />

/* animated "noisy" scope trace; all variants share point count so SMIL can morph them */
function noise(w, base, amp, seed, step = 6) {
  let s = seed
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280 - 0.5) * 2
  let d = ''
  for (let x = 0; x <= w; x += step) d += `${x === 0 ? 'M' : 'L'}${x},${(base + rnd() * amp).toFixed(1)} `
  return d
}
function NoisyTrace({ w, base, amp, color = FLOW, speed = 0.5 }) {
  const v = [1, 2, 3, 4].map((k) => noise(w, base, amp, k * 77 + 5))
  return (
    <path fill="none" stroke={color} strokeWidth="1.8" d={v[0]}>
      <animate attributeName="d" dur={`${speed}s`} repeatCount="indefinite" values={[...v, v[0]].join(';')} />
    </path>
  )
}

function Scope({ x, y, w = 160, h = 56, title, children }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect width={w} height={h} rx="4" fill="#0e1a12" stroke="#2c4a36" />
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1="0" x2={w} y1={h * f} y2={h * f} stroke="#1f3a29" strokeWidth="0.7" />
      ))}
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} y1="0" y2={h} x1={w * f} x2={w * f} stroke="#1f3a29" strokeWidth="0.7" />
      ))}
      {title && <text x="5" y="-4" fontSize="9.5" fill="#666" fontFamily="Inter">{title}</text>}
      <g>{children}</g>
    </g>
  )
}

const Sweep = ({ d, c = '#4ade80', dur = 4 }) => (
  <path d={d} fill="none" stroke={c} strokeWidth="2" pathLength="1" className="sweep" style={{ animationDuration: `${dur}s` }} />
)

const Pcb = ({ children }) => (
  <>
    <rect width="420" height="230" fill="#0d0f10" />
    <pattern id="grid" width="14" height="14" patternUnits="userSpaceOnUse">
      <circle cx="1" cy="1" r="0.8" fill="#23282b" />
    </pattern>
    <rect width="420" height="230" fill="url(#grid)" />
    {children}
  </>
)
const Sch = ({ children }) => (
  <>
    <rect width="420" height="230" fill="#fffdf0" />
    <pattern id="sgrid" width="14" height="14" patternUnits="userSpaceOnUse">
      <circle cx="1" cy="1" r="0.8" fill="#eadfae" />
    </pattern>
    <rect width="420" height="230" fill="url(#sgrid)" />
    {children}
  </>
)
const PTxt = (p) => <Txt c="#c9ced1" {...p} />
const Bad = ({ x = 405, y = 22, t }) => {
  const w = t.length * 6.4 + 22
  return (
    <g>
      <rect x={x - w} y={y - 14} width={w} height="20" rx="10" fill="#e5251b" opacity=".94" />
      <Txt x={x - w / 2} y={y} c="#fff" s={10.5} b>{t}</Txt>
    </g>
  )
}
const Good = ({ x = 405, y = 22, t }) => {
  const w = t.length * 6.4 + 22
  return (
    <g>
      <rect x={x - w} y={y - 14} width={w} height="20" rx="10" fill="#1f9d55" opacity=".94" />
      <Txt x={x - w / 2} y={y} c="#fff" s={10.5} b>{t}</Txt>
    </g>
  )
}

/* ---------- 1. Decoupling ---------- */
function Decoupling({ good }) {
  const cx = good ? 222 : 82
  const loop = `M${cx},105 H250 V150 H${cx} Z`
  return (
    <>
      <Pcb>
        <rect x="250" y="82" width="96" height="86" rx="6" fill="#1a1d1f" stroke="#555" strokeWidth="1.5" />
        <PTxt x="298" y="130" s="12" b>MCU</PTxt>
        <Wire c={COP} w={4} d="M20,105 H250" />
        <Wire c={BOT} w={4} d="M20,150 H250" />
        <rect x="250" y="99" width="12" height="12" fill="#d4b24c" />
        <rect x="250" y="144" width="12" height="12" fill="#d4b24c" />
        <PTxt x="278" y="108" s="9">VDD</PTxt>
        <PTxt x="278" y="153" s="9">GND</PTxt>
        <rect x={cx - 7} y="117" width="14" height="22" fill="#b9bec2" />
        <PTxt x={cx + 12} y="132" s="10" a="start" b>100nF</PTxt>
        <Wire c={COP} w={3} d={`M${cx},105 V117`} />
        <Wire c={BOT} w={3} d={`M${cx},139 V150`} />
        <Dots d={loop} n={good ? 3 : 4} dur={good ? 0.9 : 3.4} />
        <Wire c="#ffffff33" w={1} d={`M${cx},105 H250 V150 H${cx} Z`} dash="3 3" />
        <PTxt x={(cx + 250) / 2} y="95" s="10" c={good ? '#4ade80' : '#ff8a80'} b>{good ? 'tiny loop, ~2 mm' : 'big loop, ~60 mm = high inductance'}</PTxt>
        <Scope x="20" y="180" w="380" h="40" title="VDD at the MCU pin">
          <Sweep dur={4} c={good ? '#4ade80' : '#ff6b5e'} d={good ? 'M0,14 H50 l3,5 l4,-5 H130 l3,5 l4,-5 H220 l3,5 l4,-5 H300 l3,5 l4,-5 H380' : 'M0,10 H45 l6,24 l10,-24 H120 l6,26 l10,-26 H200 l6,22 l10,-22 H290 l6,26 l10,-26 H380'} />
        </Scope>
      </Pcb>
      {good ? <Good t="Cap right at the pin" /> : <Bad t="Cap far from the pin" />}
    </>
  )
}

/* ---------- 2. Floating pin ---------- */
function Floating({ good }) {
  const sq = ['M0,40 H20 V10 H35 V40 H70 V10 H80 V40 H120 V10 H160', 'M0,10 H15 V40 H40 V10 H62 V40 H90 V10 H100 V40 H160', 'M0,40 H30 V10 H50 V40 H66 V10 H110 V40 H130 V10 H160', 'M0,10 H25 V40 H55 V10 H85 V40 H105 V10 H150 V40 H160']
  return (
    <>
      <Sch>
        <Wire d="M40,100 H150" />
        {!good && <circle cx="40" cy="100" r="4" fill="none" stroke={BODY} strokeWidth="2" />}
        {!good && <Txt x="40" y="86" s="10" c="#c0392b" b>floating!</Txt>}
        {good && (
          <>
            <Dot x={100} y={100} />
            <Wire d="M100,100 V122" />
            <Res x={100} y={122} v label="10k" />
            <Wire d="M100,150 V160" />
            <Gnd x={100} y={160} />
          </>
        )}
        <path d="M150,70 L150,130 L215,100 Z" fill={FILL} stroke={BODY} strokeWidth="2" />
        <Txt x="165" y="104" s="9">IN</Txt>
        <Wire d="M215,100 H300" />
        <Box x={300} y={80} w={70} h={40} label="Next stage" />
        <Txt x="190" y="150" s="10">74HC gate</Txt>
        <Scope x="30" y="170" w="360" h="50" title="Gate output">
          {good ? (
            <Sweep c="#4ade80" d="M0,40 H360" />
          ) : (
            <g transform="scale(2.25,1)">
              <path fill="none" stroke="#ff6b5e" strokeWidth="2" vectorEffect="non-scaling-stroke" d={sq[0]}>
                <animate attributeName="d" dur="0.8s" repeatCount="indefinite" values={[...sq, sq[0]].join(';')} />
              </path>
            </g>
          )}
        </Scope>
      </Sch>
      {good ? <Good t="Pulled to a known level" /> : <Bad t="Floating input" />}
    </>
  )
}

/* ---------- 3. Pull-up ---------- */
function Pullup({ good }) {
  const goodWave = 'M0,10 H40 V40 H80 C86,40 90,12 98,10 H140 V40 H180 C186,40 190,12 198,10 H240 V40 H280 C286,40 290,12 298,10 H340'
  const badWave = 'M0,10 H40 V40 H80 C120,40 150,38 180,37 H200 V40 H280 C300,40 320,39 340,38'
  return (
    <>
      <Sch>
        <Box x={30} y={100} w={80} h={50} label="MCU" sub="I2C master" />
        <Box x={310} y={100} w={80} h={50} label="Sensor" sub="open-drain" />
        <Wire d="M110,125 H310" />
        <Txt x="210" y="118" s="10" c={BODY}>SDA</Txt>
        {good && (
          <>
            <Wire d="M210,125 V90" />
            <Dot x={210} y={125} />
            <Res x={210} y={62} v label="4.7k" />
            <Wire d="M210,62 V48 M196,48 H224" />
            <Txt x="210" y="40" s="10" b>3V3</Txt>
          </>
        )}
        <Dots d="M310,125 H110" n={good ? 3 : 1} dur={3} color={BOT} />
        <Scope x="40" y="165" w="340" h="52" title="SDA seen on the scope">
          <Sweep d={good ? goodWave : badWave} c={good ? '#4ade80' : '#ff6b5e'} dur={5} />
        </Scope>
      </Sch>
      {good ? <Good t="Line can return high" /> : <Bad t="No pull-up: stuck low" />}
    </>
  )
}

/* ---------- 4. UART crossover ---------- */
function Uart({ good }) {
  return (
    <>
      <Sch>
        <Box x={30} y={70} w={90} h={90} label="Device A" />
        <Box x={300} y={70} w={90} h={90} label="Device B" />
        <Txt x="127" y="98" a="start" s="10">TX</Txt>
        <Txt x="127" y="138" a="start" s="10">RX</Txt>
        <Txt x="293" y="98" a="end" s="10">TX</Txt>
        <Txt x="293" y="138" a="end" s="10">RX</Txt>
        {good ? (
          <>
            <Wire d="M120,94 L300,134" />
            <Wire d="M120,134 L300,94" />
            <Dots d="M120,94 L300,134" n={3} dur={2.4} />
            <Dots d="M300,94 L120,134" n={3} dur={2.4} color={BOT} />
          </>
        ) : (
          <>
            <Wire d="M120,94 H300" c="#c0392b" />
            <Wire d="M120,134 H300" c="#c0392b" />
            <Dots d="M120,94 H210" n={2} dur={1.6} />
            <Dots d="M300,94 H210" n={2} dur={1.6} color={BOT} />
            <circle cx="210" cy="94" r="10" fill="none" stroke="#e5251b" strokeWidth="2.5">
              <animate attributeName="r" values="6;16;6" dur="1.2s" repeatCount="indefinite" />
            </circle>
            <Txt x="210" y="76" c="#c0392b" b s="11">collision!</Txt>
          </>
        )}
        <Txt x="210" y="195" s="12" b c={WIRE}>{good ? 'TX → RX and RX → TX' : 'TX wired to TX, RX wired to RX'}</Txt>
      </Sch>
      {good ? <Good t="Crossed correctly" /> : <Bad t="Not crossed" />}
    </>
  )
}

/* ---------- 5. Flyback diode ---------- */
function Flyback({ good }) {
  const T = 4
  return (
    <>
      <Sch>
        <Txt x="120" y="30" s="11" b>+12V</Txt>
        <Wire d="M100,40 H140" />
        <Wire d="M120,40 V70" />
        {/* coil */}
        <rect x="104" y="70" width="32" height="64" rx="8" fill={FILL} stroke={BODY} strokeWidth="2" />
        <Txt x="120" y="106" s="11" b>K1</Txt>
        <Txt x="96" y="106" a="end" s="9">relay coil</Txt>
        <Wire d="M120,134 V150" />
        <Dot x={120} y={150} />
        {good && (
          <>
            <Wire d="M120,150 H168 V40 H120" />
            <Dot x={120} y={40} />
            <Diode x={168} y={74} />
            <Txt x="180" y="92" a="start" s="10">D1</Txt>
          </>
        )}
        {/* switch */}
        <Wire d="M120,150 V162" />
        <circle cx="120" cy="164" r="3" fill={WIRE} />
        <g>
          <line x1="120" y1="164" x2="120" y2="196" stroke={BODY} strokeWidth="3" strokeLinecap="round">
            <animateTransform attributeName="transform" type="rotate" dur={`${T}s`} repeatCount="indefinite" values="0 120 164;0 120 164;32 120 164;32 120 164;0 120 164" keyTimes="0;0.45;0.5;0.95;1" />
          </line>
        </g>
        <Wire d="M120,196 V204" />
        <Gnd x={120} y={204} />
        <Txt x="150" y="190" a="start" s="10">switch</Txt>
        {/* current while closed */}
        <g>
          <animate attributeName="opacity" dur={`${T}s`} repeatCount="indefinite" values="1;1;0;0;1" keyTimes="0;0.45;0.48;0.98;1" />
          <Dots d="M120,40 V196" n={4} dur={1.6} />
        </g>
        {/* after opening */}
        {good ? (
          <g>
            <animate attributeName="opacity" dur={`${T}s`} repeatCount="indefinite" values="0;0;1;1;0" keyTimes="0;0.5;0.53;0.95;1" />
            <Dots d="M120,150 H168 V40 H120 V150" n={4} dur={1.8} color="#1f9d55" />
          </g>
        ) : (
          <g>
            <animate attributeName="opacity" dur={`${T}s`} repeatCount="indefinite" values="0;0;1;0;0" keyTimes="0;0.5;0.52;0.7;1" />
            <path d="M118,166 l8,-14 l-4,0 l9,-16 M126,170 l14,-6 M112,176 l-14,8" stroke="#f5b400" strokeWidth="3" fill="none" strokeLinecap="round" />
            <Txt x="160" y="160" a="start" c="#c0392b" b s="12">ZAP!</Txt>
          </g>
        )}
        <Scope x="230" y="70" w="170" h="90" title="Voltage at the switch (V)">
          <line x1="0" x2="170" y1="62" y2="62" stroke="#3a5a46" strokeWidth="1" strokeDasharray="3 3" />
          <text x="3" y="58" fontSize="8" fill="#6a9a7c" fontFamily="Inter">+12 V</text>
          <Sweep dur={T} c={good ? '#4ade80' : '#ff6b5e'} d={good ? 'M0,80 H70 V58 L75,56 L100,60 H170' : 'M0,80 H70 V6 L76,40 L90,62 H170'} />
        </Scope>
        <Txt x="315" y="188" s="11" b c={good ? '#1f9d55' : '#c0392b'}>{good ? 'clamped to ≈12.7 V' : 'spike: tens to hundreds of V'}</Txt>
      </Sch>
      {good ? <Good t="Diode gives the current a path" /> : <Bad t="No flyback diode" />}
    </>
  )
}

/* ---------- 6. Star ground ---------- */
function StarGnd({ good }) {
  return (
    <>
      <Sch>
        <Box x={20} y={30} w={64} h={34} label="Supply" />
        <Box x={190} y={30} w={74} h={34} label="Motor" sub="PGND" />
        <Box x={330} y={30} w={70} h={34} label="ADC sensor" sub="AGND" />
        {good ? (
          <>
            <Wire d="M52,64 V150" />
            <Wire d="M52,150 H227 V64" w={3} c={BODY} />
            <Wire d="M52,172 H365 V64" w={3} c="#1f7a8c" />
            <circle cx="52" cy="150" r="7" fill={FILL} stroke={BODY} strokeWidth="2.5" />
            <Txt x="52" y="196" b s="11">single star point</Txt>
            <Dots d="M227,64 V150 H52" n={5} dur={2} />
            <Dots d="M365,64 V172 H52" n={1} dur={4} color={BOT} r={2.6} />
            <Txt x="140" y="144" s="10">PGND</Txt>
            <Txt x="200" y="166" s="10" c="#1f7a8c">AGND</Txt>
          </>
        ) : (
          <>
            <Wire d="M52,64 V160 H227 V64" w={3} c={BODY} />
            <Wire d="M147,160 V120 H365 V64" w={3} c="#c0392b" />
            <Dot x={147} y={160} />
            <Dots d="M227,64 V160 H52" n={5} dur={2} />
            <rect x="52" y="148" width="95" height="24" fill="#e5251b" opacity=".16" />
            <Txt x="100" y="188" s="10" c="#c0392b" b>shared segment: IR drop</Txt>
            <Txt x="100" y="200" s="10" c="#c0392b" b>motor current bounces sensor GND</Txt>
          </>
        )}
        <Scope x="272" y="140" w="128" h="50" title="ADC reading">
          {good ? <Sweep c="#4ade80" d="M0,25 H128" /> : <NoisyTrace w={128} base={25} amp={34} speed={0.7} />}
        </Scope>
      </Sch>
      {good ? <Good t="Returns meet at one point" /> : <Bad t="Return paths shared" />}
    </>
  )
}

/* ---------- 7. Plane split ---------- */
function PlaneSplit({ good }) {
  return (
    <>
      <Pcb>
        <rect x="20" y="40" width="380" height="170" fill="#16294a" stroke="#27457a" />
        <PTxt x="360" y="203" s="10">GND plane (layer 2)</PTxt>
        {!good && <rect x="196" y="40" width="16" height="116" fill="#0d0f10" />}
        {!good && <PTxt x="204" y="34" s="10">slot</PTxt>}
        <polygon points={good ? '30,92 390,92 390,106 30,106' : '30,92 390,92 390,106 218,106 218,168 190,168 190,106 30,106'} fill="#ff4d3d" opacity=".22" />
        <Wire c="#7fb0ff" w={1.5} d={good ? 'M390,106 H30' : 'M390,106 H218 V168 H190 V106 H30'} dash="4 3" />
        <Wire c={COP} w={5} d="M30,92 H390" />
        <PTxt x="60" y="84" s="10" b>signal on top layer</PTxt>
        <Dots d="M30,92 H390" n={4} dur={3.2} color="#ffd1cc" r={3} />
        <Dots d={good ? 'M390,106 H30' : 'M390,106 H218 V168 H190 V106 H30'} n={good ? 4 : 5} dur={good ? 3.2 : 4.4} color="#7fb0ff" r={3} />
        <PTxt x="210" y="228" s="11" c={good ? '#4ade80' : '#ff8a80'} b>{good ? 'return current hugs the trace: tiny loop' : 'return current must detour around the slot: huge loop = EMI'}</PTxt>
      </Pcb>
      {good ? <Good t="Unbroken reference plane" /> : <Bad t="Trace crosses a gap" />}
    </>
  )
}

/* ---------- 8. Thermal vias ---------- */
function ThermalVia({ good }) {
  const hot = good ? 0.35 : 0.9
  return (
    <>
      <Pcb>
        <defs>
          <radialGradient id={good ? 'heat-good' : 'heat-bad'}>
            <stop offset="0" stopColor="#ff3b1d" stopOpacity={hot} />
            <stop offset="1" stopColor="#ff3b1d" stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* board cross-section */}
        <rect x="20" y="86" width="380" height="14" fill="#c8a24a" />
        <rect x="20" y="100" width="380" height="30" fill="#2a5a3c" />
        <rect x="20" y="130" width="380" height="12" fill="#c8a24a" />
        <rect x="20" y="142" width="380" height="30" fill="#2a5a3c" />
        <rect x="20" y="172" width="380" height="14" fill="#c8a24a" />
        <PTxt x="26" y="97" s="9" c="#222" a="start">top copper</PTxt>
        <PTxt x="26" y="140" s="9" c="#222" a="start">GND plane</PTxt>
        {/* IC */}
        <rect x="150" y="46" width="120" height="38" rx="4" fill="#222" stroke="#666" />
        <PTxt x="210" y="70" s="11" b>Power IC</PTxt>
        <circle cx="210" cy="64" r="70" fill={`url(#heat-${good ? 'good' : 'bad'})`}>
          <animate attributeName="r" values="60;78;60" dur="1.6s" repeatCount="indefinite" />
        </circle>
        {good &&
          [186, 204, 222, 240].map((x) => (
            <g key={x}>
              <rect x={x - 3} y="100" width="6" height="30" fill="#c8a24a" />
              <Dots d={`M${x},86 V130 ${x < 213 ? 'H40' : 'H380'}`} n={2} dur={3.2} color="#ffb199" r={2.6} />
            </g>
          ))}
        {!good && (
          <g>
            <Dots d="M210,86 V96" n={2} dur={1} color="#ffb199" r={2.6} />
            <PTxt x="210" y="116" s="10" c="#ff8a80" b>heat trapped in the pad</PTxt>
          </g>
        )}
        <rect x="190" y="84" width="40" height="4" fill="#d4b24c" />
        <PTxt x="210" y="30" s="12" b c={good ? '#4ade80' : '#ff8a80'}>{good ? 'Tj stays cool' : 'Tj climbing…'}</PTxt>
        <PTxt x="210" y="210" s="11">{good ? 'EPAD → via array → ground plane spreads the heat' : 'No vias: only a thin top layer to carry heat away'}</PTxt>
      </Pcb>
      {good ? <Good t="Thermal via array" /> : <Bad t="No thermal path" />}
    </>
  )
}

/* ---------- 9. Stub reflections ---------- */
function Stub({ good }) {
  return (
    <>
      <Pcb>
        <rect x="20" y="86" width="40" height="28" rx="4" fill="#1a1d1f" stroke="#666" />
        <PTxt x="40" y="104" s="10" b>TX</PTxt>
        <rect x="360" y="86" width="40" height="28" rx="4" fill="#1a1d1f" stroke="#666" />
        <PTxt x="380" y="104" s="10" b>RX</PTxt>
        <Wire c={COP} w={4} d="M60,100 H360" />
        {!good && <Wire c={COP} w={4} d="M230,100 V165" />}
        {!good && <circle cx="230" cy="168" r="5" fill="none" stroke="#ff8a80" strokeWidth="2" />}
        {!good && <PTxt x="262" y="170" s="10" a="start" c="#ff8a80" b>open stub</PTxt>}
        <circle r="4.5" fill="#ffe9e6" className="glow">
          <animateMotion dur="3s" repeatCount="indefinite" path="M60,100 H360" />
        </circle>
        {!good && (
          <circle r="4.5" fill="#ff8a80" className="glow">
            <animateMotion dur="3s" begin="1.35s" repeatCount="indefinite" path="M230,100 V165 V100 H70" />
            <animate attributeName="opacity" dur="3s" begin="1.35s" repeatCount="indefinite" values="1;1;1;0" keyTimes="0;0.6;0.9;1" />
          </circle>
        )}
        <Scope x="60" y={good ? 140 : 188} w="300" h={good ? 60 : 34} title="Edge seen at the receiver">
          {good ? <Sweep dur={3} c="#4ade80" d="M0,44 H60 L66,12 H300" /> : <Sweep dur={3} c="#ff6b5e" d="M0,28 H40 L44,8 L52,22 L60,5 L70,20 L80,8 L92,16 L110,10 H300" />}
        </Scope>
        <PTxt x="210" y="60" s="11" c={good ? '#4ade80' : '#ff8a80'} b>{good ? 'one clean path: edge arrives once' : 'edge splits, bounces off the stub end and returns later'}</PTxt>
      </Pcb>
      {good ? <Good t="Point-to-point" /> : <Bad t="Stub / dangling trace" />}
    </>
  )
}

/* ---------- 10. RC filter ---------- */
function RcFilter({ good }) {
  const sine = 'M0,25 C20,0 40,0 60,25 S100,50 120,25 S160,0 180,25 S220,50 240,25 S280,0 300,25 S340,50 360,25'
  return (
    <>
      <Sch>
        <Box x={20} y={72} w={72} h={44} label="Sensor" sub="noisy" />
        <Box x={330} y={72} w={72} h={44} label="ADC pin" />
        <Wire d="M92,94 H330" />
        {good && (
          <>
            <Res x={150} y={94} label="1k" />
            <Wire d="M232,94 V120" />
            <Dot x={232} y={94} />
            <Wire d="M232,94 V122" />
            <Cap x={232} y={122} label="10nF" />
            <Wire d="M232,136 V146" />
            <Gnd x={232} y={146} />
            <Txt x="232" y="180" s="10" b>fc = 1/(2π·R·C) ≈ 16 kHz</Txt>
          </>
        )}
        <Scope x="30" y="168" w="360" h="52" title="what the ADC samples" />
        <g transform="translate(30,168)">
          {good ? <Sweep d={sine} c="#4ade80" dur={5} /> : <NoisyTrace w={360} base={26} amp={40} speed={0.5} />}
        </g>
      </Sch>
      {good ? <Good t="RC filter in front of ADC" /> : <Bad t="Noise goes straight in" />}
    </>
  )
}

/* ---------- 11. Diff pair ---------- */
function DiffPair({ good }) {
  const A = good ? 'M40,90 H150 V62 H210 V90 H390' : 'M40,90 H390'
  const B = 'M40,150 H150 V178 H210 V150 H390'
  const lenA = good ? 420 : 350
  const tA = lenA / 420 // fraction of cycle used travelling
  const kt = (f) => `0;${(f * 0.8).toFixed(3)};1`
  const pulse = (d, f, c) => (
    <circle r="5" fill={c} className="glow">
      <animateMotion dur="4s" repeatCount="indefinite" path={d} keyPoints="0;1;1" keyTimes={kt(f)} calcMode="linear" />
    </circle>
  )
  return (
    <>
      <Pcb>
        <rect x="14" y="76" width="28" height="88" rx="3" fill="#1a1d1f" stroke="#666" />
        <rect x="388" y="76" width="28" height="88" rx="3" fill="#1a1d1f" stroke="#666" />
        <Wire c={COP} w={4} d={A} />
        <Wire c={COP} w={4} d={B} />
        <PTxt x="75" y="82" s="10" a="middle" b>D+</PTxt>
        <PTxt x="75" y="142" s="10" b>D−</PTxt>
        {pulse(A, tA, '#fff')}
        {pulse(B, 1, '#ffd1cc')}
        <line x1="388" x2="388" y1="60" y2="190" stroke={good ? '#4ade80' : '#ff8a80'} strokeDasharray="4 4" />
        <PTxt x="210" y="56" s="11" b c={good ? '#4ade80' : '#ff8a80'}>
          {good ? 'serpentine tuning: both edges arrive together' : 'D− is longer: edges arrive at different times (skew)'}
        </PTxt>
        <PTxt x="210" y="214" s="10">{good ? 'length D+ = length D−' : 'length D+ < length D−'}</PTxt>
      </Pcb>
      {good ? <Good t="Length matched" /> : <Bad t="Skew between pair" />}
    </>
  )
}

/* ---------- 12. Via in pad ---------- */
function ViaInPad({ good }) {
  const hx = good ? 330 : 210
  return (
    <>
      <Pcb>
        {/* substrate */}
        <rect x="20" y="108" width="380" height="60" fill="#2a5a3c" />
        <rect x="20" y="100" width="380" height="8" fill="#c8a24a" />
        <rect x="20" y="168" width="380" height="8" fill="#c8a24a" />
        {/* pad area (gap the via hole) */}
        <rect x={hx - 9} y="96" width="18" height="84" fill="#0d0f10" />
        <rect x={hx - 9} y="100" width="2" height="76" fill="#c8a24a" />
        <rect x={hx + 7} y="100" width="2" height="76" fill="#c8a24a" />
        {good && <rect x="319" y="94" width="22" height="8" fill="#2f7a4d" />}
        {/* component lead */}
        <rect x="160" y="58" width="100" height="24" rx="3" fill="#1f2326" stroke="#666" />
        <PTxt x="210" y="74" s="10" b>IC pin</PTxt>
        {/* solder */}
        {good ? (
          <ellipse cx="210" cy="90" rx="52" ry="12" fill="#cfd3d6" />
        ) : (
          <ellipse cx="210" cy="92" rx="52" ry="12" fill="#cfd3d6">
            <animate attributeName="ry" values="12;12;4;4;12" dur="4s" repeatCount="indefinite" keyTimes="0;0.2;0.7;0.9;1" />
            <animate attributeName="cy" values="92;92;96;96;92" dur="4s" repeatCount="indefinite" keyTimes="0;0.2;0.7;0.9;1" />
          </ellipse>
        )}
        {!good && (
          <circle r="6" fill="#cfd3d6">
            <animateMotion dur="4s" repeatCount="indefinite" path="M210,98 V196" keyPoints="0;0;1;1" keyTimes="0;0.2;0.8;1" />
            <animate attributeName="opacity" dur="4s" repeatCount="indefinite" values="0;1;1;0;0" keyTimes="0;0.2;0.7;0.95;1" />
          </circle>
        )}
        <PTxt x="210" y="46" s="11" b c={good ? '#4ade80' : '#ff8a80'}>{good ? 'via moved beside the pad (and tented)' : 'solder drains down the hole'}</PTxt>
        <PTxt x="210" y="214" s="10">{good ? 'full solder joint on the pad' : 'starved joint = cold joint / tombstoning'}</PTxt>
      </Pcb>
      {good ? <Good t="Via next to the pad" /> : <Bad t="Open via in pad" />}
    </>
  )
}

/* ---------- registry ---------- */
export const EXPLAINERS = {
  decoupling: {
    title: 'Decoupling capacitor placement',
    blurb: "A fast IC pulls current in tiny bursts. The cap is the local fuel tank, but only if the loop to it is short. Every mm of trace is inductance that stops the cap helping.",
    Cmp: Decoupling,
    bad: 'Cap is far away: the burst has to travel a long loop, the rail droops and radiates.',
    good: 'Cap sits at the pin: tiny loop, tiny inductance, a clean rail.',
    altium: ['PCB: place the cap first, then route IC pin → cap pad → via. The cap should be between the pin and the via, not the other way round.', 'Schematic: add a text note next to the cap, e.g. "place within 2 mm of U1 pin 12", so the layout person sees it (Place → Text String).', 'Press Shift+S for single-layer mode to check the bypass loop stays on one layer.'],
  },
  floating: {
    title: 'Floating & undefined pins',
    blurb: 'A CMOS input with nothing driving it picks up noise and can sit half-way between 0 and 1, so the output chatters and burns current. Give every input a defined level.',
    Cmp: Floating,
    bad: 'Input connected to nothing: the output oscillates randomly.',
    good: 'A 10k resistor to GND (or a rail) sets a known level.',
    altium: ['Intentional no-connect? Use Place → Directives → Generic No ERC (or a No ERC marker) so ERC knows you meant it.', 'Run Project → Validate PCB Project and open the Messages panel – review every "unconnected pin" style warning rather than clearing them in bulk.', 'Unused op-amp: wire as a follower to a mid-rail reference instead of leaving pins open.'],
  },
  pullup: {
    title: 'Open-drain & I2C pull-ups',
    blurb: 'Open-drain outputs can only pull a line LOW. Something else has to pull it HIGH. With no pull-up the line never recovers, so there are no valid 1s.',
    Cmp: Pullup,
    bad: 'Without a resistor to 3V3, SDA only goes down and stays there.',
    good: 'The resistor pulls SDA high when nobody drives it low: a proper square wave.',
    altium: ['Put one pull-up per line on the bus, on the same net label, once – not one per device.', 'Name the nets I2C_SDA / I2C_SCL on every sheet so ERC and the PCB agree.', 'Check the pull-up goes to the rail the devices are powered from (not 5V into a 3V3 part).'],
  },
  uart: {
    title: 'UART TX / RX crossover',
    blurb: 'TX means "I transmit on this pin". The other device must listen on that wire, so it has to arrive at its RX pin.',
    Cmp: Uart,
    bad: 'TX to TX and RX to RX: two outputs fight, nobody listens.',
    good: 'TX → RX and RX → TX.',
    altium: ['Name the nets from the *device* point of view e.g. MCU_TX / MCU_RX, and use net labels on both sheets.', 'On connector footprints, label the pin names (TX/RX) on the silkscreen from the *cable* point of view and note it.'],
  },
  flyback: {
    title: 'Flyback diode on inductive loads',
    blurb: "An inductor won't let its current stop instantly. When the switch opens the coil forces current anyway, so the voltage rockets up until something breaks down: your transistor.",
    Cmp: Flyback,
    bad: 'Switch opens, the coil kicks the node up to a huge voltage.',
    good: 'The diode gives the coil current a loop to circulate in; the node is clamped.',
    altium: ['Diode cathode to the +V side of the coil, anode to the switched side (reverse-biased in normal operation).', 'Place it right across the coil terminals on the PCB, close to the relay/motor connector.'],
  },
  stargnd: {
    title: 'AGND / PGND star point',
    blurb: 'Return current of a motor is big and noisy. If it shares a ground segment with a sensor, Ohm\'s law (V = I·R) puts that noise on the sensor reference. Keep them separate, join them in one place.',
    Cmp: StarGnd,
    bad: 'Shared ground segment: motor current changes the sensor\'s ground.',
    good: 'Separate returns joined at a single star point.',
    altium: ['Use distinct nets (AGND, PGND) and join them at one location with a Net Tie component or a 0 Ω resistor so ERC and DRC stay happy.', 'Do not rely on different ground *symbols* – a symbol style can silently join or split nets. Check the net in the Navigator panel.'],
  },
  planesplit: {
    title: 'Return paths & plane splits',
    blurb: 'Current flows in a loop. At high frequency the return follows right under the signal. A slot in the plane forces a detour, creating a big loop antenna.',
    Cmp: PlaneSplit,
    bad: 'Return current detours around the slot: large loop, EMI, crosstalk.',
    good: 'Solid plane under the trace: the loop is tiny.',
    altium: ['Press Shift+S for single-layer mode and look at the plane layer under every fast trace.', 'Never route across a slot or a polygon-pour cut-out; add a stitching cap or re-route.', 'Check polygon "Remove dead copper" is not leaving gaps (Polygon properties).'],
  },
  thermalvia: {
    title: 'Thermal vias under EPADs',
    blurb: 'A power IC\'s heat leaves mainly through its exposed pad. Thermal vias carry it to the inner ground plane, which spreads it across the whole board.',
    Cmp: ThermalVia,
    bad: 'No vias: heat is trapped, junction temperature climbs.',
    good: 'Via array from the EPAD to the ground plane.',
    altium: ['Check the IC\'s datasheet land-pattern page for the recommended via count, drill and pitch.', 'Tools → Via Stitching/Shielding → Add Stitching to Net can fill an array in the pad area.', 'Make sure the vias connect to the correct plane (the EPAD net, usually GND).'],
  },
  stub: {
    title: 'Stubs & reflections',
    blurb: 'An edge reaching a branch splits. The part going down the stub hits the open end and reflects back, corrupting the signal with ringing.',
    Cmp: Stub,
    bad: 'Open stub: reflections come back and ring on the line.',
    good: 'Point-to-point, no branches.',
    altium: ['Design → Rules → Manufacturing → Net Antennae flags dangling copper. Tools → Design Rule Check will report it.', 'For multiple loads (clock) route a daisy-chain with the load last, or use series termination at the source.'],
  },
  rcfilter: {
    title: 'RC anti-aliasing filter',
    blurb: 'An ADC samples whatever is on its pin, including noise above half the sample rate, which folds back as a false signal. A series R and a cap to ground remove that noise first.',
    Cmp: RcFilter,
    bad: 'Raw noise reaches the ADC.',
    good: 'R + C smooth the input; fc = 1/(2πRC).',
    altium: ['Place the capacitor right at the ADC pin and route signal → R → C → pin so the cap sees the pin.', 'Keep the ADC reference (VREF) filtered separately from the digital 3V3.'],
  },
  diffpair: {
    title: 'Differential-pair length matching',
    blurb: 'A differential receiver looks at the difference between D+ and D−. If one edge arrives late, the difference is distorted and the common-mode noise rises.',
    Cmp: DiffPair,
    bad: 'D− is longer, so the edges arrive at different times.',
    good: 'Meander the short trace until both lengths match.',
    altium: ['Schematic: Place → Directives → Differential Pair, with nets named _P / _N.', 'PCB: Design → Rules → High Speed → Matched Lengths; route with Route → Interactive Differential Pair Routing, then tune with Route → Interactive Length Tuning (shortcut T, R).'],
  },
  viainpad: {
    title: 'Via-in-pad & solder wicking',
    blurb: 'Molten solder follows capillary action. An open via inside a pad sucks it away from the joint, so the part is left with too little solder.',
    Cmp: ViaInPad,
    bad: 'Solder drains into the hole.',
    good: 'Move the via off the pad (or use filled-and-capped vias).',
    altium: ['Select the via → Properties → Solder Mask Expansion → Tented, so the hole is covered.', 'Use a dogbone: a short stub from the pad to a via placed beside it.', 'Via-in-pad needs a fab that supports filled & capped vias (extra cost).'],
  },
}

export const ORDER = ['decoupling', 'floating', 'pullup', 'uart', 'flyback', 'stargnd', 'planesplit', 'thermalvia', 'stub', 'rcfilter', 'diffpair', 'viainpad']

/* ---------- viewer ---------- */
export function Explainer({ id, onNav }) {
  const e = EXPLAINERS[id]
  const [good, setGood] = useState(false)
  if (!e) return null
  const C = e.Cmp
  const idx = ORDER.indexOf(id)
  return (
    <div className="exp">
      <div className="exp-head">
        <div>
          <h3>{e.title}</h3>
          <p>{e.blurb}</p>
        </div>
      </div>
      <div className="seg" role="tablist">
        <button className={!good ? 'on bad' : ''} onClick={() => setGood(false)}>✗ What goes wrong</button>
        <button className={good ? 'on good' : ''} onClick={() => setGood(true)}>✓ What to do</button>
      </div>
      <svg key={id + good} className="stage" viewBox="0 0 420 230" role="img" aria-label={e.title}>
        <C good={good} />
      </svg>
      <p className={'cap ' + (good ? 'good' : 'bad')}>{good ? e.good : e.bad}</p>
      <div className="altium">
        <h4>In Altium</h4>
        <ul>{e.altium.map((t, i) => <li key={i}>{t}</li>)}</ul>
      </div>
      {onNav && (
        <div className="exp-nav">
          <button onClick={() => onNav(ORDER[(idx - 1 + ORDER.length) % ORDER.length])}>← Previous</button>
          <button onClick={() => onNav(ORDER[(idx + 1) % ORDER.length])}>Next →</button>
        </div>
      )}
    </div>
  )
}

export function Thumb({ id }) {
  const C = EXPLAINERS[id].Cmp
  return (
    <svg className="thumb" viewBox="0 0 420 230" aria-hidden="true">
      <C good={true} />
    </svg>
  )
}
