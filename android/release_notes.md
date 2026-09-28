# DeskFlow Android — Release Notes

Target: `arm64-v8a`, minSdk 29, targetSdk 34, Material 3 edge monitor
(live feed status, joint jog + haptics, Firestore ledger, 56 dp E-stop bar).

## v1.0.1-production (latest, versionCode 2)

### Artifact (signed release)

| File | Size | SHA256 |
|---|---|---|
| `app-release.apk` | 3,194,671 B | `FB3DB30F3BB625A9B880728A6A066C9609E20EFAF6D801976E64DEE9A7539BE` |

Verify checksum, then confirm the signer before installing (same key as
v1.0.0 — updates install cleanly over it):

```bash
apksigner verify --print-certs app-release.apk
# Signer #1 certificate DN: CN=DeskFlow-VLA, OU=Edge Robotics, O=DeskFlow, ...
# Signer #1 certificate SHA-256 digest: f438ceafd488a599fbdd083d246452498f6532b8c51774932a8a53af4da77f7c
```

### What changed in v1.0.1-production

- Real Firestore `invoices` fetch (top 25, newest first) with local-snapshot
  fallback and a live/offline indicator chip.
- Pull-to-refresh on the ledger (`PullToRefreshBox`).
- Edge-to-edge display (`enableEdgeToEdge`, inset-aware Scaffold).
- Compose compiler plugin applied (fixes release-build IR codegen), `dp`
  unit literals corrected, core material icon for the E-stop bar.
- `AndroidManifest.xml`, resources, adaptive launcher icon, R8 keep rules,
  Gradle module split (`settings.gradle.kts` + `app/` module).

### Build provenance

Gradle 8.7 + Temurin JDK 17 + SDK platform/android-34, build-tools 35.0.0,
`assembleRelease` (R8 full-mode minify), signed with the release keystore
(`~/.keystores/deskflow-release.jks`, alias `deskflow` — kept outside the
repo, never committed), verified with `--print-certs`.

## v1.0.0-production (versionCode 1)

| File | Size | SHA256 |
|---|---|---|
| `app-release.apk` | 2,391,582 B | `FABA85252D85059AB47BEBDFACE18E175159B1F69AA68D0A28CF87F5F299C15D` |

Same signer certificate as v1.0.1 (digests above). Initial release: feed
status card, joint jog sliders ±2.6 rad, hardcoded ledger, E-stop bar.

## Install & rollout (all versions)

1. `adb install app-release.apk` (or MDM push) → verify cert digests first.
2. Internal track → closed office pilot → production.
3. E-stop must be physically tested against `/deskflow/estop` before each rollout.
4. Firestore reads need network + the `invoices`/`telemetry` collections per
   `firestore.rules`; without backend the app runs on its local snapshot.
   (Full sync needs `google-services.json` + the google-services plugin —
   see `docs/OPERATIONS.md`.)
