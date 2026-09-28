'use client';
import { useEffect, useState } from 'react';
import DeskArmCanvas from '@/components/three/DeskArmCanvas';
import { subscribeInvoices, type InvoiceDoc } from '@/lib/firebase';
import { CheckoutButton } from '@/components/bklit/CheckoutButton';

function Badge({ status }: { status: string }) {
  const ok = status === 'APPROVED';
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono border ${ok
      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
      : 'bg-red-500/15 text-red-300 border-red-500/40'}`}>
      {status}
    </span>
  );
}

const FALLBACK_LEDGER: InvoiceDoc[] = [
  { id: 'INV-2041', vendor: 'Acme Corp', total: 11800, status: 'APPROVED', ts: Date.now() },
  { id: 'INV-2042', vendor: 'Globex', total: 42500, status: 'FLAGGED_DISCREPANCY', ts: Date.now() },
];

export default function DashboardPage() {
  const [ledger, setLedger] = useState<InvoiceDoc[]>(FALLBACK_LEDGER);
  const [live, setLive] = useState(false);

  useEffect(() => subscribeInvoices(
    (rows) => { if (rows.length) { setLedger(rows); setLive(true); } },
    () => setLive(false),
  ), []);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="font-display text-2xl font-bold text-white tracking-tight">Live console</h1>
        <span className={`font-mono text-[11px] px-2 py-0.5 rounded-full border ${live ? 'text-emerald-300 border-emerald-500/30' : 'text-zinc-500 border-line'}`}>
          {live ? '● FIRESTORE LIVE' : '○ LOCAL SNAPSHOT'}
        </span>
        <button className="touch-target ml-auto px-4 rounded-lg bg-red-500/15 border border-red-500/40 text-red-300 font-mono text-sm font-bold">
          E-STOP
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl hairline bg-panel overflow-hidden min-h-[300px] relative">
          <DeskArmCanvas />
          <div className="absolute top-2 left-2 flex gap-2 font-mono text-[11px]">
            <span className="px-2 py-0.5 rounded bg-ink/80 border border-line text-emerald-300">● PROCESSING</span>
            <span className="px-2 py-0.5 rounded bg-ink/80 border border-line text-zinc-400">TRAY 3/12</span>
          </div>
        </section>
        <section className="rounded-xl hairline bg-panel p-4 font-mono text-sm">
          <h2 className="text-[11px] tracking-[0.2em] text-zinc-500">EDGE TELEMETRY</h2>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {[['Joint q0', '+0.42 rad'], ['Joint q1', '−0.61 rad'], ['Vacuum', '9.2 kPa · SEAL'], ['Bus draw', '1.1 A · OK'], ['CBF h_pos', '+0.38 ✓'], ['CBF h_vel', '+1.7 ✓']].map(([k, v]) => (
              <div key={k} className="rounded-lg border border-line bg-ink px-3 py-2.5">
                <p className="text-[11px] text-zinc-500">{k}</p>
                <p className="text-zinc-200">{v}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section id="ledger" className="rounded-xl hairline bg-panel p-4">
        <h2 className="font-mono text-[11px] tracking-[0.2em] text-zinc-500">INVOICE LEDGER</h2>
        <ul className="mt-2 space-y-2">
          {ledger.map((inv) => (
            <li key={inv.id} className="touch-target flex items-center gap-3 rounded-lg border border-line bg-ink px-3">
              <div>
                <p className="text-sm text-white font-medium">{inv.id} · {inv.vendor}</p>
                <p className="font-mono text-[11px] text-zinc-500">₹{(inv.total / 100).toFixed(2)}</p>
              </div>
              <span className="ml-auto"><Badge status={inv.status} /></span>
            </li>
          ))}
        </ul>
      </section>

      <section id="billing" className="rounded-xl hairline bg-panel p-4 flex flex-wrap items-center gap-3">
        <div>
          <h2 className="font-mono text-[11px] tracking-[0.2em] text-zinc-500">HARDWARE-AS-A-SERVICE</h2>
          <p className="text-sm text-zinc-400">Unit ₹49,999 · HaaS ₹2,999/mo · Razorpay secured</p>
        </div>
        <div className="ml-auto flex gap-2">
          <CheckoutButton amount={4999900} label="Buy unit" />
          <CheckoutButton amount={299900} label="Subscribe HaaS" />
        </div>
      </section>
    </main>
  );
}
