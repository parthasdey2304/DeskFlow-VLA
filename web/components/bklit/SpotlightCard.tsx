'use client';
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

export function SpotlightCard({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <motion.div
      whileHover={{ y: -3 }}
      className="group relative overflow-hidden rounded-xl border border-line bg-panel p-5"
    >
      <div className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-amber-400/10 blur-2xl transition group-hover:bg-amber-400/20" />
      <div className="flex items-center gap-2 text-amber-300">{icon}<h3 className="font-mono text-sm font-bold text-white">{title}</h3></div>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">{children}</p>
    </motion.div>
  );
}
