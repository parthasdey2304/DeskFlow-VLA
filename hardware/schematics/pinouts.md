# DeskFlow-VLA Pin Multiplexing Matrix — ESP32-S3 DevKit + Raspberry Pi 5

| Signal | ESP32-S3 Pin | Mode | Peer / Part | Rail | Fail-safe |
|---|---|---|---|---|---|
| micro-ROS RX | GPIO 18 | UART0 RX, 921600-8N1 | Pi 5 USB-UART TX (CP2102) | 3.3 V logic | Agent timeout → vent + freeze |
| micro-ROS TX | GPIO 19 | UART0 TX, 921600-8N1 | Pi 5 USB-UART RX | 3.3 V logic | Same as above |
| Servo bus | GPIO 17 | Half-duplex UART 1 Mbaud via 74HC126 | 4× Feetech STS3215 (daisy chain) | 12 V servo rail, 6 A peak | Torque freeze on E-stop |
| Vacuum pump | GPIO 4 | Digital OUT → relay module | 12 V diaphragm pump, 2.5 A | 12 V high-current (orange) | OFF on boot & E-stop |
| Vent valve | GPIO 5 | Digital OUT → N-MOSFET (IRLZ44N + flyback) | 3-way solenoid dump valve | 12 V switched | VENTED (HIGH) on boot & E-stop |
| Pressure sense | GPIO 6 | ADC1 analog in | MPX5010DP differential, 0–10 kPa | 3.3 V sensor (blue) | Seal=false when uncertain |
| Current sense | GPIO 7 | ADC1 analog in | 5 mΩ shunt + INA181×50 | 5 V logic (red) | Trip > 2800 mA ×3 samples |
| Status LED | GPIO 21 | Digital OUT | Panel LED | 3.3 V | Blink on E-stop |
| Debug console | USB-Serial-JTAG (UART0) | CDC-ACM 115200 | Desktop Electron diagnostics | 5 V USB | `DF:` lines out, `DF:ESTOP` in (never micro-ROS) |
| GND | GND ×3 | — | Common star ground | GND (black) | — |

## Power rails
- **12 V high-current (orange):** 12 V/10 A brick → pump, valve, servos. Fused 7.5 A.
- **5 V logic (red):** Buck 12→5 V/5 A → Pi 5 (via PD hat), relay coils.
- **3.3 V sensor (blue):** ESP32-S3 LDO + RC filter → MPX5010DP Vs, UART buffer.
- **GND (black):** Star ground at PSU terminal; analog GND separated via ferrite.

## Notes
- Servo bus is half-duplex: TX-enable tied to buffer DIR, idle pull-up 10 kΩ.
- MPX5010DP ports: P1 → suction cup, P2 → ambient. Seal threshold 8 kPa.
- Keep analog traces away from pump relay; twist pump leads.
