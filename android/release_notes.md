# DeskFlow Android — v1.0.0-production Release Notes

Target: `arm64-v8a`, minSdk 29, targetSdk 34, Material 3 edge monitor
(live feed status, joint jog + haptics, Firestore ledger, 56 dp E-stop bar).

## Artifact (signed release)

| File | Size | SHA256 |
|---|---|---|
| `app-release.apk` | 2,391,582 B | `FABA85252D85059AB47BEBDFACE18E175159B1F69AA68D0A28CF87F5F299C15D` |

Verify: `sha256sum app-release.apk` (or `Get-FileHash -Algorithm SHA256`) must
match. Then confirm the signer before installing on any office device:

```bash
apksigner verify --print-certs app-release.apk
# Signer #1 certificate DN: CN=DeskFlow-VLA, OU=Edge Robotics, O=DeskFlow, ...
# Signer #1 certificate SHA-256 digest: f438ceafd488a599fbdd083d246452498f6532b8c51774932a8a53af4da77f7c
# Signer #1 certificate SHA-1 digest:   f3c7d2e2dcbd5ae59577aea067850101011d2889
```

Keystore: `~/.keystores/deskflow-release.jks` (alias `deskflow`, RSA-2048,
self-signed, 25 yr) — **kept outside the repo, never committed.** Store its
password in the team vault; every future release build must reuse this exact
keystore or Android will refuse the update.

## Changelog (v1.0.0-production)

- Live overhead-feed status card (Firestore `telemetry` mirror).
- Manual joint jogging sliders (q0–q3) with haptic ticks, ±2.6 rad clamp.
- Real-time invoice ledger with APPROVED / FLAGGED_DISCREPANCY chips.
- Prominent 56 dp emergency-stop bar (long-press haptic, latches UI red).
- Build fixes in this release: `settings.gradle.kts` + module split added,
  `AndroidManifest.xml` + resources + adaptive icon added, Compose compiler
  plugin applied, `dp` unit literals corrected, R8 keep rules added.

## Build provenance (reproducible)

Built 2026-09-28: Gradle 8.7 + Temurin JDK 17 + SDK platform/android-34,
build-tools 35.0.0, `assembleRelease` (45 tasks, R8 full-mode minify),
signed with `apksigner` (v2+v3 scheme via v1+v2 default), verified with
`--print-certs`. Unsigned intermediate (`app-release-unsigned.apk`) is a
build byproduct — install ONLY the signed `app-release.apk` above.

## Install & rollout

1. `adb install app-release.apk` (or MDM push) → verify cert digests first.
2. Internal track → closed office pilot → production.
3. E-stop must be physically tested against `/deskflow/estop` before each rollout.
4. Firestore reads need network + the `invoices`/`telemetry` collections per
   `firestore.rules`; without backend the app runs on its local snapshot.
