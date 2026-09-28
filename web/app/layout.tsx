import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'DeskFlow-VLA — Physical-to-Digital Paperwork Robot',
  description: 'Edge robotics + CBF safety + multi-model AI audit for office paperwork.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" className={`dark ${inter.variable} ${mono.variable}`}>
        <body className="bg-ink text-zinc-200 font-sans antialiased min-h-dvh">{children}</body>
      </html>
    </ClerkProvider>
  );
}
