# DeskFlow-VLA Desktop — Release Notes

Office workstation console: real edge-link manager (serial auto-detect +
LAN TCP + honest sim degrade), live `DF:` telemetry, event log, and an
end-to-end E-stop path (console → ESP32 vent + `/deskflow/estop`).

## v1.0.1 (latest)

### Artifacts (Windows x64, Electron 33.4.11)

| File | Size | SHA256 |
|---|---|---|
| `DeskFlow-VLA-1.0.1 Setup.exe` | 113,333,760 B | `C34CEAD6C208547C001D8B2358B909EFF723FA1676A6243565718B86A673BF62` |
| `deskflow_desktop-1.0.1-full.nupkg` | 112,627,728 B | `8B4844F58592D5E4884C7E804FEE99FB5724FDA3DFF8235D3A5A714590BEF761` |
| `DeskFlow-VLA-1.0.1-win32-x64-portable.zip` | 115,962,060 B | `62EE8C0B5A7690A6F5DBEE695CBFEE2918E12DA474B154CB503A77A56F4293B3` |

Verify: `Get-FileHash <file> -Algorithm SHA256` must match the table.

### What changed in v1.0.1

- Packaged installer metadata: author/description now flow into the Squirrel
  nuspec (previously blocked the installer build).
- Maker set pinned (`maker-squirrel` / `maker-zip` / `maker-deb`) plus
  auto-unpack-natives so serialport works in the installed app.
- Checked-in Windows build scripts (`build-win.js`, `squirrel-only.js`) with
  the documented manual-packaging fallback.
- Smoke test: `deskflow.exe` launched, alive 12 s with window + tray, no crash.

### Install

- **Installer (recommended):** run `DeskFlow-VLA-1.0.1 Setup.exe` (per-user,
  Squirrel). First launch may trigger Windows SmartScreen — the binary is
  **not EV code-signed**; choose *More info → Run anyway* after verifying SHA256.
- **Portable:** unzip the portable zip and run
  `DeskFlow-VLA-win32-x64/deskflow.exe --no-sandbox`.

## v1.0.0

| File | Size | SHA256 |
|---|---|---|
| `DeskFlow-VLA-1.0.0 Setup.exe` | 113,333,760 B | `FFED01B4696EE9F3C99039AE5204AC733876D48840077FD4413FDABD83121056` |
| `deskflow_desktop-1.0.0-full.nupkg` | 112,627,716 B | `D305A1DA5BEBA0BE2458144092EB8A14A458C02D6123A5D2294922B285F957A9` |
| `RELEASES` | 87 B | `7353884EAC46E06E7EAFB4132ABDA490398E58CD5237B253E537ED2DBD7E0E82` |
| `DeskFlow-VLA-1.0.0-win32-x64-portable.zip` | 115,962,050 B | `3898DD74E99DD35B0B95FD6836889A29C748D114EA1D99A7E09C7E722CD4EAF9` |

Initial release: real link manager, live telemetry panel, event log, link pill,
per-leg E-stop delivery receipts, N-API natives unpacked from asar.

## First run (all versions)

1. Plug the ESP32-S3 **USB-Serial-JTAG port** (UART-labeled USB) — the console
   should flip from `LINK SIM` to `LINK SERIAL`.
2. `LINK SIM` with hardware attached → Rescan edge link → check Device Manager
   for Espressif / CP210x / CH340 ports.
3. The app needs no keys: telemetry is read-only; E-stop delivers over serial
   (`DF:ESTOP`) plus best-effort POST to `DESKFLOW_PI_ESTOP_URL`.

## Known limitations

- **Unsigned installer:** no Windows code-signing certificate yet — expect
  SmartScreen on first run. Always verify SHA256 before running.
- Windows x64 only in these releases (`darwin`/`linux` makers configured in
  `forge.config.js` — build on those hosts for those artifacts).
