'use client';
import { motion } from 'framer-motion';
export function RevealText({ text, delay = 0 }: { text: string; delay?: number }) {
  return (
    <motion.span
      initial={{ y: '0.6em', opacity: 0 }} animate={{ y: 0, opacity: 1 }}
      transition={{ delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="inline-block"
    >
      {text}
    </motion.span>
  );
}
