/**
 * DeskFlow-VLA — FreeRTOS + Micro-ROS firmware for ESP32-S3 DevKit
 *
 * 100 Hz deterministic motion loop | 4x Feetech STS3215 (half-duplex UART)
 * Tactile stall-current reflex (2800 mA) | MPX5010DP vacuum seal sensing
 * Pneumatics: 12 V diaphragm pump (GPIO4) + 3-way vent valve (GPIO5)
 *
 * Build: PlatformIO (see platformio.ini). Deploy via `pio run -t upload`.
 */

#include <Arduino.h>
#include <micro_ros_platformio.h>
#include <rcl/rcl.h>
#include <rclc/rclc.h>
#include <rclc/executor.h>
#include <std_msgs/msg/bool.h>
#include <std_msgs/msg/float32_multi_array.h>
#include <std_msgs/msg/string.h>
#include <sensor_msgs/msg/joint_state.h>

// ---------- Pin map (see hardware/schematics/pinouts.md) ----------
static constexpr int PIN_SERVO_UART_TX   = 17;  // half-duplex bus via 74HC126 buffer
static constexpr int PIN_ROS_RX          = 18;  // from Pi5 USB-UART TX
static constexpr int PIN_ROS_TX          = 19;  // to   Pi5 USB-UART RX
static constexpr int PIN_PUMP            = 4;   // 12 V diaphragm pump relay (active HIGH)
static constexpr int PIN_VENT_VALVE      = 5;   // 3-way dump valve MOSFET (active HIGH = vent)
static constexpr int PIN_PRESSURE_ADC    = 6;   // MPX5010DP analog out
static constexpr int PIN_CURRENT_SENSE   = 7;   // shunt amplifier analog out
static constexpr int PIN_STATUS_LED      = 21;

// ---------- Safety constants ----------
static constexpr float LOOP_HZ              = 100.0f;
static constexpr float LOOP_DT_MS           = 1000.0f / LOOP_HZ;
static constexpr float STALL_CURRENT_MA     = 2800.0f;
static constexpr float STALL_TRIP_SAMPLES   = 3;      // consecutive over-current reads
static constexpr float SEAL_PRESSURE_KPA    = 8.0f;   // min differential for paper seal
static constexpr float ADC_REF_V            = 3.3f;
static constexpr int   ADC_BITS             = 12;
// Shunt chain: 5 mΩ shunt × INA181 50 V/V → mA = Vadc / (0.005 * 50) * 1000
static constexpr float SHUNT_OHM            = 0.005f;
static constexpr float SHUNT_GAIN           = 50.0f;

// Joint envelopes (rad / rad/s) mirrored in backend-edge/cbf_safety.py
static constexpr float Q_MIN[4] = {-2.62f, -1.57f, -2.09f, -2.62f};
static constexpr float Q_MAX[4] = { 2.62f,  1.57f,  2.09f,  2.62f};
static constexpr float V_MAX    = 3.0f;

// ---------- Micro-ROS handles ----------
rcl_node_t g_node;
rclc_support_t g_support;
rcl_allocator_t g_alloc;
rclc_executor_t g_executor;
rcl_subscription_t g_traj_sub;   // /deskflow/trajectory (Float32MultiArray, 4*N)
rcl_publisher_t g_estop_pub;     // /deskflow/estop (Bool)
rcl_publisher_t g_seal_pub;      // /deskflow/seal_engaged (Bool)
rcl_publisher_t g_state_pub;     // /deskflow/joint_state (JointState)
std_msgs__msg__float32_multi_array g_traj_msg;
std_msgs__msg__bool g_estop_msg, g_seal_msg;
sensor_msgs__msg__joint_state g_js_msg;

volatile bool g_estop_latched = false;
volatile uint8_t g_overcurrent_hits = 0;
float g_q_cmd[4] = {0, 0, 0, 0};
float g_q_act[4] = {0, 0, 0, 0};
portMUX_TYPE g_mux = portMUX_INITIALIZER_UNLOCKED;

// ---------- Sensor conditioning ----------
// 4x ADC oversampling kills single-sample spikes; the stall trip still acts on
// RAW readings x3 (never let a filter mask a real stall), while telemetry and
// the DF console use the EMA-smoothed value (alpha 0.25).
static constexpr int ADC_OVERSAMPLE = 4;
static constexpr float IMA_EMA_ALPHA = 0.25f;
static float g_ima_ema = 0.0f;
static bool g_ima_ema_init = false;

static int analogAvg(int pin) {
  long acc = 0;
  for (int i = 0; i < ADC_OVERSAMPLE; i++) acc += analogRead(pin);
  return (int)(acc / ADC_OVERSAMPLE);
}

// Vacuum tare: averaged at boot so ambient weather never corrupts the seal
// threshold. Seal logic stays differential (reading - tare >= 8 kPa).
static float g_press_tare_kpa = 0.0f;

// MPX5010DP: Vout = Vs*(0.09*P_kPa + 0.04), Vs=3.3 -> P = ((V/Vs)-0.04)/0.09
static float readVacuumRawKPa() {
  int raw = analogAvg(PIN_PRESSURE_ADC);
  float v = (raw / 4095.0f) * ADC_REF_V;
  return ((v / ADC_REF_V) - 0.04f) / 0.09f;
}

static float readVacuumKPa() { return readVacuumRawKPa() - g_press_tare_kpa; }

static float readMotorCurrentMA() {
  int raw = analogAvg(PIN_CURRENT_SENSE);
  float v = (raw / 4095.0f) * ADC_REF_V;
  return (v / (SHUNT_OHM * SHUNT_GAIN)) * 1000.0f;
}

// Stall-current reflex + seal publish live in taskMotion below; the trip acts
// on oversampled RAW current (x3 consecutive), telemetry uses g_ima_ema.

void ventAndFreeze(const char *reason) {
  portENTER_CRITICAL(&g_mux);
  g_estop_latched = true;
  portEXIT_CRITICAL(&g_mux);
  digitalWrite(PIN_VENT_VALVE, HIGH);   // vent vacuum instantly
  digitalWrite(PIN_PUMP, LOW);          // pump off
  // Park: hold last safe command; servo bus torque-off would drop paper,
  // so we freeze setpoints instead.
  g_estop_msg.data = true;
  rcl_publish(&g_estop_pub, &g_estop_msg, nullptr);
  (void)reason;
}

volatile unsigned long g_last_traj_ms = 0;  // watchdog: micro-ROS link freshness

void trajCallback(const void *msgin) {
  if (g_estop_latched) return;  // require explicit reset from supervisor
  const auto *m = (const std_msgs__msg__float32_multi_array *)msgin;
  if (m->data.size < 4) return;
  // Take the latest waypoint quartet; envelope-clamp defensively here too.
  size_t n = m->data.size / 4;
  size_t base = (n - 1) * 4;
  portENTER_CRITICAL(&g_mux);
  for (int i = 0; i < 4; i++) {
    float q = m->data.data[base + i];
    g_q_cmd[i] = constrain(q, Q_MIN[i], Q_MAX[i]);
  }
  portEXIT_CRITICAL(&g_mux);
  g_last_traj_ms = millis();
}

// ---------- Feetech STS3215 bus driver (SMS/STS protocol, single-wire half-duplex) ----------
// Wire format: FF FF ID LEN INSTR PARAMS... CHK, with CHK = ~(ID+LEN+INSTR+PARAMS) & 0xFF.
// Register map (STS3215 memory table): TORQUE_ENABLE=40, GOAL_POSITION=42 (2B),
// GOAL_SPEED=46 (2B), PRESENT_POSITION=56 (2B). 4096 steps/rev, default 1 Mbaud,
// factory ID=1 (assign 1-at-a-time before chaining), broadcast ID=0xFE.
// Single-wire note: TX echoes into RX (74HC126 DIR tied in hardware per
// schematics/pinouts.md), so every transaction drains its own echo first.
static constexpr uint8_t STS_BROADCAST   = 0xFE;
static constexpr uint8_t STS_PING        = 0x01;
static constexpr uint8_t STS_READ        = 0x02;
static constexpr uint8_t STS_WRITE       = 0x03;
static constexpr uint8_t STS_SYNC_WRITE  = 0x83;
static constexpr uint8_t STS_TORQUE_EN   = 40;
static constexpr uint8_t STS_GOAL_POS    = 42;
static constexpr uint8_t STS_GOAL_SPEED  = 46;
static constexpr uint8_t STS_PRESENT_POS = 56;
static constexpr uint32_t SERVO_BAUD     = 1000000;
static constexpr int SERVO_IDS[4] = {1, 2, 3, 4};
static constexpr int SERVO_CENTER = 2048;  // counts mapped to 0 rad -> range approx [-pi, +pi]
static constexpr float STEPS_PER_RAD = 4096.0f / 6.28318530718f;
static constexpr uint16_t SERVO_CRUISE_STEPS = 1500;  // ~2.3 rad/s, under V_MAX = 3.0
static constexpr int SERVO_SIGN[4] = {1, 1, 1, 1};    // flip per joint at bring-up if mirrored

static uint8_t stsChecksum(uint8_t id, uint8_t len, uint8_t instr, const uint8_t *params, size_t n) {
  uint16_t s = (uint16_t)id + len + instr;
  for (size_t i = 0; i < n; i++) s += params[i];
  return (uint8_t)(~s & 0xFF);
}

// Broadcast write: no reply expected, drain exactly n echo bytes.
static void busSendNoReply(const uint8_t *pkt, size_t n) {
  while (Serial1.available()) (void)Serial1.read();  // clear stale bytes
  Serial1.write(pkt, n);
  Serial1.flush();
  delayMicroseconds(400);  // bus turnaround
  size_t dropped = 0;
  unsigned long t0 = micros();
  while (dropped < n && (micros() - t0) < 4000) {
    while (Serial1.available() && dropped < n) { (void)Serial1.read(); dropped++; }
  }
}

static int radToCounts(float q, int j) {
  float r = (float)SERVO_CENTER + SERVO_SIGN[j] * q * STEPS_PER_RAD;
  if (r < 0) r = 0;
  if (r > 4095) r = 4095;
  return (int)(r + 0.5f);
}

static float countsToRad(int c, int j) {
  return SERVO_SIGN[j] * ((float)c - (float)SERVO_CENTER) / STEPS_PER_RAD;
}

// SYNC_WRITE goal positions for all 4 joints in ONE broadcast packet (~20 B,
// ~0.2 ms at 1 Mbaud — comfortably inside the 10 ms control slot).
void servoBusWrite(const float q[4]) {
  uint8_t params[2 + 4 * 3];
  params[0] = STS_GOAL_POS;
  params[1] = 2;  // bytes per servo
  for (int i = 0; i < 4; i++) {
    int c = radToCounts(q[i], i);
    params[2 + i * 3] = (uint8_t)SERVO_IDS[i];
    params[3 + i * 3] = (uint8_t)(c & 0xFF);
    params[4 + i * 3] = (uint8_t)((c >> 8) & 0xFF);
  }
  const uint8_t n = sizeof(params);  // 14
  const uint8_t len = n + 2;         // INSTR + CHK
  uint8_t pkt[5 + sizeof(params) + 1];
  pkt[0] = 0xFF; pkt[1] = 0xFF; pkt[2] = STS_BROADCAST; pkt[3] = len; pkt[4] = STS_SYNC_WRITE;
  memcpy(&pkt[5], params, n);
  pkt[5 + n] = stsChecksum(STS_BROADCAST, len, STS_SYNC_WRITE, params, n);
  busSendNoReply(pkt, sizeof(pkt));
}

// Broadcast WRITE_DATA of 1 or 2 bytes (torque enable, cruise speed).
static void servoBroadcastWrite(uint8_t addr, uint16_t val, uint8_t nbytes) {
  uint8_t params[3] = {addr, (uint8_t)(val & 0xFF), (uint8_t)((val >> 8) & 0xFF)};
  uint8_t n = (uint8_t)(1 + nbytes);
  uint8_t len = (uint8_t)(n + 2);
  uint8_t pkt[9];
  pkt[0] = 0xFF; pkt[1] = 0xFF; pkt[2] = STS_BROADCAST; pkt[3] = len; pkt[4] = STS_WRITE;
  memcpy(&pkt[5], params, n);
  pkt[5 + n] = stsChecksum(STS_BROADCAST, len, STS_WRITE, params, n);
  busSendNoReply(pkt, (size_t)(5 + n + 1));
}

// PING one servo; true on well-formed status reply (used for the boot census).
static bool servoPing(uint8_t id) {
  uint8_t req[6] = {0xFF, 0xFF, id, 2, STS_PING, 0};
  req[5] = stsChecksum(id, 2, STS_PING, nullptr, 0);
  while (Serial1.available()) (void)Serial1.read();
  Serial1.write(req, sizeof(req));
  Serial1.flush();
  delayMicroseconds(400);
  size_t dropped = 0;
  unsigned long t0 = micros();
  while (dropped < sizeof(req) && (micros() - t0) < 2000) {
    while (Serial1.available() && dropped < sizeof(req)) { (void)Serial1.read(); dropped++; }
  }
  // Status reply: FF FF ID 02 ERR CHK (6 bytes, ERR must be 0).
  uint8_t rsp[6]; size_t got = 0;
  t0 = micros();
  while (got < sizeof(rsp) && (micros() - t0) < 5000) {
    while (Serial1.available() && got < sizeof(rsp)) rsp[got++] = (uint8_t)Serial1.read();
  }
  if (got != sizeof(rsp)) return false;
  if (rsp[0] != 0xFF || rsp[1] != 0xFF || rsp[2] != id || rsp[3] != 2 || rsp[4] != 0) return false;
  return stsChecksum(rsp[2], rsp[3], rsp[4], nullptr, 0) == rsp[5];
}

// READ_DATA present position of one servo. False on timeout/bad checksum —
// callers keep the last known actual (fail-silent; the E-stop path is independent).
static bool servoReadPos(uint8_t id, int *counts) {
  uint8_t req[8] = {0xFF, 0xFF, id, 4, STS_READ, STS_PRESENT_POS, 2, 0};
  const uint8_t rp[2] = {STS_PRESENT_POS, 2};
  req[7] = stsChecksum(id, 4, STS_READ, rp, 2);
  while (Serial1.available()) (void)Serial1.read();
  Serial1.write(req, sizeof(req));
  Serial1.flush();
  delayMicroseconds(400);
  size_t dropped = 0;
  unsigned long t0 = micros();
  while (dropped < sizeof(req) && (micros() - t0) < 2000) {
    while (Serial1.available() && dropped < sizeof(req)) { (void)Serial1.read(); dropped++; }
  }
  // Status reply: FF FF ID LEN ERR LO HI CHK (8 bytes, LEN==4, ERR==0).
  uint8_t rsp[8]; size_t got = 0;
  t0 = micros();
  while (got < sizeof(rsp) && (micros() - t0) < 4000) {
    while (Serial1.available() && got < sizeof(rsp)) rsp[got++] = (uint8_t)Serial1.read();
  }
  if (got != sizeof(rsp)) return false;
  if (rsp[0] != 0xFF || rsp[1] != 0xFF || rsp[2] != id || rsp[3] != 4 || rsp[4] != 0) return false;
  if (stsChecksum(rsp[2], rsp[3], rsp[4], &rsp[5], 2) != rsp[7]) return false;
  *counts = (int)rsp[5] | ((int)rsp[6] << 8);
  return true;
}

// Round-robin actuals: one servo per call, so each joint refreshes at ~25 Hz
// while the 100 Hz write cadence is never disturbed by a slow reply.
void servoBusRead(float q[4]) {
  static uint8_t slot = 0;
  int c = 0;
  if (servoReadPos((uint8_t)SERVO_IDS[slot], &c)) {
    q[slot] = countsToRad(c, slot);
  }
  slot = (uint8_t)((slot + 1) % 4);
}

// Servo soft-start: per-cycle slew limit (rad) so setpoint jumps become ramps.
// 0.03 rad @100 Hz = 3 rad/s max slew, consistent with V_MAX. Also guarantees
// no jump when E-stop clears (output resumes from the last SENT position).
static constexpr float SERVO_SLEW = 0.03f;
static float g_q_sent[4] = {0, 0, 0, 0};

static void statusLedTick() {
  // Solid = healthy, 2-blink = stale micro-ROS link (>5 s, check the agent),
  // 3-blink = E-stop latched.
  unsigned long t = millis();
  if (g_estop_latched) {
    uint8_t slot = (t / 200) % 8;
    digitalWrite(PIN_STATUS_LED, (slot == 0 || slot == 2 || slot == 4) ? HIGH : LOW);
  } else if (t - g_last_traj_ms > 5000) {
    uint8_t slot = (t / 250) % 8;
    digitalWrite(PIN_STATUS_LED, (slot == 0 || slot == 2) ? HIGH : LOW);
  } else {
    digitalWrite(PIN_STATUS_LED, HIGH);
  }
}

// ---------- FreeRTOS tasks ----------
void taskMotion(void *arg) {
  (void)arg;
  TickType_t last = xTaskGetTickCount();
  const TickType_t period = pdMS_TO_TICKS((int)LOOP_DT_MS);
  while (true) {
    // 1. Stall-current reflex — highest priority, hardware-level, RAW x3.
    float ima = readMotorCurrentMA();
    if (!g_ima_ema_init) { g_ima_ema = ima; g_ima_ema_init = true; }
    g_ima_ema += IMA_EMA_ALPHA * (ima - g_ima_ema);  // telemetry only
    if (ima > STALL_CURRENT_MA) {
      if (++g_overcurrent_hits >= STALL_TRIP_SAMPLES && !g_estop_latched) {
        ventAndFreeze("stall-current");
      }
    } else {
      g_overcurrent_hits = 0;
    }

    // 2. Seal sensing publish (10 Hz decimated inside 100 Hz loop).
    static uint8_t div = 0;
    if (++div >= 10) {
      div = 0;
      float pkpa = readVacuumKPa();
      g_seal_msg.data = (!g_estop_latched) && (pkpa >= SEAL_PRESSURE_KPA);
      rcl_publish(&g_seal_pub, &g_seal_msg, nullptr);
    }

    // 3. Motion output (frozen when e-stopped, slew-limited always).
    if (!g_estop_latched) {
      float q[4];
      portENTER_CRITICAL(&g_mux);
      memcpy(q, (const void *)g_q_cmd, sizeof(q));
      portEXIT_CRITICAL(&g_mux);
      for (int i = 0; i < 4; i++) {
        float d = q[i] - g_q_sent[i];
        if (d > SERVO_SLEW) d = SERVO_SLEW;
        else if (d < -SERVO_SLEW) d = -SERVO_SLEW;
        g_q_sent[i] += d;
      }
      servoBusWrite(g_q_sent);
    }
    servoBusRead(g_q_act);

    statusLedTick();
    vTaskDelayUntil(&last, period);
  }
}

void setup() {
  pinMode(PIN_PUMP, OUTPUT);
  pinMode(PIN_VENT_VALVE, OUTPUT);
  pinMode(PIN_STATUS_LED, OUTPUT);
  digitalWrite(PIN_PUMP, LOW);
  digitalWrite(PIN_VENT_VALVE, HIGH);  // safe: vented at boot
  analogReadResolution(ADC_BITS);
  analogSetAttenuation(ADC_11db);

  Serial1.begin(SERVO_BAUD, SERIAL_8N1, PIN_SERVO_UART_TX, PIN_SERVO_UART_TX);  // servo bus, single-wire HD on GPIO17
  Serial0.begin(115200);   // USB-Serial-JTAG debug console: `DF:` diag lines for the desktop app
  delay(100);
  // Pressure tare: average 16 ambient reads (pump OFF, vented at boot) so the
  // seal threshold stays differential against weather, not absolute.
  float tare = 0;
  for (int i = 0; i < 16; i++) { tare += readVacuumRawKPa(); delay(10); }
  g_press_tare_kpa = tare / 16.0f;
  Serial0.printf("DF tare pkpa=%.2f\n", g_press_tare_kpa);
  // Bus census + safe defaults. Missing IDs are reported, never fatal here —
  // motion simply holds until the chain is complete (CBF gates the plan anyway).
  for (int i = 0; i < 4; i++) {
    bool ok = servoPing((uint8_t)SERVO_IDS[i]);
    Serial0.printf("DF ping id=%d %s\n", SERVO_IDS[i], ok ? "ok" : "MISSING");
  }
  servoBroadcastWrite(STS_TORQUE_EN, 1, 1);                    // torque on: hold position
  servoBroadcastWrite(STS_GOAL_SPEED, SERVO_CRUISE_STEPS, 2);  // cruise under V_MAX
  // Pi link rides USB-CDC micro-ROS (see set_microros_serial_transports below);
  // GPIO 18/19 stay reserved for a hard-UART fallback.
  set_microros_serial_transports(Serial);  // micro-ROS agent over USB-CDC @921600
  Serial.begin(921600);
  delay(500);

  g_alloc = rcl_get_default_allocator();
  rclc_support_init(&g_support, 0, nullptr, &g_alloc);
  rclc_node_init_default(&g_node, "deskflow_esp32", "", &g_support);
  rclc_subscription_init_default(&g_traj_sub, &g_node,
    ROSIDL_GET_MSG_TYPE_SUPPORT(std_msgs, msg, Float32MultiArray), "/deskflow/trajectory");
  rclc_publisher_init_default(&g_estop_pub, &g_node,
    ROSIDL_GET_MSG_TYPE_SUPPORT(std_msgs, msg, Bool), "/deskflow/estop");
  rclc_publisher_init_default(&g_seal_pub, &g_node,
    ROSIDL_GET_MSG_TYPE_SUPPORT(std_msgs, msg, Bool), "/deskflow/seal_engaged");
  rclc_publisher_init_default(&g_state_pub, &g_node,
    ROSIDL_GET_MSG_TYPE_SUPPORT(sensor_msgs, msg, JointState), "/deskflow/joint_state");
  rclc_executor_init(&g_executor, &g_support.context, 1, &g_alloc);
  rclc_executor_add_subscription(&g_executor, &g_traj_sub, &g_traj_msg, &trajCallback, ON_NEW_DATA);

  xTaskCreatePinnedToCore(taskMotion, "motion100Hz", 4096, nullptr, 5, nullptr, 1);
}

void loop() {
  rclc_executor_spin_some(&g_executor, RCL_MS_TO_NS(10));
  // Desktop E-stop command over the USB-Serial-JTAG console (non-blocking;
  // the Electron app sends `DF:ESTOP` here — never on USB-CDC/micro-ROS).
  static char dbgCmd[24]; static uint8_t dbgLen = 0;
  while (Serial0.available()) {
    char c = (char)Serial0.read();
    if (c == '\n' || c == '\r') {
      dbgCmd[dbgLen] = '\0';
      if (strstr(dbgCmd, "ESTOP") != nullptr && !g_estop_latched) ventAndFreeze("desktop");
      dbgLen = 0;
    } else if (dbgLen < (uint8_t)(sizeof(dbgCmd) - 1)) {
      dbgCmd[dbgLen++] = c;
    } else {
      dbgLen = 0;  // overlong line: drop, never block
    }
  }
  // 1 Hz human-readable diagnostics for the Electron console (Serial0 ONLY —
  // never print here on Serial, which carries micro-ROS framing).
  static unsigned long lastDbg = 0;
  if (millis() - lastDbg >= 1000) {
    lastDbg = millis();
    Serial0.printf("DF q=%.2f,%.2f,%.2f,%.2f seal=%d estop=%d ima=%.0f pkpa=%.1f\n",
      g_q_act[0], g_q_act[1], g_q_act[2], g_q_act[3],
      g_seal_msg.data ? 1 : 0, g_estop_latched ? 1 : 0,
      g_ima_ema, readVacuumKPa());
  }
  delay(5);
}
