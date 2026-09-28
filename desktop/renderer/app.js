const pill = document.getElementById('pill');
const linkPill = document.getElementById('link');
const tele = document.getElementById('tele');
const log = document.getElementById('log');

function paint(status) {
  const map = {
    processing: ['● PROCESSING', 'border-emerald-500/40 text-emerald-300'],
    auditing: ['● AUDITING', 'border-amber-500/40 text-amber-300'],
    estop: ['● E-STOP TRIPPED', 'border-red-500/40 text-red-300'],
  };
  const [label, cls] = map[status] || map.processing;
  pill.textContent = label;
  pill.className = `ml-auto text-[11px] px-2 py-1 rounded-full border ${cls}`;
}

function paintLink(l) {
  if (!l) return;
  const live = l.transport !== 'sim';
  linkPill.textContent = live ? `LINK ${l.transport.toUpperCase()}` : 'LINK SIM';
  linkPill.className = `text-[11px] px-2 py-1 rounded-full border ${
    live ? 'border-sky-500/40 text-sky-300' : 'border-zinc-700 text-zinc-500'}`;
  linkPill.title = l.detail || '';
}

function paintTelemetry(t) {
  if (!t) return;
  const q = (t.q || []).map((v) => Number(v).toFixed(2)).join(', ');
  tele.textContent =
    `[${t.src}] q=[${q}] seal=${t.seal ? 'SEAL' : 'open'} ima=${t.ima_mA}mA pkpa=${t.pkpa}`;
}

function appendLog(line) {
  log.textContent += `\n${line}`;
  log.scrollTop = log.scrollHeight;
}

window.deskflow?.onStatus((s) => {
  paint(s);
  appendLog(`[${new Date().toLocaleTimeString()}] status → ${s}`);
});
window.deskflow?.onLink(paintLink);
window.deskflow?.onTelemetry(paintTelemetry);
window.deskflow?.onLog(appendLog);

window.deskflow?.getStatus().then(paint);
window.deskflow?.getLink().then((l) => {
  paintLink(l);
  if (l?.detail) appendLog(`[link] ${l.transport}: ${l.detail}`);
});
window.deskflow?.lastTelemetry().then(paintTelemetry);

document.getElementById('estop').onclick = async () => {
  const legs = await window.deskflow?.estop('console-button');
  appendLog(`[estop] delivery → ${(legs || []).join(', ')}`);
};
document.getElementById('rescan').onclick = () => {
  window.deskflow?.rescan();
  appendLog('[link] rescan requested…');
};
