import Link from 'next/link';
import { ArrowRight, ShieldCheck, ScanLine, Cpu, Factory } from 'lucide-react';
import DeskArmCanvas from '@/components/three/DeskArmCanvas';
import { SpotlightCard } from '@/components/bklit/SpotlightCard';
import { MagneticButton } from '@/components/bklit/MagneticButton';
import { RevealText } from '@/components/reactbits/RevealText';
import { AnimatedNumber } from '@/components/reactbits/AnimatedNumber';

export default function LandingPage() {
  return (
    <main className="min-h-dvh bg-ink">
      {/* top bar */}
      <header className="sticky top-0 z-20 border-b border-line glass">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-amber-400 text-black font-mono font-bold grid place-items-center">DF</div>
          <span className="font-mono text-sm font-bold text-white tracking-tight">DESKFLOW-VLA</span>
          <span className="hidden sm:inline font-mono text-[11px] text-zinc-500 border border-line rounded px-2 py-0.5">CBF-GATED · ROS 2 · v1.0</span>
          <nav className="ml-auto flex items-center gap-2">
            <Link href="/dashboard" className="touch-target hidden sm:grid place-items-center px-3 text-sm text-zinc-400 hover:text-white">Console</Link>
            <Link href="/sign-in"><MagneticButton>Sign in</MagneticButton></Link>
          </nav>
        </div>
      </header>

      {/* hero: asymmetric industrial grid, NOT a centered gradient blob */}
      <section className="mx-auto max-w-6xl px-4 pt-10 pb-6 grid gap-6 lg:grid-cols-[1.05fr_.95fr]">
        <div className="rounded-xl hairline bg-panel p-6 sm:p-8 relative overflow-hidden">
          <div className="absolute inset-y-0 left-0 w-1 bg-amber-400" />
          <p className="font-mono text-[11px] tracking-[0.2em] text-amber-300">PHYSICAL → DIGITAL · EDGE ROBOTICS</p>
          <h1 className="mt-3 font-display text-4xl sm:text-5xl font-bold text-white leading-[1.02] tracking-tight">
            <RevealText text="Paper in." /><br />
            <span className="text-zinc-500"><RevealText text="Ledger out." delay={0.15} /></span>
          </h1>
          <p className="mt-4 text-zinc-400 max-w-md text-[15px] leading-relaxed">
            A 4-DoF desk arm vacuums each invoice off the in-tray, photographs it under a
            Sony IMX477, audits the math across three AI tiers, and files it — every motion
            proven safe by Control Barrier Functions before a single servo moves.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/dashboard"><MagneticButton>Open live console <ArrowRight size={16} /></MagneticButton></Link>
            <Link href="#pricing" className="touch-target inline-flex items-center px-4 rounded-lg border border-line text-sm text-zinc-300 hover:border-zinc-500">Buy unit · ₹49,999</Link>
          </div>
          <dl className="mt-8 grid grid-cols-3 gap-3 font-mono">
            {[['100 Hz', 'control loop'], ['2800 mA', 'stall trip'], ['8 kPa', 'seal thresh']].map(([v, l]) => (
              <div key={l} className="rounded-lg border border-line bg-ink p-3">
                <dt className="text-amber-300 text-lg font-bold">{v}</dt>
                <dd className="text-[11px] text-zinc-500">{l}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="rounded-xl hairline bg-panel overflow-hidden min-h-[320px] relative">
          <DeskArmCanvas />
          <p className="absolute bottom-2 left-3 font-mono text-[11px] text-zinc-500">DRAG TO ORBIT · LIVE JOINT MIRROR IN CONSOLE</p>
        </div>
      </section>

      {/* capability strip */}
      <section className="mx-auto max-w-6xl px-4 py-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: ScanLine, t: 'Overhead audit', d: 'IMX477 frame → vendor, invoice_no, subtotal, tax, total. valid_math checked on-device.' },
          { icon: ShieldCheck, t: 'CBF gate', d: 'h_pos ≥ 0 and h_vel ≥ 0 on every waypoint. Breach = whole path discarded.' },
          { icon: Cpu, t: '3-tier AI', d: 'Muse Spark 1.3 → Gemini Flash → Kiro. Exponential backoff, no dropped frames.' },
          { icon: Factory, t: 'Desk hardware', d: 'ESP32-S3 + Pi 5 + STS3215 bus + vacuum grip with stall-current reflex.' },
        ].map(({ icon: Icon, t, d }) => (
          <SpotlightCard key={t} title={t} icon={<Icon size={18} />}>{d}</SpotlightCard>
        ))}
      </section>

      {/* ledger + pricing */}
      <section id="pricing" className="mx-auto max-w-6xl px-4 pb-16 grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="rounded-xl hairline bg-panel p-6">
          <h2 className="font-mono text-xs tracking-[0.2em] text-zinc-500">LIVE AUDIT SHAPE</h2>
          <div className="mt-3 space-y-2 font-mono text-sm">
            <div className="flex items-center gap-3 rounded-lg border border-line bg-ink px-3 py-2.5">
              <span className="text-zinc-500">INV-2041 · Acme</span>
              <span className="ml-auto px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 text-xs border border-emerald-500/30">APPROVED</span>
              <span className="text-zinc-400">₹<AnimatedNumber value={11800} /></span>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-red-500/30 bg-ink px-3 py-2.5">
              <span className="text-zinc-500">INV-2042 · Globex</span>
              <span className="ml-auto px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 text-xs border border-red-500/30">FLAGGED_DISCREPANCY</span>
              <span className="text-zinc-400">Δ ₹500</span>
            </div>
          </div>
          <p className="mt-3 text-xs text-zinc-500 font-mono">Real-time Firestore snapshot · full ledger in console.</p>
        </div>
        <div className="rounded-xl hairline bg-panel p-6">
          <h2 className="font-mono text-xs tracking-[0.2em] text-zinc-500">OWN THE PIPELINE</h2>
          <p className="mt-2 text-3xl font-bold text-white font-display">₹49,999 <span className="text-sm text-zinc-500 font-mono">$599</span></p>
          <p className="text-sm text-zinc-400">DeskFlow unit + HaaS ₹2,999/mo. Razorpay checkout, HMAC-verified license.</p>
          <Link href="/dashboard" className="touch-target mt-4 flex items-center justify-center gap-2 rounded-lg bg-amber-400 px-4 font-semibold text-black">Buy / Subscribe <ArrowRight size={16} /></Link>
        </div>
      </section>
    </main>
  );
}
