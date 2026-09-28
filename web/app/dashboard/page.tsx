'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import DeskArmCanvas from '@/components/three/DeskArmCanvas';
import { subscribeInvoices, type InvoiceDoc } from '@/lib/firebase';
import { CheckoutButton } from '@/components/bklit/CheckoutButton';
import { ExportButtons } from '@/components/bklit/ExportButtons';
import { InvoiceSheet } from '@/components/ledger/InvoiceSheet';
import { StatusFavicon } from '@/components/StatusFavicon';
import { Toaster, toast } from '@/components/ui/toaster';
import { exactUtc, formatMoney, timeAgo, type Currency } from '@/lib/format';
import { sound } from '@/lib/sound';

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

function EmptySchematic() {
  return (
    <div className="rounded-lg border border-dashed border-zinc-700 px-3 py-8 text-center">
      <svg viewBox="0 0 200 90" className="mx-auto h-20 text-zinc-600" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <rect x="20" y="66" width="160" height="6" rx="2" />
        <circle cx="60" cy="66" r="4" />
        <path d="M60 66 L60 40 L110 40 L110 58" />
        <circle cx="60" cy="40" r="3" />
        <circle cx="110" cy="40" r="3" />
        <circle cx="110" cy="58" r="5" />
        <path d="M104 58 h12 M110 52 v12" strokeDasharray="2 2" />
      </svg>
      <p className="mt-2 font-mono text-xs text-zinc-500">No invoices match — arm holding position.</p>
    </div>
  );
}

const FALLBACK_LEDGER: InvoiceDoc[] = [
  { id: 'INV-2041', vendor: 'Acme Corp', total: 11800, status: 'APPROVED', ts: Date.now() },
  { id: 'INV-2042', vendor: 'Globex', total: 42500, status: 'FLAGGED_DISCREPANCY', ts: Date.now() },
];

export default function DashboardPage() {
  const [ledger, setLedger] = useState<InvoiceDoc[]>(FALLBACK_LEDGER);
  const [live, setLive] = useState(false);
  const [query, setQuery] = useState('');
  const [currency, setCurrency] = useState<Currency>('INR');
  const [selected, setSelected] = useState<InvoiceDoc | null>(null);
  const [estopped, setEstopped] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => subscribeInvoices(
    (rows) => { if (rows.length) { setLedger(rows); setLive(true); } },
    () => setLive(false),
  ), []);

  // Autofocus search on open; global shortcuts (ignored while typing).
  useEffect(() => { searchRef.current?.focus(); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const typing = /^(INPUT|TEXTAREA)$/.test((e.target as HTMLElement)?.tagName || '');
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (typing) return;
      if (e.code === 'Space') {
        e.preventDefault();
        tripEstop();
      } else if (e.key.toLowerCase() === 'r') {
        setQuery('');
        searchRef.current?.focus();
        toast('Ledger filter cleared', 'ok');
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estopped]);

  function tripEstop() {
    if (estopped) return;
    setEstopped(true);
    sound.alarm();
    toast('E-STOP latched on console — verify hardware before resume', 'err');
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ledger;
    return ledger.filter((r) =>
      r.id.toLowerCase().includes(q) || r.vendor.toLowerCase().includes(q));
  }, [ledger, query]);

  const flaggedAny = ledger.some((r) => r.status !== 'APPROVED');

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 space-y-4">
      <StatusFavicon status={estopped ? 'estop' : flaggedAny ? 'auditing' : 'processing'} />
      <Toaster />

      <div className="flex items-center gap-3">
        <h1 className="font-display text-2xl font-bold text-white tracking-tight">Live console</h1>
        <span className={`font-mono text-[11px] px-2 py-0.5 rounded-full border ${live ? 'text-emerald-300 border-emerald-500/30' : 'text-zinc-500 border-line'}`}>
          {live ? '● FIRESTORE LIVE' : '○ LOCAL SNAPSHOT'}
        </span>
        <button
          onClick={() => setCurrency((c) => (c === 'INR' ? 'USD' : 'INR'))}
          title="Toggle display currency"
          className="touch-target rounded-lg border border-line px-3 font-mono text-xs text-zinc-300 hover:border-zinc-500"
        >
          {currency === 'INR' ? '₹ INR' : '$ USD'}
        </button>
        <button
          onClick={tripEstop}
          className={`touch-target ml-auto px-4 rounded-lg border font-mono text-sm font-bold ${estopped
            ? 'bg-red-500 text-black border-red-500'
            : 'bg-red-500/15 border-red-500/40 text-red-300'}`}
        >
          {estopped ? 'E-STOPPED' : 'E-STOP'}
        </button>
      </div>
      {estopped && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 font-mono text-xs text-red-300">
          Console E-stop latched (Space). Clear the physical cause, then reload to resume.
        </p>
      )}

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
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-mono text-[11px] tracking-[0.2em] text-zinc-500">INVOICE LEDGER</h2>
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search vendor / ID  (⌘K)"
            aria-label="Search invoices"
            className="touch-target ml-auto min-w-0 flex-1 sm:flex-none sm:w-64 rounded-lg border border-line bg-ink px-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-amber-400/60 focus:outline-none"
          />
          <ExportButtons ledger={filtered} />
        </div>
        {filtered.length === 0 ? (
          <div className="mt-2"><EmptySchematic /></div>
        ) : (
          <ul className="mt-2 space-y-2">
            {filtered.map((inv) => (
              <li key={inv.id}>
                <button
                  onClick={() => { sound.click(); setSelected(inv); }}
                  className="touch-target flex w-full items-center gap-3 rounded-lg border border-line bg-ink px-3 text-left hover:border-zinc-500"
                >
                  <div>
                    <p className="text-sm text-white font-medium">{inv.id} · {inv.vendor}</p>
                    <p className="font-mono text-[11px] text-zinc-500">
                      {formatMoney(inv.total, currency)} · <span title={exactUtc(inv.ts)}>{timeAgo(inv.ts)}</span>
                    </p>
                  </div>
                  <span className="ml-auto"><Badge status={inv.status} /></span>
                </button>
              </li>
            ))}
          </ul>
        )}
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

      <InvoiceSheet inv={selected} currency={currency} onClose={() => setSelected(null)} />
    </main>
  );
}
