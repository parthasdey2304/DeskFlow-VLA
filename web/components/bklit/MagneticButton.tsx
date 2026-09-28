'use client';
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

export function MagneticButton({ children }: { children: ReactNode }) {
  return (
    <motion.span
      whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
      className="touch-target inline-flex cursor-pointer items-center gap-2 rounded-lg bg-amber-400 px-4 font-semibold text-black text-sm"
    >
      {children}
    </motion.span>
  );
}
