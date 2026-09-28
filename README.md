# DeskFlow-VLA — Enterprise Physical-to-Digital Robotics Ecosystem

An autonomous desk-side document processing node: a 4-DoF vacuum-gripper arm photographs
each incoming invoice, audits it across a 3-tier AI fallback chain, proves every motion
safe with Control Barrier Functions **before** any servo moves, then physically files the
paper into `approved` or `audit_flagged` trays while streaming results to web / desktop /
mobile consoles in real time.

```
Paper in-tray → Sony IMX477 frame → AI audit (Spark → Gemini → Kiro)
  → cubic-Bézier plan → CBF gate (h_pos, h_vel ≥ 0) → micro-ROS @921600
  → ESP32-S3 100 Hz loop → 4× STS3215 + vacuum grip → Firestore ledger
  → Next.js console / Electron tray / Android companion
```

## Monorepo layout

| Path | Stack | Purpose |
|---|---|---|
| `hardware/firmware/` | C++ / FreeRTOS / micro-ROS, PlatformIO | ESP32-S3 motion core: 100 Hz loop, stall-current reflex, vacuum seal sense |
| `hardware/visualizer/` | Tailwind + SVG/JS, zero build | Interactive wiring inspector with voltage-rail toggles |
| `hardware/schematics/` | JSON / Markdown | Costed BOM (₹44,070) + full pin multiplexing matrix |
| `backend-edge/` | Python / ROS 2 Jazzy, Docker | Supervisor node, CBF safety engine, 3-tier AI fallback client, pytest suite |
| `web/` | Next.js 14 App Router, Clerk, Firestore, Razorpay, R3F | Landing + live console, auth, realtime ledger, checkout, telemetry ingest |
| `desktop/` | Electron + Forge | Office workstation tray app with E-stop + discrepancy notifications |
| `android/` | Jetpack Compose M3, `arm64-v8a` | Mobile edge monitor: feed status, joint jog, ledger, E-stop bar |
| `graphify/` | JSON + Node CLI | 16-node / 15-edge architecture knowledge graph + ASCII/HTML renderer |
| `.agents/` | GitHub Actions + Markdown | `agent/**` → tests + build → squash-merge → branch-delete automation |
| `docs/` | Markdown | Bring-up, edge runbook, pre-flight, troubleshooting, API contracts |
| `firestore.rules` | Firebase Security Rules | Access policy for `invoices`, `telemetry`, `licenses` collections |

## Safety architecture (read this first)

Two independent, fail-closed gates — a breach anywhere parks the arm, vents vacuum, and
flags the invoice instead of moving:

1. **Cloud/edge gate — `backend-edge/cbf_safety.py`**
   `h_pos(q) = min(q_max − q, q − q_min) ≥ 0`, `h_vel(dq) = v_max − |dq| ≥ 0`
   on **every** waypoint. One breach discards the **entire** path and publishes to
   `/deskflow/audit_stream` for re-plan. Empty trajectory = unsafe.
2. **Hardware gate — `esp32_firmware.ino`**
   Shunt-amplifier current sense trips at **2800 mA × 3 consecutive reads** (100 Hz),
   vents the 3-way valve, cuts the pump, latches E-stop, publishes `/deskflow/estop`.
   Boots **vented** (valve HIGH, pump OFF) so power-loss = paper drops safe.

Joint envelopes (mirrored in firmware **and** `cbf_safety.py` — keep them in sync):
`Q_MIN = (−2.62, −1.57, −2.09, −2.62)`, `Q_MAX = (2.62, 1.57, 2.09, 2.62)` rad, `V_MAX = 3.0` rad/s.

Non-negotiable invariants (also enforced in `.agents/rules.md`):
- No trajectory may bypass `validate_trajectory()`.
- Never weaken the 2800 mA trip, vent-on-boot, or Razorpay HMAC check without review.
- Razorpay `verify` always uses HMAC-SHA256 + `timingSafeEqual`.

## Hardware

- **BOM**: `hardware/schematics/bom.json` — 11 line items, ₹44,070 build cost
  vs ₹49,999 unit price / ₹2,999-mo HaaS. Source links inline.
- **Pin map**: `hardware/schematics/pinouts.md` — ESP32-S3 GPIO 17 (servo bus),
  GPIO 4 (pump relay), GPIO 5 (vent MOSFET), GPIO 6 (MPX5010DP pressure ADC),
  GPIO 7 (INA181 stall-current ADC), GPIO 18/19 (Pi 5 micro-ROS UART @ 921600).
- **Wiring inspector**: open `hardware/visualizer/index.html` in any browser —
  hover nodes/wires for voltage, peak current, fail-safe behavior; toggle
  12V / 5V / 3V3 / GND / SIG rails to trace power.
- **Flash**: `pio run -t upload` from `hardware/firmware/` (see `platformio.ini`).
- **Bring-up procedure**: `docs/OPERATIONS.md` §1 — bench-test the stall trip on a
  current-limited supply *before* mounting servos.

## Edge backend (`backend-edge/`)

| File | Role |
|---|---|
| `ai_fallback_client.py` | Tier 1 **Muse Spark 1.3** → Tier 2 **Gemini Flash** → Tier 3 **Kiro**; per-tier timeout, 429/5xx exponential backoff, token cache; never raises — returns structured `AIResult` so frames never drop |
| `cbf_safety.py` | Pure CBF engine + cubic-Bézier planner with limit-aware control points |
| `supervisor.py` | ROS-agnostic `Supervisor` core (unit-testable without `rclpy`) + `SupervisorNode` wrapper publishing `/deskflow/trajectory`, `/deskflow/audit_stream`, subscribing `/deskflow/estop` |
| `Dockerfile` | `ros:jazzy-ros-core` container; `rclpy` comes from the ROS underlay, **not** pip |

Invoice math check: `valid_math = (subtotal + tax == total)` (±0.01 tolerance).
Valid → `approved` bin `[1.4, −0.3, 0.6, 0.9]`; mismatch → `audit_flagged` bin.
Set `DESKFLOW_STRICT_KEYS=1` to skip tiers with missing API keys; keys live in
`MUSE_SPARK_KEY`, `GEMINI_API_KEY`, `KIRO_API_KEY` (see `web/.env.example`).

```bash
cd backend-edge && pytest -q            # 7 tests: CBF pos/vel/empty/bezier, math, fallback chain, routing
python supervisor.py                   # host self-check when rclpy is absent
```

## Web console (`web/`)

Next.js 14 App Router, industrial tactile theme (zinc/amber, hairlines, noise,
JetBrains Mono), mobile-first (`dvh`, bottom nav, ≥44 px targets), React Three Fiber
arm viewer, bespoke bklit-style spotlights/magnetic buttons (upstream bklit-ui is a
shadcn chart registry — adoption path for real charts in `docs/OPERATIONS.md` §7.4),
React Bits reveals.

| Route | Purpose |
|---|---|
| `/` | Landing: hero, capability strip, audit-shape preview, pricing |
| `/sign-in`, `/sign-up` | Clerk auth (public); everything else protected by `middleware_auth.ts` |
| `/dashboard` | Live console: 3D arm, edge telemetry, Firestore invoice ledger, HaaS billing |
| `POST /api/razorpay/order` | Allow-listed order create — `4999900` (unit) / `299900` (HaaS) paise only |
| `POST /api/razorpay/verify` | HMAC-SHA256 verify → mints signed license token (`licenses` collection schema in `docs/OPERATIONS.md`) |
| `POST /api/telemetry` | Pi 5 → cloud ingest; validates 4-DoF envelope server-side (CBF mirror) |

```bash
cd web && cp .env.example .env.local   # fill Clerk / Firebase / Razorpay keys
npm install && npm run build && npm start
```

Firestore: `subscribeInvoices()` in `lib/firebase.ts` tails `invoices` (ordered by
`ts`, limit 25) with graceful local-snapshot fallback when offline/unconfigured.
Security rules: `firestore.rules` at repo root.

## Desktop & mobile

- **Electron** (`desktop/`): `npm install && npx electron-forge start`; tray icon
  green/amber/red mirrors robot status, hide-to-tray, native discrepancy alerts,
  serial diagnostics panel in `renderer/`.
- **Android** (`android/`): Compose M3, `arm64-v8a`, minSdk 29 / targetSdk 34;
  `./gradlew assembleRelease`, then `apksigner verify` + record the SHA256 in
  `release_notes.md` before any rollout. E-stop bar must be physically tested
  against `/deskflow/estop` each release.

## Graphify & CI

```bash
node graphify/render_graph.js --check   # validates nodes + edge endpoints
node graphify/render_graph.js           # ASCII map + writes graphify/graph.html
```

Pushes to `agent/**` run CBF tests + Next.js build, auto-open a PR to `main`,
squash-merge, and delete the branch (`.agents/workflows/pr-merge-squash.yml`).
Agent branch/commit/validation protocols: `.agents/rules.md`.

## Production readiness

`PRODUCTION_READINESS.md` tracks the verification gates. Before powering hardware,
complete the pre-flight checklist in `docs/OPERATIONS.md` §3.

## Releases (signed binaries + SHA256)

- Desktop v1.0.1 (Windows x64): `desktop/release_notes.md` + GitHub Releases tag `desktop-v1.0.1`.
- Android v1.0.1-production (arm64-v8a): `android/release_notes.md` + GitHub Releases tag `android-v1.0.1-production`.
- Always verify the SHA256 (and the APK signer cert) before installing.
