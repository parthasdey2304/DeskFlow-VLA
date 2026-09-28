# DeskFlow Android — v1.0.0-production Release Notes

Target: `arm64-v8a`, minSdk 29, targetSdk 34.

## Changelog
- Live overhead-feed status card (Firestore `telemetry` mirror).
- Manual joint jogging sliders (q0–q3) with haptic ticks, ±2.6 rad clamp.
- Real-time invoice ledger with APPROVED / FLAGGED_DISCREPANCY chips.
- Prominent 56 dp emergency-stop bar (long-press haptic, latches UI red).

## Signed APK
```bash
cd android
./gradlew assembleRelease
jarsigner -verify -verbose app/build/outputs/apk/release/app-release.apk
apksigner verify --print-certs app/build/outputs/apk/release/app-release.apk
sha256sum app/build/outputs/apk/release/app-release.apk
```

| Artifact | SHA256 |
|---|---|
| `app-release.apk` (ci build) | _fill in after `assembleRelease` — do not ship without checksum_ |

## Rollout
1. Internal track → 2. Closed office pilot → 3. Production.
2. E-stop must be physically tested against `/deskflow/estop` before each rollout.
