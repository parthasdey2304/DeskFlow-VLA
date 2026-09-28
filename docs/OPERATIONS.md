# DeskFlow-VLA Operations Handbook

Bench bring-up, edge runbook, pre-flight checks, API contracts, Firestore schemas,
and troubleshooting. Companion to `README.md` (architecture) and
`PRODUCTION_READINESS.md` (verification gates).

---

## 1. Hardware bench bring-up (do this before mounting anything)

Order matters — power faults are cheapest to find with nothing attached.

### 1.1 Power rails (no boards connected)
1. Set the 12 V brick current limit to **2 A**. Verify 12.0 ± 0.3 V at the PSU
   terminals, then at the far end of the orange distribution lead.
2. Power the buck converter alone; trim to **5.0 ± 0.1 V** (red rail).
3. Confirm the 7.5 A fuse is in series with the 12 V feed, and that the star
   ground (black) lands on a single PSU terminal — analog GND branches off
   through the ferrite bead, not daisy-chained through servo returns.
4. Twist the pump leads together; route them away from the MPX5010DP signal wire.

### 1.2 ESP32-S3 first flash (USB only, no 12 V yet)
1. `cd hardware/firmware && pio run -t upload`.
2. Expected boot behavior: **vent valve HIGH (vented), pump OFF, status LED solid**.
   If the valve is not HIGH at boot, stop — the fail-safe default is broken.
3. Open the wiring inspector (`hardware/visualizer/index.html`) and trace each
   rail toggle against the physical build before connecting the Pi.

### 1.3 Stall-trip test (current-limited supply, ONE servo, no arm linkage)
1. Connect a single STS3215 on GPIO 17 through the 74HC126 buffer.
2. Stall the horn by hand briefly: at **>2800 mA for 3 consecutive 100 Hz reads**
   the firmware must vent, cut the pump, latch E-stop, and publish
   `/deskflow/estop = true`. Status LED blinks.
3. Release and confirm motion stays frozen until the supervisor clears the latch
   (E-stop requires explicit reset — it never self-clears).

### 1.4 Vacuum seal test
1. Cover the suction cup with paper. Differential pressure must read **≥ 8.0 kPa**
   and `/deskflow/seal_engaged` must go true.
2. Lift the paper edge: seal must drop false within ~100 ms (10 Hz publish rate).

### 1.5 Full chain
Mount linkages → Pi 5 USB-UART @ 921600 → micro-ROS agent → run the supervisor
(§2) → feed a test invoice → confirm tray routing matches the ledger entry.

---

## 2. Edge runbook (Raspberry Pi 5, ROS 2 Jazzy)

### 2.1 Start order
```bash
# 1. micro-ROS agent bridging USB-CDC to the ROS graph
ros2 run micro_ros_agent micro_ros_agent serial --dev /dev/ttyACM0 -b 921600
# 2. edge supervisor (Docker, recommended)
cd backend-edge && docker build -t deskflow-edge . && docker run --rm --net host \
  -e MUSE_SPARK_KEY -e GEMINI_API_KEY -e KIRO_API_KEY -e DESKFLOW_STRICT_KEYS=1 \
  deskflow-edge
# 3. bare-metal alternative (sourced ROS underlay provides rclpy)
cd backend-edge && pip install -r requirements.txt && python supervisor.py
```

### 2.2 ROS topics
| Topic | Type | Dir | Meaning |
|---|---|---|---|
| `/deskflow/trajectory` | `Float32MultiArray` (4·N) | Pi → ESP32 | CBF-verified waypoint quartets |
| `/deskflow/audit_stream` | `String` | Pi → all | `FLAGGED <inv> tier=<t>` alerts + CBF rejections |
| `/deskflow/estop` | `Bool` | ESP32 → Pi | Latched hardware E-stop |
| `/deskflow/seal_engaged` | `Bool` | ESP32 → Pi | Vacuum seal @ 8 kPa, 10 Hz |
| `/deskflow/joint_state` | `JointState` | ESP32 → Pi | Actuals for the dashboard mirror |
| `/deskflow/target_point` | (legacy sub) | Pi → ESP32 | Superseded by `/deskflow/trajectory` |

### 2.3 AI tier behavior
- Normal: Tier 1 (Muse Spark 1.3) answers; `tier_used` is recorded per cycle.
- Tier 1 429/5xx/timeout → exponential backoff (0.5 s base, 8 s cap, 3 retries)
  → Tier 2 (Gemini Flash) → Tier 3 (Kiro).
- Total failure never raises: the supervisor parks (`trajectory = []`),
  routes to `audit_flagged`, and logs the tier trace for diagnosis.
- `DESKFLOW_STRICT_KEYS=1` skips tiers with missing keys (recommended in prod
  so you never pay for a surprise fallback path).

### 2.4 Calibration
- Servo zero: use the Android joint-jog sliders (±2.6 rad clamp, haptic ticks),
  then record offsets; re-check after any linkage work.
- Servo IDs: every STS3215 ships as ID 1 — connect **one at a time** and assign
  IDs 1–4 (Feetech FD software or `write2Byte` to register 5, unlocked EEPROM)
  **before** daisy-chaining. The firmware prints a `DF ping id=N ok/MISSING`
  census on the USB-Serial-JTAG console at every boot; all four must read `ok`.
- Joint sign: `SERVO_SIGN[4]` in firmware defaults to all `+1`. If a joint moves
  mirrored, flip its entry and re-run the CBF Bezier test — never compensate by
  widening limits.
- Pressure zero: read MPX5010DP open-to-air; seal threshold stays 8.0 kPa
  differential, not absolute.
- Current zero: read shunt amp with servos idle; trip stays 2800 mA.
- Pressure tare: firmware averages 16 ambient reads at boot (pump OFF, vented);
  seal stays differential (reading − tare ≥ 8 kPa). Re-tare by rebooting unloaded.
- Slew limit: servo output ramps at ≤0.03 rad/cycle (≈3 rad/s); E-stop resume
  is bumpless because output restarts from the last sent position.
- Status LED: solid = healthy, 2-blink = stale micro-ROS link (>5 s, check the
  agent), 3-blink = E-stop latched.
- Current sensing: 4× oversampled ADC + EMA telemetry; the 2800 mA trip still
  acts on raw readings ×3 (a filter must never mask a real stall).

---

## 3. Pre-flight checklist (every power-on, every release)

- [ ] `cd backend-edge && pytest -q` — 7/7 green.
- [ ] `node graphify/render_graph.js --check` — 16 nodes / 15 edges, no dangling refs.
- [ ] `cd web && npm run build` — green (Vercel env keys set per `.env.example`).
- [ ] Firmware boots vented (valve HIGH, pump OFF) — visual check.
- [ ] Stall trip bench-tested since last wiring change.
- [ ] Android: `./gradlew assembleRelease` → `apksigner verify` → SHA256 recorded
      in `android/release_notes.md`; E-stop physically tested vs `/deskflow/estop`.
- [ ] No secrets in git (`git status` clean of `.env*`, `*.key`, service accounts).

---

## 4. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Arm frozen, LED blinking | E-stop latched (stall or supervisor alert) | Inspect `/deskflow/estop` + audit log; clear latch from supervisor only after cause found |
| `seal_engaged` never true | Cup leak, threshold, or P1/P2 swapped | Smoke-test cup with paper; check MPX ports (P1=cup, P2=ambient); keep pump leads twisted |
| All invoices `audit_flagged` | AI tiers unreachable or keys missing | Check tier trace in audit log; verify keys; confirm `DESKFLOW_STRICT_KEYS` intent |
| CBF rejects every plan | Envelope mismatch between `cbf_safety.py` and firmware `Q_MIN/Q_MAX` | Diff the two files — they must be identical; re-tune clearance, never widen limits silently |
| Dashboard shows LOCAL SNAPSHOT | Firebase env missing or rules denying | Fill `NEXT_PUBLIC_FIREBASE_*`; deploy `firestore.rules`; check browser console for snapshot errors |
| Checkout button does nothing | `checkout.js` blocked or order rejected | Console shows which: missing SDK vs `invalid plan amount` (only 4999900/299900 paise accepted) |
| `pip install -r requirements.txt` fails | Stale file pinning `rclpy` | `rclpy` comes from the ROS underlay/image — never add it to pip requirements |
| micro-ROS agent silent | Wrong `/dev/ttyACM*` or baud mismatch | `dmesg \| grep ttyACM`; both ends must be 921600-8N1 |

---

## 5. API contracts & Firestore schemas

### 5.1 `POST /api/razorpay/order`
Request `{ amount: 4999900 | 299900, currency: 'INR' }` → `201` Razorpay order.
Any other amount → `400 invalid plan amount`.

### 5.2 `POST /api/razorpay/verify`
Request `{ razorpay_order_id, razorpay_payment_id, razorpay_signature }` →
HMAC-SHA256 check with `RAZORPAY_KEY_SECRET` (`timingSafeEqual`) → `200
{ verified: true, license }`. `license = { order_id, payment_id,
plan: 'unit'|'haas'|'unresolved', issued_at, signature }` where `signature =
HMAC(LICENSE_SIGNING_SECRET, order|payment|plan|issued_at)`. Verify a license
anywhere by recomputing that HMAC. Persist it from this route via the Admin SDK:

```ts
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
const app = getApps().length ? getApps()[0]
  : initializeApp({ credential: cert(process.env.FIREBASE_SERVICE_ACCOUNT_PATH!) });
await getFirestore(app).collection('licenses').doc(ownerUid).set(license);
```

### 5.3 `POST /api/telemetry`
Request `{ q: [q0..q3], seal: boolean }` → `200 { ack, ts }`. `400` on malformed
shape/non-finite; `422` when any `|q| > 2.62` (CBF-mirror reject). Persist via
Admin SDK to `telemetry/{nodeId}` (merge, with server timestamp).

### 5.4 Firestore documents
```jsonc
// invoices/{invoiceId}
{ "vendor": "Acme", "invoice_number": "INV-2041", "subtotal": 10000,
  "tax": 1800, "total": 11800, "status": "APPROVED", // or "FLAGGED_DISCREPANCY"
  "timestamp": 1729999999999, "tray_id": "approved" }
// telemetry/{nodeId}
{ "q": [0.42, -0.61, 1.05, 0.0], "seal": true, "tier": "muse-spark-1.3",
  "updated_at": 1729999999999 }
// licenses/{ownerUid}
{ "order_id": "order_xxx", "payment_id": "pay_xxx", "plan": "unit",
  "issued_at": 1729999999999, "signature": "hmac-hex" }
```
Rules: `firestore.rules` — clients read-only on `invoices`/`telemetry`, own-doc
reads on `licenses`; all writes via Admin SDK from server routes / supervisor.

---

## 6. Maintenance cadence

- Weekly: suction-cup wear check, shunt-zero reading, audit-log review for tier
  fallback frequency (rising Tier 2/3 usage = Tier 1 key/quota problem).
- Monthly: HaaS billing reconciliation (Razorpay dashboard vs `licenses`
  collection), servo backlash check, backup Firestore.
- Per release: full §3 pre-flight; never ship an APK without its SHA256.

---

## 7. Desktop edge link (Electron)

The desktop app (`desktop/`) is a link manager, not a simulator. Setup:

```bash
cd desktop && npm install   # pulls electron + serialport
npm start                   # or: npx electron-forge make
```

### 7.1 Transports
| # | Transport | How | Env override |
|---|---|---|---|
| 1 | Serial | ESP32-S3 **USB-Serial-JTAG port** (the DevKit's UART-labeled USB, 115200) — NOT the native-USB port carrying micro-ROS. Auto-detects Espressif / CP210x / CH340 adapters. | — |
| 2 | LAN | TCP client to the Pi companion bridge streaming the same `DF:` lines. | `DESKFLOW_PI_HOST` (default `deskflow-pi.local`), `DESKFLOW_PI_PORT` (default `9009`) |
| 3 | Sim | No edge found. The console says `LINK SIM` explicitly — alerts still latch locally. | — |

### 7.2 `DF:` line protocol (shared by serial + LAN)
```
DF q=0.42,-0.61,1.05,0.00 seal=1 estop=0 ima=1100 pkpa=9.2   # telemetry @1 Hz
DF ping id=1 ok                                              # boot census (log only)
```
Pi companion bridge spec: accept one TCP client, forward each supervisor cycle
as one telemetry line, one line per `\n`. Any publisher (a 20-line Python
`socketserver` on the Pi tailing the ROS graph) satisfies the contract.

### 7.3 Desktop E-stop path (real, end-to-end)
1. Operator hits E-STOP → app writes `DF:ESTOP\n` to the open serial console.
2. Firmware (non-blocking `Serial0` parser in `loop()`) matches `ESTOP`,
   calls `ventAndFreeze("desktop")`: valve vents, pump cuts, latch sets,
   `/deskflow/estop=true` publishes to ROS.
3. In parallel the app POSTs `{source, at}` to `DESKFLOW_PI_ESTOP_URL`
   (default `http://<pi>:8080/estop`, best-effort) so the supervisor can park
   even if USB is unplugged.
4. The console reports per-leg delivery (`serial:sent, lan:http-200`) in the
   event log — a failed leg is shown, never silently swallowed.

### 7.4 bklit-ui adoption path (web charts)
`bklit-ui` upstream is an MIT-licensed **shadcn chart registry**, not a button
library — the `SpotlightCard`/`MagneticButton` in `web/components/bklit/` are
bespoke DeskFlow components and stay as-is. To adopt real registry charts
(telemetry history → `@bklit/line-chart`, invoice mix → `@bklit/bar-chart`):
```bash
cd web && npx shadcn@latest init -y -d   # only if no components.json yet
npx shadcn@latest add @bklit/line-chart @bklit/bar-chart
```
then render them in the dashboard telemetry panel. Re-run `npm run build`
afterwards — the registry pulls `recharts` and theme tokens.
