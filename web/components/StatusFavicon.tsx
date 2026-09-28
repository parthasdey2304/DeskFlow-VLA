'use client';
import { useEffect } from 'react';

/** Browser-tab status dot: green = processing, amber = auditing, red = E-stop. */
const COLORS = { processing: '#34d399', auditing: '#fbbf24', estop: '#f87171' } as const;

export function StatusFavicon({ status }: { status: keyof typeof COLORS }) {
  useEffect(() => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" rx="4" fill="#09090b"/><circle cx="8" cy="8" r="4.5" fill="${COLORS[status]}"/></svg>`;
    let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  }, [status]);
  return null;
}
