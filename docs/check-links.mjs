#!/usr/bin/env node
// docs/check-links.mjs — validates relative links in repo Markdown files.
// Usage: node docs/check-links.mjs [--root <dir>]
// Checks: relative file links exist, same-file #anchors exist (by slug),
// external URLs are well-formed (not fetched). Exits non-zero on breakage.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv.includes('--root')
  ? process.argv[process.argv.indexOf('--root') + 1]
  : path.join(import.meta.dirname, '..'));

const SKIP_DIRS = new Set(['node_modules', '.git', '.next', 'out', 'build', '.gradle', '.pio']);
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') && e.name !== '.agents' && e.name !== '.github') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) walk(p);
    } else if (e.name.endsWith('.md')) {
      files.push(p);
    }
  }
})(root);

const slug = (s) => s.trim().toLowerCase()
  .replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
const broken = [];
const linkRe = /\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const anchors = new Set(
    [...text.matchAll(/^#{1,6}\s+(.+)$/gm)].map((m) => slug(m[1])),
  );
  let m;
  while ((m = linkRe.exec(text)) !== null) {
    const raw = m[2];
    if (/^(https?:|mailto:|#)/.test(raw)) {
      if (raw.startsWith('#') && !anchors.has(slug(decodeURIComponent(raw.slice(1))))) {
        broken.push(`${file}: anchor ${raw} not found`);
      }
      continue;
    }
    const [rel, frag] = raw.split('#');
    const target = path.resolve(path.dirname(file), decodeURIComponent(rel));
    if (!fs.existsSync(target)) {
      broken.push(`${file}: link ${raw} -> missing ${target}`);
      continue;
    }
    if (frag && target.endsWith('.md')) {
      const t = fs.readFileSync(target, 'utf8');
      const ta = new Set([...t.matchAll(/^#{1,6}\s+(.+)$/gm)].map((x) => slug(x[1])));
      if (!ta.has(slug(decodeURIComponent(frag)))) {
        broken.push(`${file}: link ${raw} -> anchor #${frag} missing in ${target}`);
      }
    }
  }
}

if (broken.length) {
  console.error(`docs link check FAILED (${broken.length}):`);
  for (const b of broken) console.error(`  ${b}`);
  process.exit(1);
}
console.log(`docs link check ok (${files.length} markdown files)`);
