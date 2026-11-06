// Priority: C = Critical, H = High, M = Medium, L = Low
// Row format: [section, item, priority, notes, explainerId?]
// Item IDs are generated from row order, so append new rows at the END of a list
// (or accept that saved ticks shift) – see ids below.

const schematic = [
  ['Schematic Setup & Readability', 'Schematic flows left to right: inputs left / outputs right / power top / GND bottom', 'L', 'Improves readability and peer review speed'],
  ['Schematic Setup & Readability', 'Net names consistent across all sheets', 'H', 'Same signal must use an identical label everywhere'],
  ['Schematic Setup & Readability', 'No duplicate net labels on unrelated nets (silent shorts)', 'C', 'A mismatched net label is a silent short or open circuit'],
  ['Schematic Setup & Readability', 'All off-page connectors matched and accounted for', 'H', ''],
  ['Schematic Setup & Readability', 'Wire junctions explicit – no ambiguous T-junctions', 'M', ''],
  ['Schematic Setup & Readability', 'All buses labelled with bit ranges and direction (e.g. DATA[7:0])', 'M', ''],

  ['Component Annotation & Library', 'Components checked for availability on the Elec Component Stock Tracker and used if found', 'M', 'Exceptions can be made if not already available'],
  ['Component Annotation & Library', 'Passive components are 0603', 'M', 'Exceptions can be made with reasonable justification'],
  ['Component Annotation & Library', 'All reference designators unique and fully annotated – no R? C? U? placeholders', 'C', 'ERC will not catch value mismatches'],
  ['Component Annotation & Library', 'All components have the correct MPN / part number assigned', 'H', ''],
  ['Component Annotation & Library', 'All components have a footprint assigned and verified against the package', 'C', 'Footprint mismatches are a common cause of board respins'],
  ['Component Annotation & Library', 'Component symbols match datasheet pin numbering', 'H', 'Especially important for custom or modified library parts'],
  ['Component Annotation & Library', 'Polarity-sensitive parts (diodes / caps / connectors / ICs) have pin 1 / polarity marked', 'H', ''],
  ['Component Annotation & Library', 'Unused sections of multi-unit packages properly terminated', 'H', 'e.g. unused op-amps in a quad package tied off, not floating', 'floating'],

  ['Power & Decoupling', 'Every IC power pin has the decoupling its datasheet recommends (typically ≥100nF ceramic per supply pin)', 'C', 'Follow the datasheet network – 100nF is common but not always enough. Place each cap close to its pin', 'decoupling'],
  ['Power & Decoupling', 'Bulk capacitance on all supply rails (10µF+ near each supply entry)', 'H', ''],
  ['Power & Decoupling', 'VDDA / VREF+ isolated from main VCC with ferrite bead + RC filter', 'H', 'Required for ADC accuracy on most microcontrollers', 'rcfilter'],
  ['Power & Decoupling', 'Power sequencing verified where required', 'H', 'Core before I/O for FPGAs and SoCs – check the IC datasheet'],
  ['Power & Decoupling', 'No unintentional series resistor on a regulated output', 'H', 'Series R causes load-dependent voltage sag on the rail'],
  ['Power & Decoupling', 'Supply rail voltages correct for every IC – checked against absolute max ratings', 'C', ''],
  ['Power & Decoupling', 'Input protection on externally exposed power inputs', 'M', 'TVS diode, polyfuse, or reverse-polarity protection as needed'],

  ['Reset / Enable / Boot Pins', 'Every reset / enable pin has a defined default state (pull-up or pull-down)', 'C', 'Device state must be known before the MCU initialises', 'floating'],
  ['Reset / Enable / Boot Pins', 'NRST / EN pin filtering matches the IC datasheet reset circuit', 'H', 'Many MCUs suggest ~100nF on NRST, but some reset/enable circuits have specific timing or capacitance limits'],
  ['Reset / Enable / Boot Pins', 'Boot / mode config pins explicitly pulled up or down', 'C', 'Do not rely solely on internal weak pulls', 'floating'],
  ['Reset / Enable / Boot Pins', 'Sleep / shutdown pins have pull resistors for a safe power-on default', 'H', ''],
  ['Reset / Enable / Boot Pins', 'All enable pins considered: what is the state during MCU reset?', 'H', ''],

  ['Unused & Floating Pins', 'All unused input pins tied to a defined logic level', 'C', 'Floating inputs oscillate, inject noise and increase power', 'floating'],
  ['Unused & Floating Pins', 'Intentional no-connects have explicit NC markers', 'H', 'Do not leave pins simply unconnected – it causes ERC false negatives'],
  ['Unused & Floating Pins', 'Unused op-amp inputs tied to a rail or mid-supply reference', 'H', 'Never left floating', 'floating'],
  ['Unused & Floating Pins', 'Unused IC output / status pins reviewed per datasheet', 'H', "Some must be GND'd, some truly left floating – check each"],
  ['Unused & Floating Pins', 'Address / mode-select / config pins pulled to a defined level', 'H', 'Not relying on internal state alone', 'floating'],

  ['Digital Interfaces', 'I2C SDA/SCL have pull-up resistors to the correct voltage rail', 'C', 'Typically 4.7k; verify for bus capacitance at high speed', 'pullup'],
  ['Digital Interfaces', 'Voltage levels compatible between all devices on each interface', 'C', 'Check FT vs TC pins on the MCU datasheet; add level shifters if needed'],
  ['Digital Interfaces', 'UART TX/RX correctly crossed (TX→RX / RX→TX)', 'C', '', 'uart'],
  ['Digital Interfaces', 'SPI MISO/MOSI not swapped; CS driven by master and unique per slave', 'C', ''],
  ['Digital Interfaces', 'Open-drain / open-collector outputs have pull-up resistors', 'C', 'nFAULT, INT, open-drain I2C etc.', 'pullup'],
  ['Digital Interfaces', 'Series termination considered on fast digital lines', 'M', 'Value depends on driver impedance, trace impedance and edge rate (often tens of ohms) – confirm by calculation or simulation'],
  ['Digital Interfaces', 'Differential pairs (USB / LVDS / CAN) have matched termination', 'H', ''],

  ['Analog & ADC Inputs', 'ADC input range within Vref and supply limits', 'H', ''],
  ['Analog & ADC Inputs', 'RC anti-aliasing filter on each analog input channel', 'H', 'Series R + cap to GND before the ADC pin', 'rcfilter'],
  ['Analog & ADC Inputs', 'Voltage reference (Vref) separately decoupled and filtered', 'H', ''],
  ['Analog & ADC Inputs', 'Protection diodes or clamps for out-of-range analog inputs', 'M', 'Any input that could exceed the supply voltage under any condition'],
  ['Analog & ADC Inputs', 'Sensor biasing (pull-up / pull-down) per sensor datasheet', 'M', ''],

  ['Ground Architecture', 'Power and analog return currents reviewed so high-current returns cannot disturb sensitive signals', 'C', 'Split grounds / star points only where the circuit or datasheet justifies it – a continuous ground plane with controlled return paths is often better. If you split, join at one deliberate point', 'stargnd'],
  ['Ground Architecture', 'All GND symbols verified to connect to the same net', 'C', 'Mixed GND symbol styles can silently create separate nets'],
  ['Ground Architecture', 'Exposed pad (EPAD) on ICs tied to the correct GND net', 'H', 'Usually PGND for power ICs, AGND/GND for signal ICs'],
  ['Ground Architecture', 'Ground pin on every external connector', 'M', 'Floating connector shells are a common EMC failure mode'],

  ['Protection & Reliability', 'Diode polarity correct – check each diode individually', 'C', 'Orientation errors on catch and protection diodes are common'],
  ['Protection & Reliability', 'ESD protection on all I/O exposed to the outside world', 'H', 'TVS arrays or ESD diodes on USB, GPIO headers, connectors'],
  ['Protection & Reliability', 'Overcurrent protection (fuse or polyfuse) on power inputs', 'M', ''],
  ['Protection & Reliability', 'Inductive loads (motors / relays / solenoids) have a suitable clamp or flyback path', 'C', 'Right clamp depends on the driver and load: a plain diode is simplest but slows release; diode + zener, TVS or active clamp may be needed. H-bridge drivers often rely on body diodes – check the datasheet', 'flyback'],
  ['Protection & Reliability', 'Voltage and current ratings of all passives verified with derating', 'H', 'Account for worst-case transients and DC bias (ceramic capacitance falls with voltage). ≥2× working voltage is a common start – justify exceptions'],
  ['Protection & Reliability', 'Decoupling on power pins of all gate drivers and power ICs per datasheet', 'C', '', 'decoupling'],

  ['USB & High-Speed Signals', 'ESD protection on all USB D+/D− lines', 'H', 'e.g. USBLC6-2SC6 placed close to the connector'],
  ['USB & High-Speed Signals', 'USB-C CC pins have correct resistors', 'C', '5.1k to GND for UFP/device; 56k pull-up to VBUS for DFP/host'],
  ['USB & High-Speed Signals', 'VBUS bulk decoupling ≥10µF present', 'H', ''],
  ['USB & High-Speed Signals', 'VBUS filtering (ferrite bead / capacitance) considered for the power design and EMI needs', 'M', 'Not always required – a bead with bulk capacitance can resonate or sag under inrush. Check USB inrush limits'],
  ['USB & High-Speed Signals', 'Differential pair series resistors or common-mode choke present', 'M', 'Improves EMC and reduces overshoot on long traces'],

  ['Connectors & Mechanical', 'All connectors have pin 1 clearly marked', 'H', ''],
  ['Connectors & Mechanical', 'Connector mating direction and gender noted where non-obvious', 'M', ''],
  ['Connectors & Mechanical', 'Mechanical mounting holes included', 'M', ''],
  ['Connectors & Mechanical', 'Debug / programming header present (SWD / JTAG / UART)', 'H', 'SWDIO, SWDCLK, GND, VCC, NRST minimum for ARM Cortex'],
  ['Connectors & Mechanical', 'Power and status LEDs on key rails', 'L', 'Invaluable for initial bring-up'],

  ['Validation & Sign-off', 'ERC run with zero unresolved errors', 'C', 'Warnings reviewed and either fixed or waived with a note'],
  ['Validation & Sign-off', 'All voltage dividers and feedback networks recalculated from R values', 'C', 'Do not trust values copied from reference designs without verification', 'divider'],
  ['Validation & Sign-off', 'Switched-mode supply feedback verified for target output voltage', 'C', "Recalculate from component values – don't assume", 'divider'],
  ['Validation & Sign-off', 'Datasheet consulted for every non-trivial IC connection', 'H', 'Power, enable, boot, mode, and special-function pins at minimum'],
  ['Validation & Sign-off', "Layout-critical notes added to schematic", 'M', "e.g. 'place bypass caps close to pin', 'keep differential pair matched'"],
  ['Validation & Sign-off', 'BOM exported and spot-checked for missing values or footprints', 'H', ''],
  ['Validation & Sign-off', 'Second person has reviewed the schematic', 'H', 'Self-review misses a large share of errors that a fresh set of eyes catches'],
]

const layout = [
  ['Setup', 'JLC.rul has been imported and set up', 'C', 'Found in Electrical → Wiki → PCB. How to import is in the "How to PCB and STM32" video'],

  ['Stackup & Layer Planning', 'Layer assignment documented – signal / power / ground roles noted per layer', 'C', 'Recommended stackup is 4 layer: (Sig – PWR – GND – Sig) or (Sig – GND – GND – Sig)'],

  ['Component Placement', 'Power circuitry (buck / LDO / gate drivers) separated from sensitive analog and MCU sections', 'C', 'Switching noise couples through both supply and substrate'],
  ['Component Placement', 'Decoupling capacitors placed as close as possible to IC power pins', 'C', '', 'decoupling'],
  ['Component Placement', 'High-speed ICs oriented to minimise trace length to their associated passives and connectors', 'H', ''],
  ['Component Placement', 'Bypass caps on the same layer as the IC power pin – no layer changes between cap and pin where avoidable', 'H', 'Via inductance adds to the bypass loop', 'decoupling'],
  ['Component Placement', 'Crystals and oscillators placed close to MCU clock pins', 'H', 'Keep crystal traces short and away from other signals'],
  ['Component Placement', 'ESD and protection components placed at the board entry point (connector) – before any other circuitry', 'C', 'Protection placed after a trace run is largely ineffective'],
  ['Component Placement', 'Connectors placed at board edges – not in the middle of the board', 'M', 'Reduces stub routing and mechanical stress on internal traces'],
  ['Component Placement', 'Heat-generating components (regulators / power ICs / MOSFETs) have clearance from each other and from temperature-sensitive parts', 'H', ''],
  ['Component Placement', 'Component orientation consistent for assembly – ICs, LEDs and polarised parts aligned where possible', 'M', 'Reduces assembly error and improves AOI inspection'],

  ['Trace Routing – General', 'Avoid sharp 90° bends – prefer 45° or curved routing', 'M', 'Etching acid traps are largely a legacy concern and one 90° bend is rarely a failure, but 45° routing is tidier and avoids needless discontinuities on high-speed lines'],
  ['Trace Routing – General', 'Trace widths sized for current capacity – verified against IPC-2221 or a trace width calculator', 'C', 'IPC-2221 (1oz, ΔT = 10°C, 1A) gives ≈0.3mm outer / ≈0.8mm inner. It is an estimate – add margin and verify thermally for high-current paths. Calculator in Resources', 'tracewidth'],
  ['Trace Routing – General', 'No unintentional stubs or dangling traces', 'C', 'Stubs cause reflections and can short to adjacent nets', 'stub'],
  ['Trace Routing – General', 'All nets routed – no unconnected ratsnest connections remaining', 'C', 'Run DRC to confirm zero unrouted nets'],
  ['Trace Routing – General', 'Traces do not run over plane splits or gaps', 'C', 'Split planes disrupt the return current path and are a major EMI source', 'planesplit'],
  ['Trace Routing – General', 'Short and direct routing for high-current paths (power rails / motor drive)', 'H', 'Long high-current traces waste power and generate heat and voltage drop'],
  ['Trace Routing – General', 'Analog and digital traces routed in separate zones – do not mix layers', 'H', 'Digital return currents must not flow under analog circuitry'],
  ['Trace Routing – General', 'Sensitive signals (analog / low-level / clock) not routed parallel to high-speed or high-current traces', 'H', 'Parallel routing over long distances causes crosstalk'],
  ['Trace Routing – General', 'High-speed signals kept away from board edges', 'H', 'Edge routing creates efficient antennas – keep at least 1× dielectric thickness from the edge'],

  ['Power & Ground Routing', 'Power traces sized for full load current with margin', 'C', 'Include worst-case startup / inrush current in the sizing calculation', 'tracewidth'],
  ['Power & Ground Routing', 'Power and ground planes poured as solid fills – not routed as traces on critical rails', 'H', 'Plane fills give lower impedance and better thermal spreading'],
  ['Power & Ground Routing', 'Copper pours connected to a net (no floating islands)', 'C', 'Floating copper patches act as antennas and cause EMI'],
  ['Power & Ground Routing', 'Ground stitching vias placed around layer transitions and plane boundaries', 'H', 'Maintains a low-impedance return path between layers'],
  ['Power & Ground Routing', 'No signal routing over power plane gaps / splits', 'C', 'Return current detours around splits – large loop area and EMI', 'planesplit'],
  ['Power & Ground Routing', 'Ground partitioning (if used) implemented as designed; high-current returns kept away from sensitive circuitry', 'C', 'Match the schematic intent. If split, join at one deliberate point; if a solid plane, control where large currents flow', 'stargnd'],
  ['Power & Ground Routing', 'Thermal relief on through-hole pads connected to ground planes', 'H', 'Without thermal relief the plane sinks heat and hand soldering becomes unreliable'],
  ['Power & Ground Routing', 'Star topology or low-impedance plane used for sensitive supply rails (not daisy-chained)', 'M', ''],

  ['Vias', 'Via size meets fab minimum annular ring (0.6mm pad / 0.4mm drill recommended)', 'C', 'Annular ring = (pad − drill) / 2; confirm against the fab spec sheet'],
  ['Vias', 'No vias in SMD pads (via-in-pad) unless filled and capped', 'H', 'Otherwise solder wicks down the via, causing cold joints and tombstoning', 'viainpad'],
  ['Vias', 'Thermal vias under power ICs and exposed pads (EPAD) present and correctly sized', 'C', 'Typically 0.3mm drill / 0.6mm pad, an array of 9–16 under the EPAD, connected to the ground plane', 'thermalvia'],
  ['Vias', 'Multiple vias used for high-current connections, sized by calculation', 'H', 'Via current depends on drill, plating and temperature rise for your fab. As a rough start, parallel several vias above ~1A'],
  ['Vias', 'Stitching vias along ground plane boundaries and around high-speed signals', 'H', 'Provides a low-inductance return path and suppresses plane resonance'],
  ['Vias', 'Blind / buried vias (if used) reviewed for fab capability and cost impact', 'M', ''],

  ['Differential Pairs & High-Speed', 'Differential pairs meet the interface spec: impedance, intra-pair skew, symmetry and continuous reference plane', 'C', 'Requirements are interface-specific (USB, CAN, LVDS differ). Matching length alone does not make a good pair', 'diffpair'],
  ['Differential Pairs & High-Speed', 'Differential pair spacing consistent throughout – no pinch points', 'H', 'Impedance changes at pinch points cause reflections', 'diffpair'],
  ['Differential Pairs & High-Speed', 'Differential pairs not split across layers without proper via transitions', 'H', 'Layer changes add stub inductance – use an adjacent ground via when crossing layers'],
  ['Differential Pairs & High-Speed', 'Series termination / common-mode choke placed correctly on differential pairs', 'H', 'Series termination at the source end; CM choke near the connector'],
  ['Differential Pairs & High-Speed', 'Length-matched trace groups for parallel buses (DDR / address / data lines)', 'H', 'Match to within the setup/hold timing budget of the interface', 'diffpair'],
  ['Differential Pairs & High-Speed', 'Guard traces (grounded) on sensitive analog or high-speed single-ended signals where required', 'M', 'Guard traces must be stitched to GND with frequent vias – floating guards are antennas'],

  ['EMC & Signal Integrity', 'Decoupling cap placement forms a tight loop: power pin → cap → via to plane → IC', 'C', 'Loop inductance (pad, trace, via, return path) limits how well the cap helps at high frequency – keep the loop short', 'decoupling'],
  ['EMC & Signal Integrity', 'Clock traces short and point-to-point – not daisy-chained to multiple loads', 'H', 'Daisy-chain topologies cause reflections; use star or series-terminated topology', 'stub'],
  ['EMC & Signal Integrity', 'High-frequency signals routed on inner (stripline) layers rather than outer (microstrip) where possible', 'M', 'Stripline is shielded by planes on both sides – lower emission and crosstalk'],
  ['EMC & Signal Integrity', 'No large current loops in power or signal routing', 'C', 'Loop area is proportional to radiated emissions – minimise everywhere', 'planesplit'],
  ['EMC & Signal Integrity', 'Ferrite beads and filters placed on the noise-source side', 'H', 'A filter placed after a long stub does not filter the stub radiation'],
  ['EMC & Signal Integrity', 'Series termination on fast-edge signals where signal integrity needs it', 'M', 'Place at the source, not the load. Value from edge rate and trace impedance'],
  ['EMC & Signal Integrity', 'Crystal traces shielded by ground traces / pour on the same layer', 'H', 'Crystal lines are high-impedance and susceptible to coupling'],

  ['Thermal Management', 'Power dissipating components have copper pour or thermal vias to the inner ground plane', 'C', '', 'thermalvia'],
  ['Thermal Management', 'Thermal via array under exposed pad (EPAD) ICs connected to the ground/power plane', 'C', 'Size and quantity per the IC datasheet recommendations', 'thermalvia'],
  ['Thermal Management', 'No components placed directly adjacent to high-temperature devices without thermal isolation', 'H', ''],
  ['Thermal Management', 'Airflow direction considered in component placement – low components upstream of high ones', 'M', 'Applies to forced-air cooled designs'],

  ['Design Rules & Clearances', 'DRC run with zero critical errors – all violations reviewed and resolved or waived', 'C', 'Never send to fab with unreviewed DRC errors'],
  ['Design Rules & Clearances', 'Trace-to-trace clearance meets fab minimum (typically ≥0.1mm standard / ≥0.15mm safe)', 'C', ''],
  ['Design Rules & Clearances', 'Trace-to-board-edge clearance ≥0.3mm (copper) and ≥0.5mm (traces) minimum', 'H', 'Closer traces risk shorts from depaneling and edge exposure'],
  ['Design Rules & Clearances', 'Copper-to-edge clearance on all planes observed', 'H', 'Exposed plane copper at the edge causes layer-to-layer shorts after routing'],
  ['Design Rules & Clearances', 'Creepage and clearance distances met for mains / high-voltage sections', 'C', 'IPC-2221 Table 6-1; typically ≥1.6mm at 250VAC for basic insulation'],
  ['Design Rules & Clearances', 'Solder mask clearance correct on all pads – no mask encroachment', 'H', 'Mask overlap on pads reduces solderability and causes cold joints'],
  ['Design Rules & Clearances', 'Paste layer (stencil apertures) correct for all SMD pads', 'H', 'Incorrect paste apertures cause insufficient or excessive solder – especially critical for QFN/BGA'],
  ['Design Rules & Clearances', 'Minimum annular ring met on all vias and through-hole pads', 'C', 'Typical minimum: 0.125mm (Class B) – confirm with the fab'],

  ['Silkscreen & Documentation', 'Silkscreen does not overlap pads or vias', 'H', 'Ink on pads degrades solderability'],
  ['Silkscreen & Documentation', 'All components have reference designators on silkscreen – readable after assembly', 'M', ''],
  ['Silkscreen & Documentation', 'Board name / revision / date on silkscreen or fab layer', 'M', 'Essential for version control of physical boards'],
  ['Silkscreen & Documentation', 'Pin 1 / polarity markers visible on silkscreen for all polarised components', 'H', ''],
  ['Silkscreen & Documentation', 'Connector labels and pinout identifiers on silkscreen', 'M', 'Saves significant time during bring-up'],

  ['Test Points & Debug', 'Test points on all key signals – power rails / clock / fault lines / comms interfaces', 'H', 'Exposed test points (not just vias) accessible to oscilloscope probes'],
  ['Test Points & Debug', 'Programming / debug connector (SWD / JTAG / UART) physically accessible – not blocked by other components or enclosure', 'H', ''],
  ['Test Points & Debug', 'Test points have a ground reference adjacent for probe return', 'M', 'A ground test point within 5mm of every signal test point'],

  ['Fabrication & DFM', 'Minimum trace width and space confirmed against fab capability', 'C', 'Values vary by fab (JLCPCB: 0.09mm min / OSHPark: 0.1mm)'],
  ['Fabrication & DFM', 'Minimum drill size confirmed against fab capability', 'C', 'Typical minimum: 0.2mm (laser) / 0.3mm (mechanical)'],
  ['Fabrication & DFM', 'Board outline on a dedicated layer – closed polygon with no gaps', 'C', 'An open board outline causes fab rejection'],
  ['Fabrication & DFM', 'Component spacing adequate for pick-and-place – no parts too close to tall components', 'M', 'Minimum 0.5mm between component bodies for standard SMT assembly'],
  ['Fabrication & DFM', 'No vias under components unless intentional (via-in-pad) and confirmed with the fab', 'H', '', 'viainpad'],
  ['Fabrication & DFM', '3D view checked for mechanical fit – connectors / mounting holes / enclosure clearances', 'H', ''],
  ['Fabrication & DFM', 'Gerber / ODB++ files generated and visually inspected in a Gerber viewer before submission', 'C', 'Always verify generated files – do not assume the export is correct'],
  ['Fabrication & DFM', 'Drill file includes both plated and non-plated holes', 'H', 'Missing non-plated holes (mounting holes) are a common fab oversight'],

  ['Final Sign-off', 'Netlist compared between schematic and layout – zero differences', 'C', 'Altium: Design → Update PCB / Project → Compare – run it'],
  ['Final Sign-off', 'All power nets verified to connect to the intended plane / pour', 'C', ''],
  ['Final Sign-off', 'Second person has reviewed the layout', 'H', 'Fresh eyes catch routing, clearance and placement errors the designer misses'],
  ['Final Sign-off', 'Layout-critical schematic notes actioned (bypass cap placement / differential pair notes etc.)', 'H', ''],
  ['Final Sign-off', 'BOM cross-checked against placed components – no missing or extra parts', 'H', ''],
]

const bionic = [
  ['Safety & Patient-Connected', 'Applicable standards and device classification identified (e.g. IEC 60601-1, IEC 60601-1-2, ISO 14971)', 'H', 'This review is an engineering check, NOT evidence of medical-device compliance. Requirements depend on classification and intended use'],
  ['Safety & Patient-Connected', 'Any patient-connected or implanted-side circuitry identified; isolation barriers defined where required', 'C', ''],
  ['Safety & Patient-Connected', 'Creepage / clearance and working voltages documented across isolation barriers', 'C', ''],
  ['Safety & Patient-Connected', 'Single-fault behaviour considered: what happens if a component shorts or opens?', 'C', ''],
  ['Safety & Patient-Connected', 'External connectors protected against ESD, overvoltage and reverse connection', 'H', ''],

  ['Motor Control & Power Electronics', 'Gate-driver dead time and shoot-through protection verified', 'C', ''],
  ['Motor Control & Power Electronics', 'MOSFET voltage / current / SOA margins checked for worst case (including stall and inrush)', 'C', ''],
  ['Motor Control & Power Electronics', 'Gate resistors chosen and switching-node loop area minimised', 'H', ''],
  ['Motor Control & Power Electronics', 'Current-sense placement and filtering reviewed (Kelvin connection to the shunt)', 'H', ''],
  ['Motor Control & Power Electronics', 'Overcurrent and thermal shutdown behaviour defined', 'H', ''],

  ['Sensing & Analog Acquisition', 'ADC input impedance vs source impedance and acquisition time checked', 'H', ''],
  ['Sensing & Analog Acquisition', 'Sensor excitation, biasing and reference accuracy meet the required resolution', 'M', ''],
  ['Sensing & Analog Acquisition', 'Amplifier stages: gain, bandwidth, input common-mode range and noise reviewed', 'M', ''],

  ['Wireless Power & Communication', 'Resonant tank tolerances and ratings checked (capacitor voltage, coil current)', 'H', ''],
  ['Wireless Power & Communication', 'Coil heating, switching harmonics and EMI considered', 'M', ''],
  ['Wireless Power & Communication', 'Communication has error detection and defined behaviour on loss of link', 'H', ''],

  ['Embedded & Fault Handling', 'Safe state defined for startup, shutdown and MCU reset (outputs default off)', 'C', ''],
  ['Embedded & Fault Handling', 'Watchdog and brown-out behaviour defined', 'H', ''],
  ['Embedded & Fault Handling', 'Hardware fault signals routed to the MCU and handled in firmware', 'H', ''],
]

const PRI = { C: 'Critical', H: 'High', M: 'Medium', L: 'Low' }

function build(prefix, rows) {
  return rows.map(([section, text, pri, note, x], i) => ({
    id: `${prefix}${String(i + 1).padStart(3, '0')}`,
    section,
    text,
    pri,
    note,
    x: x || null,
  }))
}

export const LISTS = {
  schematic: { label: 'Schematic', items: build('s', schematic) },
  layout: { label: 'PCB Layout', items: build('l', layout) },
  bionic: { label: 'Bionic Heart specifics', items: build('b', bionic) },
}

export { PRI }
