const { app, BrowserWindow, Tray, Menu, Notification, ipcMain, nativeImage } = require('electron');
const path = require('path');
const net = require('net');
const http = require('http');

/**
 * DeskFlow-VLA desktop main process — real edge link manager.
 *
 * Transports (first available wins, auto-failover, honest degrade to sim):
 *  1. SERIAL — ESP32-S3 USB-Serial-JTAG console (115200) emitting `DF:` diag
 *     lines + accepting `DF:ESTOP`. Auto-detects Espressif / CP210x / CH340
 *     USB serial adapters. Requires `npm install` (serialport dep).
 *  2. LAN    — TCP client to the Pi companion bridge
 *     ($DESKFLOW_PI_HOST:$DESKFLOW_PI_PORT, default deskflow-pi.local:9009)
 *     streaming the same `DF:` line protocol. Auto-reconnect with backoff.
 *  3. SIM    — no edge found; UI says so explicitly, alerts still latch locally.
 *
 * E-stop delivery: serial `DF:ESTOP` (firmware vents + publishes
 * /deskflow/estop) plus best-effort POST to the Pi companion endpoint
 * ($DESKFLOW_PI_ESTOP_URL, default http://<pi>:8080/estop — see
 * docs/OPERATIONS.md §2.2). Local latch + notification always fire.
 */

let win = null;
let tray = null;
let robotStatus = 'processing'; // processing | auditing | estop
let lastTelemetry = null;
let serialPort = null;
let lanSocket = null;
let lanBackoffMs = 2000;

const PI_HOST = process.env.DESKFLOW_PI_HOST || 'deskflow-pi.local';
const PI_PORT = parseInt(process.env.DESKFLOW_PI_PORT || '9009', 10);
const PI_ESTOP_URL = process.env.DESKFLOW_PI_ESTOP_URL || `http://${PI_HOST}:8080/estop`;

const link = { transport: 'sim', detail: 'no edge link — waiting for serial/LAN', serialPath: null, lan: false };

let SerialPort = null;
try {
  SerialPort = require('serialport').SerialPort; // optional: app boots without it
} catch {
  link.detail = 'serialport dep not installed (cd desktop && npm install) — LAN/sim only';
}

/* ---------------- status + link state ---------------- */

function setStatus(s) {
  robotStatus = s;
  const dot = s === 'processing' ? '🟢' : s === 'auditing' ? '🟡' : '🔴';
  win?.webContents.send('robot-status', s);
  tray?.setToolTip(`DeskFlow-VLA ${dot} ${s.toUpperCase()} · link=${link.transport}`);
}

function pushLink() {
  win?.webContents.send('deskflow:link', { ...link });
  const dot = robotStatus === 'processing' ? '🟢' : robotStatus === 'auditing' ? '🟡' : '🔴';
  tray?.setToolTip(`DeskFlow-VLA ${dot} ${robotStatus.toUpperCase()} · link=${link.transport}`);
}

function setTransport(t, detail) {
  link.transport = t;
  if (detail) link.detail = detail;
  pushLink();
}

/* ---------------- DF line protocol ----------------
   Telemetry: DF q=0.42,-0.61,1.05,0.00 seal=1 estop=0 ima=1100 pkpa=9.2
   Census:    DF ping id=1 ok        (logged, not telemetry)
--------------------------------------------------- */

function parseDFTelemetry(line) {
  const m = line.match(/^DF\s+q=([-\d.,]+)\s+seal=(\d)\s+estop=(\d)\s+ima=([\d.]+)\s+pkpa=([\d.]+)/);
  if (!m) return null;
  return {
    q: m[1].split(',').map(Number),
    seal: m[2] === '1',
    estop: m[3] === '1',
    ima_mA: Number(m[4]),
    pkpa: Number(m[5]),
  };
}

function handleDFLine(src, line) {
  if (!line.startsWith('DF')) return;
  const t = parseDFTelemetry(line);
  if (!t) { // census / boot lines → straight to the log
    win?.webContents.send('deskflow:log', `[${src}] ${line}`);
    return;
  }
  lastTelemetry = { src, ...t, at: Date.now() };
  win?.webContents.send('deskflow:telemetry', lastTelemetry);
  if (t.estop && robotStatus !== 'estop') {
    notifyDiscrepancy(`E-STOP asserted by edge (${src})`);
  } else if (!t.estop && robotStatus === 'processing' && t.seal === false) {
    setStatus('auditing'); // seal lost mid-cycle → operator attention, not full stop
  }
}

function splitLines(state, chunk, src) {
  state.buf = (state.buf || '') + chunk.toString('utf8');
  let i;
  while ((i = state.buf.indexOf('\n')) !== -1) {
    const line = state.buf.slice(0, i).trim();
    state.buf = state.buf.slice(i + 1);
    if (line) handleDFLine(src, line);
    if (state.buf.length > 4096) state.buf = ''; // never grow unbounded on garbage
  }
}

/* ---------------- serial transport ---------------- */

const EDGE_VIDS = new Set(['303a', '10c4', '1a86']); // Espressif, CP210x, CH340

async function openSerial() {
  if (!SerialPort || serialPort) return;
  let ports = [];
  try {
    ports = await SerialPort.list();
  } catch {
    return;
  }
  const cand =
    ports.find((p) => EDGE_VIDS.has(String(p.vendorId || '').toLowerCase())) ||
    ports.find((p) => /usb|acm|serial/i.test(`${p.path} ${p.friendlyName || ''}`));
  if (!cand) return; // nothing plugged in — stay on lan/sim, retry on rescan
  try {
    serialPort = new SerialPort({ path: cand.path, baudRate: 115200, autoOpen: true });
  } catch {
    serialPort = null;
    return;
  }
  link.serialPath = cand.path;
  const st = {};
  serialPort.on('data', (c) => splitLines(st, c, 'serial'));
  serialPort.on('close', () => {
    serialPort = null;
    link.serialPath = null;
    setTransport(link.lan ? 'lan' : 'sim', 'serial closed — retrying');
    setTimeout(openSerial, 5000);
  });
  serialPort.on('open', () => {
    setTransport('serial', `console @ ${cand.path} 115200`);
    win?.webContents.send('deskflow:log', `[serial] opened ${cand.path}`);
  });
}

/* ---------------- LAN transport ---------------- */

function connectLAN() {
  if (lanSocket) return;
  const sock = net.createConnection({ host: PI_HOST, port: PI_PORT });
  lanSocket = sock;
  const st = {};
  sock.setTimeout(8000);
  sock.on('connect', () => {
    lanBackoffMs = 2000;
    link.lan = true;
    if (!serialPort) setTransport('lan', `tcp ${PI_HOST}:${PI_PORT}`);
    else pushLink();
    win?.webContents.send('deskflow:log', `[lan] connected ${PI_HOST}:${PI_PORT}`);
  });
  sock.on('data', (c) => splitLines(st, c, 'lan'));
  const drop = () => {
    try { sock.destroy(); } catch { /* already dead */ }
    if (lanSocket === sock) lanSocket = null;
    link.lan = false;
    if (!serialPort) setTransport('sim', `lan unreachable (${PI_HOST}:${PI_PORT}) — retrying`);
    else pushLink();
    setTimeout(connectLAN, (lanBackoffMs = Math.min(lanBackoffMs * 2, 30000)));
  };
  sock.on('timeout', drop);
  sock.on('error', drop);
  sock.on('close', () => {
    if (lanSocket === sock) {
      lanSocket = null;
      link.lan = false;
      if (!serialPort) setTransport('sim', `lan closed (${PI_HOST}:${PI_PORT}) — retrying`);
      else pushLink();
      setTimeout(connectLAN, (lanBackoffMs = Math.min(lanBackoffMs * 2, 30000)));
    }
  });
}

/* ---------------- E-stop (real delivery, honest receipt) ---------------- */

function postJSON(url, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, timeout: timeoutMs }, (res) => {
      res.resume();
      res.on('end', () => resolve(res.statusCode));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end(JSON.stringify(body));
  });
}

async function sendEstop(source) {
  const legs = [];
  if (serialPort?.isOpen) {
    try {
      await new Promise((res, rej) => serialPort.write('DF:ESTOP\n', (e) => (e ? rej(e) : res())));
      legs.push('serial:sent');
    } catch {
      legs.push('serial:failed');
    }
  } else {
    legs.push('serial:no-link');
  }
  try {
    const code = await postJSON(PI_ESTOP_URL, { source, at: Date.now() }, 2500);
    legs.push(`lan:http-${code}`);
  } catch {
    legs.push('lan:unreachable');
  }
  notifyDiscrepancy(`E-STOP from desktop (${source}) [${legs.join(', ')}]`);
  return legs;
}

function notifyDiscrepancy(detail) {
  setStatus('estop');
  new Notification({ title: 'DeskFlow — E-STOP / discrepancy', body: detail }).show();
  win?.webContents.send('deskflow:log', `[!] ${detail}`);
}

/* ---------------- window / tray ---------------- */

function createWindow() {
  win = new BrowserWindow({
    width: 1120, height: 760,
    backgroundColor: '#09090b',
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.webContents.on('did-finish-load', () => {
    pushLink();
    if (lastTelemetry) win.webContents.send('deskflow:telemetry', lastTelemetry);
  });
  win.on('close', (e) => {
    if (!app.quitting) { e.preventDefault(); win.hide(); } // minimize to tray
  });
}

function createTray() {
  tray = new Tray(nativeImage.createEmpty());
  tray.setToolTip('DeskFlow-VLA · linking…');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open console', click: () => win.show() },
    { label: 'Rescan edge link', click: () => rescan() },
    { type: 'separator' },
    { label: 'E-STOP (real)', click: () => sendEstop('tray') },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.quitting = true; app.quit(); } },
  ]));
  tray.on('click', () => win.show());
}

function rescan() {
  try { serialPort?.close(); } catch { /* reopen handled by close event */ }
  serialPort = null;
  link.serialPath = null;
  try { lanSocket?.destroy(); } catch { /* reconnect handled by close event */ }
  lanSocket = null;
  link.lan = false;
  lanBackoffMs = 2000;
  setTransport('sim', 'rescanning serial + LAN…');
  win?.webContents.send('deskflow:log', '[link] rescan requested');
  openSerial();
  connectLAN();
}

/* ---------------- IPC ---------------- */

ipcMain.handle('deskflow:status', () => robotStatus);
ipcMain.handle('deskflow:link', () => ({ ...link }));
ipcMain.handle('deskflow:telemetry-last', () => lastTelemetry);
ipcMain.handle('deskflow:estop', (_e, source) => sendEstop(source || 'button'));
ipcMain.on('deskflow:rescan', () => rescan());

app.whenReady().then(() => { createWindow(); createTray(); openSerial(); connectLAN(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (!win) createWindow(); else win.show(); });
