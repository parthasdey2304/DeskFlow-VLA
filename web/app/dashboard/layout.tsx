import Link from 'next/link';
import { LayoutDashboard, Receipt, Settings } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-ink lg:grid lg:grid-cols-[240px_1fr]">
      {/* desktop sidebar */}
      <aside className="hidden lg:flex flex-col border-r border-line bg-panel p-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-amber-400 text-black font-mono font-bold grid place-items-center">DF</div>
          <span className="font-mono text-sm font-bold text-white">DESKFLOW</span>
        </div>
        <nav className="mt-6 space-y-1 text-sm">
          {[
            { icon: LayoutDashboard, label: 'Telemetry', href: '/dashboard' },
            { icon: Receipt, label: 'Ledger', href: '/dashboard#ledger' },
            { icon: Settings, label: 'Billing', href: '/dashboard#billing' },
          ].map(({ icon: Icon, label, href }) => (
            <Link key={label} href={href} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-zinc-400 hover:bg-ink hover:text-white">
              <Icon size={17} /> {label}
            </Link>
          ))}
        </nav>
        <p className="mt-auto font-mono text-[11px] text-zinc-600">CBF-GATED · 100 Hz · E-STOP ARMED</p>
      </aside>
      <div className="pb-20 lg:pb-0">{children}</div>
      {/* mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-20 border-t border-line glass">
        <div className="grid grid-cols-3">
          {[
            { icon: LayoutDashboard, label: 'Telemetry' },
            { icon: Receipt, label: 'Ledger' },
            { icon: Settings, label: 'Billing' },
          ].map(({ icon: Icon, label }) => (
            <a key={label} href="#ledger" className="touch-target flex flex-col items-center justify-center gap-0.5 text-[11px] font-mono text-zinc-400">
              <Icon size={20} /> {label.toUpperCase()}
            </a>
          ))}
        </div>
      </nav>
    </div>
  );
}
