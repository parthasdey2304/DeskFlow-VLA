#!/usr/bin/env node
/** render_graph.js — ASCII map + interactive HTML from architecture_graph.json */
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'architecture_graph.json');
const g = JSON.parse(fs.readFileSync(file, 'utf8'));

if (process.argv.includes('--check')) {
  const ids = new Set(g.nodes.map((n) => n.id));
  const dangling = g.edges.filter((e) => !ids.has(e.from) || !ids.has(e.to));
  if (dangling.length) {
    console.error(`graph INVALID: ${dangling.length} edge(s) reference unknown nodes:`);
    for (const e of dangling) console.error(`  ${e.from} -> ${e.to}`);
    process.exit(1);
  }
  console.log(`graph ok: ${g.nodes.length} nodes, ${g.edges.length} edges`);
  process.exit(0);
}

// ASCII dependency map
console.log(`\nDeskFlow-VLA architecture (${g.nodes.length} nodes / ${g.edges.length} edges)\n`);
for (const e of g.edges) {
  console.log(`  ${e.from.padEnd(12)} ──[${e.protocol}]──▶ ${e.to}`);
}

// Interactive HTML relationship graph (force-lite SVG)
const nodes = g.nodes.map((n, i) => {
  const a = (i / g.nodes.length) * Math.PI * 2;
  return { ...n, x: 400 + 300 * Math.cos(a), y: 260 + 200 * Math.sin(a) };
});
const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
const links = g.edges.map((e) => {
  const a = byId[e.from], b = byId[e.to];
  return a && b
    ? `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#3f3f46"/><text x="${(a.x + b.x) / 2}" y="${(a.y + b.y) / 2}" fill="#71717a" font-size="9" font-family="monospace">${e.protocol}</text>`
    : '';
}).join('\n');
const dots = nodes.map((n) =>
  `<g><circle cx="${n.x}" cy="${n.y}" r="10" fill="#fbbf24"/><text x="${n.x}" y="${n.y + 26}" fill="#e4e4e7" font-size="10" font-family="monospace" text-anchor="middle">${n.label}</text></g>`
).join('\n');

fs.writeFileSync(
  path.join(__dirname, 'graph.html'),
  `<!DOCTYPE html><html><body style="background:#09090b;margin:0"><svg viewBox="0 0 800 520" style="width:100%">${links}\n${dots}</svg></body></html>`,
);
console.log('\nwrote graphify/graph.html');
