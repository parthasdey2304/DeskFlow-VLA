# DeskFlow-VLA Desktop — v1.0.0 Release Notes

Office workstation console: real edge-link manager (serial auto-detect +
LAN TCP + honest sim degrade), live `DF:` telemetry, event log, and an
end-to-end E-stop path (console → ESP32 vent + `/deskflow/estop`).

## Artifacts (Windows x64, Electron 33.4.11)

| File | Size | SHA256 |
|---|---|---|
| `DeskFlow-VLA-1.0.0 Setup.exe` | 113,333,760 B | `FFED01B4696EE9F3C99039AE5204AC733876D48840077FD4413FDABD83121056` |
| `deskflow_desktop-1.0.0-full.nupkg` | 112,627,716 B | `D305A1DA5BEBA0BE2458144092EB8A14A458C02D6123A5D2294922B285F957A9` |
| `RELEASES` | 87 B | `7353884EAC46E06E7EAFB4132ABDA490398E58CD5237B253E537ED2DBD7E0E82` |
| `DeskFlow-VLA-1.0.0-win32-x64-portable.zip` | 115,962,050 B | `3898DD74E99DD35B0B95FD6836889A29C748D114EA1D99A7E09C7E722CD4EAF9` |

Verify: `Get-FileHash <file> -Algorithm SHA256` must match the table.

## Install

- **Installer (recommended):** run `DeskFlow-VLA-1.0.0 Setup.exe` (per-user,
  Squirrel). First launch may trigger Windows SmartScreen — the binary is
  **not EV code-signed** (see below); choose *More info → Run anyway* after
  verifying the SHA256.
- **Portable:** unzip `DeskFlow-VLA-1.0.0-win32-x64-portable.zip` and run
  `DeskFlow-VLA-win32-x64/deskflow.exe --no-sandbox`. No install, no registry.

## First run

1. Plug the ESP32-S3 **USB-Serial-JTAG port** (UART-labeled USB) — the console
   should flip from `LINK SIM` to `LINK SERIAL`.
2. `LINK SIM` with hardware attached → Rescan edge link → check Device Manager
   for Espressif / CP210x / CH340 ports.
3. The app needs no keys: telemetry is read-only; E-stop delivers over serial
   (`DF:ESTOP`) plus best-effort POST to `DESKFLOW_PI_ESTOP_URL`.

## What changed in v1.0.0

- Real link manager replaces the simulated console: serial + LAN + sim degrade.
- Live telemetry panel + event log + link pill + per-leg E-stop delivery receipts.
- N-API natives (serialport) ship unpacked from asar — serial works installed.

## Build provenance (reproducible)

Built 2026-09-28 on win32-x64, Node 26, `electron-forge make` pipeline replaced
by `desktop/build-win.js` + `desktop/squirrel-only.js` (checked in) because the
stock Forge runner silently exited after packaging in this environment
(root causes found while building: missing `electron.exe` download, corrupt
`@electron/get` cache entry, missing nuspec `authors`/`description`).
Smoke test: `deskflow.exe` launched, alive 12 s with window + tray, no crash.

## Known limitations

- **Unsigned installer:** no Windows code-signing certificate yet — expect
  SmartScreen on first run. Always verify SHA256 before running.
- Windows x64 only in this release (`darwin`/`linux` makers configured in
  `forge.config.js` — build on those hosts for those artifacts).
