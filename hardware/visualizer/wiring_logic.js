/* DeskFlow-VLA wiring_logic.js — interactive wire map + rail toggles */
(function () {
  const svg = document.getElementById('wiremap');
  const NS = 'http://www.w3.org/2000/svg';
  const inspector = document.getElementById('inspector');
  const railBox = document.getElementById('railToggles');

  const RAILS = {
    '12V': { color: '#fb923c', label: '12V' },
    '5V':  { color: '#f87171', label: '5V' },
    '3V3': { color: '#60a5fa', label: '3V3' },
    'GND': { color: '#71717a', label: 'GND' },
    'SIG': { color: '#34d399', label: 'SIG' },
  };
  const active = { '12V': true, '5V': true, '3V3': true, 'GND': true, 'SIG': true };

  const NODES = [
    { id: 'pi5',   x: 90,  y: 120, w: 150, title: 'Raspberry Pi 5', sub: 'ROS 2 Jazzy supervisor',
      info: 'Edge host. USB-UART @921600 to ESP32. Buck 5V/5A in. Publishes /deskflow/trajectory.' },
    { id: 'esp32', x: 360, y: 90,  w: 180, title: 'ESP32-S3 DevKit', sub: 'FreeRTOS 100 Hz · micro-ROS',
      info: 'Motion core. GPIO17 servo bus · GPIO4 pump · GPIO5 vent · GPIO6 pressure · GPIO7 current.' },
    { id: 'servo', x: 660, y: 80,  w: 160, title: '4× STS3215', sub: 'Half-duplex 1 Mbaud',
      info: '12 V bus servos, 6 A peak chain. Daisy-chained via 74HC126 DIR buffer. Freeze on E-stop.' },
    { id: 'pump',  x: 360, y: 300, w: 180, title: 'Vacuum pump 12V', sub: 'GPIO4 → relay',
      info: 'Diaphragm pump 2.5 A. Relay module on 12V orange rail. OFF on boot & E-stop.' },
    { id: 'valve', x: 600, y: 300, w: 160, title: 'Dump valve', sub: 'GPIO5 → MOSFET',
      info: '3-way solenoid + flyback diode. VENTED (HIGH) on boot — paper drops safe.' },
    { id: 'press', x: 120, y: 300, w: 160, title: 'MPX5010DP', sub: 'GPIO6 ADC → seal',
      info: 'Diff pressure 0–10 kPa on blue 3V3 rail. Seal ≥ 8.0 kPa → /deskflow/seal_engaged.' },
    { id: 'shunt', x: 120, y: 430, w: 160, title: 'INA181 + shunt', sub: 'GPIO7 ADC → trip',
      info: '5 mΩ ×50 V/V. Trip >2800 mA ×3 samples → vent + freeze + /deskflow/estop.' },
  ];

  // x1,y1 → x2,y2 routed as cubic; rail determines color + toggle group
  const WIRES = [
    { a: 'pi5', b: 'esp32', rail: 'SIG', p1: [240, 140], p2: [360, 130], label: 'UART RX/TX G18/19 · 921600', info: 'Pi5 USB-UART TX/RX ↔ ESP32 G18/G19. Agent timeout → vent + freeze.' },
    { a: 'esp32', b: 'servo', rail: 'SIG', p1: [540, 130], p2: [660, 120], label: 'Servo bus G17 · 1 Mbaud HD', info: 'Half-duplex via 74HC126. 10 kΩ idle pull-up. Torque freeze on E-stop.' },
    { a: 'esp32', b: 'pump', rail: '12V', p1: [420, 200], p2: [420, 300], label: 'G4 → pump relay · 12V/2.5A', info: 'Orange 12V high-current rail. Fused 7.5 A. OFF on boot & E-stop.' },
    { a: 'esp32', b: 'valve', rail: '12V', p1: [500, 200], p2: [660, 300], label: 'G5 → valve FET · 12V', info: 'Orange rail via IRLZ44N + flyback. Defaults VENTED.' },
    { a: 'esp32', b: 'press', rail: '3V3', p1: [360, 180], p2: [200, 300], label: 'G6 ← pressure analog', info: 'Blue 3V3 sensor rail, RC filtered. Seal threshold 8 kPa.' },
    { a: 'esp32', b: 'shunt', rail: '5V', p1: [400, 200], p2: [200, 430], label: 'G7 ← current sense', info: 'Red 5V logic rail powers INA181. Trip 2800 mA ×3 consecutive reads.' },
    { a: 'pi5', b: 'press', rail: 'GND', p1: [150, 200], p2: [160, 300], label: 'Star GND', info: 'Common black ground, star at PSU. Analog GND via ferrite bead.' },
    { a: 'pump', b: 'servo', rail: '12V', p1: [540, 330], p2: [700, 200], label: '12V servo rail · 6A pk', info: 'Shared orange 12V feed to servo chain. Twist pump leads.' },
  ];

  const nodeById = Object.fromEntries(NODES.map(n => [n.id, n]));
  function el(tag, attrs) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; }

  // grid backdrop
  for (let x = 0; x <= 900; x += 30) svg.appendChild(el('line', { x1: x, y1: 0, x2: x, y2: 520, stroke: '#18181b', 'stroke-width': 1 }));
  for (let y = 0; y <= 520; y += 30) svg.appendChild(el('line', { x1: 0, y1: y, x2: 900, y2: y, stroke: '#18181b', 'stroke-width': 1 }));

  const wireEls = [];
  WIRES.forEach((w) => {
    const A = nodeById[w.a], B = nodeById[w.b];
    const [x1, y1] = w.p1, [x2, y2] = w.p2;
    const d = `M ${x1} ${y1} C ${x1} ${y1 + 60}, ${x2} ${y2 - 60}, ${x2} ${y2}`;
    const p = el('path', { d, class: 'wire', stroke: RAILS[w.rail].color, 'data-rail': w.rail });
    p.style.cursor = 'pointer';
    p.addEventListener('mouseenter', () => show(`<b class="text-white font-mono">${w.label}</b><p class="mt-1 text-zinc-400">${w.info}</p><p class="mt-1 font-mono text-[11px] text-zinc-500">RAIL ${w.rail}</p>`));
    svg.appendChild(p); wireEls.push(p);
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - 6;
    const t = el('text', { x: mx, y: my, class: 'tick', 'text-anchor': 'middle' });
    t.textContent = w.label; svg.appendChild(t);
    w._label = t;
  });

  NODES.forEach((n) => {
    const g = el('g', { class: 'pin' });
    const r = el('rect', { x: n.x, y: n.y, width: n.w, height: 76, rx: 8, fill: '#09090b', stroke: '#3f3f46', 'stroke-width': 1.5 });
    const dot = el('circle', { cx: n.x + 14, cy: n.y + 16, r: 5, fill: '#fbbf24' });
    const t1 = el('text', { x: n.x + 28, y: n.y + 21, fill: '#fff', 'font-size': 12, 'font-family': 'JetBrains Mono' });
    t1.textContent = n.title;
    const t2 = el('text', { x: n.x + 12, y: n.y + 44, fill: '#71717a', 'font-size': 10, 'font-family': 'JetBrains Mono' });
    t2.textContent = n.sub;
    const t3 = el('text', { x: n.x + 12, y: n.y + 62, fill: '#52525b', 'font-size': 9, 'font-family': 'JetBrains Mono' });
    t3.textContent = 'hover for specs →';
    g.append(r, dot, t1, t2, t3);
    g.addEventListener('mouseenter', () => show(`<b class="text-white font-mono">${n.title}</b><p class="font-mono text-[11px] text-amber-300">${n.sub}</p><p class="mt-1 text-zinc-400">${n.info}</p>`));
    svg.appendChild(g);
  });

  function show(html) { inspector.innerHTML = html; }

  // Rail toggle switches
  Object.keys(RAILS).forEach((rail) => {
    const b = document.createElement('button');
    b.className = 'px-2 py-1 rounded-md border font-mono text-[11px] transition';
    const paint = () => {
      b.style.borderColor = RAILS[rail].color + '66';
      b.style.color = active[rail] ? RAILS[rail].color : '#52525b';
      b.style.background = active[rail] ? RAILS[rail].color + '14' : 'transparent';
      b.textContent = (active[rail] ? '● ' : '○ ') + RAILS[rail].label;
    };
    b.onclick = () => {
      active[rail] = !active[rail]; paint(); applyFilters();
    };
    paint(); railBox.appendChild(b);
  });

  function applyFilters() {
    wireEls.forEach((p) => {
      const on = active[p.getAttribute('data-rail')];
      p.classList.toggle('dim', !on);
      p.classList.toggle('hot', !!on);
    });
    WIRES.forEach((w) => { if (w._label) w._label.style.opacity = active[w.rail] ? 1 : 0.15; });
  }
  applyFilters();
})();
