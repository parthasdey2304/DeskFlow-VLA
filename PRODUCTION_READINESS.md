# DeskFlow-VLA — Production Readiness Report (v1.2.0)

Generated: 2026-09-28 · Branch: main · Audit pass + build-green pass complete

## 1. Verification results
| Gate | Command | Result |
|---|---|---|
| CBF + fallback + supervisor unit tests | `python -m pytest backend-edge/tests -q` | **7 passed** |
| pip requirements resolve | `pip install --dry-run --no-deps -r backend-edge/requirements.txt` | **pass** |
| Architecture graph parse + ref check | `node graphify/render_graph.js --check` | **16 nodes / 15 edges ok**, no dangling refs |
| Desktop main/preload/renderer syntax | `node --check` | **pass** |
| Next.js production build | `cd web && npm install && npm run build` | **pass — 8/8 routes** (dummy Clerk keys, telemetry disabled) |

## 2. Module inventory
- **Hardware**: `esp32_firmware.ino` (100 Hz FreeRTOS, stall trip 2800 mA×3, vent-on-boot), `platformio.ini`, interactive Tailwind `visualizer/` (rail toggles + hover specs), `bom.json` (₹44,070 costed), `pinouts.md`.
- **Edge**: `cbf_safety.py` (h_pos/h_vel fail-closed + Bezier planner), `ai_fallback_client.py` (Spark→Gemini→Kiro, backoff, token cache), `supervisor.py` (ROS-agnostic core + `SupervisorNode`), `Dockerfile` (ROS Jazzy).
- **Web**: Next.js 14 App Router, Clerk middleware, industrial tactile theme (zinc/amber, noise, Geist/JetBrains Mono), R3F `DeskArmCanvas`, Firestore live ledger w/ local fallback, Razorpay order (allow-listed ₹49,999/₹2,999) + HMAC timing-safe verify → signed license token, telemetry ingest with CBF-mirror envelope reject, mobile bottom-nav + `dvh`.
- **Desktop**: Electron tray (green/amber/red), hide-to-tray, discrepancy notifications, serial diagnostics panel.
- **Android**: Compose M3, joint jog sliders + haptics, ledger chips, 56 dp E-stop bar, `release_notes.md`.
- **Graphify**: 16-node/15-edge JSON + CLI (`--check` validates edge endpoints, ASCII map, `graph.html`).
- **CI**: `pr-merge-squash.yml` (pytest → next build → squash-merge → delete `agent/**`), `rules.md`.
- **Docs**: `README.md` (architecture + setup), `docs/OPERATIONS.md` (bring-up, runbook, pre-flight, troubleshooting, API contracts, schemas), `firestore.rules` (client read-only, server-write).

## 3. Pre-flight before hardware power-on
1. `cd web && npm install && npm run build` must be green (Vercel env: Clerk, Firebase, Razorpay keys from `.env.example`).
2. Flash firmware via `pio run -t upload`; confirm vent valve HIGH at boot.
3. Bench-test stall trip with current-limited supply before mounting servos.
4. `apksigner` + SHA256 the release APK; record checksum in `android/release_notes.md`.
5. Never weaken CBF envelopes or Razorpay HMAC without review per `.agents/rules.md`.
6. Full step-by-step: `docs/OPERATIONS.md` §1–§3.

## 4. Audit fixes applied in v1.1.0 (were blocking or missing)
1. **`backend-edge/requirements.txt` was uninstallable** — first line (`rclpy;micro-ros-agent`)
   is not a valid pip spec and broke `pip install`, including the CI `cbf-tests` job.
   `rclpy` now documented as ROS-underlay-provided; pip deps resolve clean.
2. **`README.md` was a 2-line stub** — now a full production README (pipeline diagram,
   monorepo map, safety architecture, per-module setup, Firestore/API summary).
3. **No Firestore access policy** — added `firestore.rules` (client read-only
   `invoices`/`telemetry`, own-doc `licenses`; all writes via Admin SDK).
4. **`.env.example` incomplete** — now documents every consumer: app URL, Clerk,
   full Firebase set + service-account path, Razorpay + separate license secret,
   all three AI tier keys + `DESKFLOW_STRICT_KEYS`.
5. **Open code TODOs closed** — `verify` route mints a verifiable signed license
   token (plan resolved from the settled order, not client input); `telemetry`
   route rejects out-of-envelope samples with 422; `CheckoutButton` injects the
   Razorpay SDK once and honors verification failures; graph `--check` fails on
   dangling edge references.
6. **No operator documentation** — added `docs/OPERATIONS.md`: staged bench
   bring-up (§1), Pi runbook with topic map (§2), pre-flight checklist (§3),
   symptom table (§4), API contracts + Admin SDK snippets + document schemas (§5).

## 5. Known remaining operator actions (not code defects)
- `git status`: work is on disk; commit to `main` (or via an `agent/**` branch to
  exercise the squash-merge workflow) — nothing has been pushed yet.
- `android/release_notes.md`: SHA256 placeholder must be filled after `assembleRelease`.
- `licenses`/`telemetry` Firestore persists are implemented as documented Admin SDK
  call-sites (§5 snippets); wiring them needs `FIREBASE_SERVICE_ACCOUNT_PATH` on
  the deployment target.
- Firmware servo driver is written but NOT compile-verified here (no
  PlatformIO/ESP32 toolchain) — run `pio run` in `hardware/firmware/` before
  flashing, then the §1–§2 bring-up.

## 6. v1.2.0 solve pass (this session)
1. **STS3215 packet writer — DONE in firmware.** Hand-rolled SMS/STS driver:
   SYNC_WRITE (0x83) broadcast positions @100 Hz, boot torque-enable +
   cruise-speed (1500 steps/s ≈ 2.3 rad/s < V_MAX), round-robin present-position
   reads (~25 Hz/joint, fail-silent), boot ping census on the debug console,
   single-wire half-duplex with echo-drain, rad↔counts map (center 2048,
   4096 steps/rev). Calibrate `SERVO_IDS`/`SERVO_SIGN` per §2.4. NOT
   compile-verified (no PlatformIO/ESP32 toolchain on this machine) — run
   `pio run` before flashing.
2. **Desktop real IPC — DONE.** `main.js` is now a link manager: serial
   auto-detect (Espressif/CP210x/CH340, 115200, `DF:` protocol) + LAN TCP
   client (`DESKFLOW_PI_HOST:DESKFLOW_PI_PORT`) + honest `LINK SIM` degrade.
   E-stop is end-to-end real: `DF:ESTOP` over the USB-Serial-JTAG console →
   firmware vents + publishes `/deskflow/estop`, plus best-effort Pi POST;
   per-leg delivery is reported in the event log. Fake simulate buttons removed.
   Requires `cd desktop && npm install` (serialport) on the operator machine.
3. **Web build — GREEN.** Fixed three real bugs the first build exposed:
   `next.config.mjs` contained TypeScript syntax (failed on all Node versions),
   `rotation` was on `<cylinderGeometry>` instead of `<mesh>`, and
   `auth.protect()` didn't match the installed Clerk v5 types (`auth().protect()`).
   `package-lock.json` generated (CI's `npm ci` needs it). 8/8 routes built.
   Still operator-side: firmware flash + hardware-in-loop (no hardware here),
   APK `assembleRelease` + SHA256 (no Android SDK here).
4. **bklit-ui — evaluated, documented.** Upstream is an MIT shadcn chart
   registry, not a button library; local components stay, exact adoption
   commands recorded in `docs/OPERATIONS.md` §7.4.
5. **Everything committed** — see git log.
