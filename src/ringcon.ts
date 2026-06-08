import { JoyCon } from "./joycon.js";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// MCU modes (from Yamakaky/joy joycon-sys/src/mcu/mod.rs)
const MCU_MODE_SUSPEND = 0;
const MCU_MODE_STANDBY = 1;
const MCU_MODE_MAYBE_RINGCON = 3;

// MCU sub-command IDs
const MCU_SUBCMD_SET_MCU_MODE = 0;
const MCU_SUBCMD_SET_IR_MODE = 1;

// MCUIRMode values
const IR_SENSOR_SLEEP = 1;

// IMU modes
const IMU_MODE_MAYBE_RINGCON = 3;

// Payload for subcmd 0x5C_6 — magic bytes captured from Yamakaky
const SUBCMD_0X5C_6_PAYLOAD = [
  6, 3, 37, 6, 0, 0, 0, 0, 236, 153, 172, 227, 28, 0, 0, 0, 105, 155, 22, 246,
  93, 86, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 144, 40, 161, 227, 28, 0,
];

// Payload for subcmd 0x5A
const SUBCMD_0X5A_PAYLOAD = [4, 1, 1, 2];

async function sendAndCheck(
  joycon: JoyCon,
  label: string,
  sendFn: () => void,
  checkFn: (report: Buffer) => boolean,
  maxRetries = 8
): Promise<Buffer> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    sendFn();
    for (let i = 0; i < 16; i++) {
      const report = joycon.read(100);
      if (!report) break;
      if (checkFn(report)) {
        console.log(`  [OK] ${label}`);
        return report;
      }
    }
    await sleep(64);
  }
  throw new Error(`Failed: ${label} (no valid response after ${maxRetries} attempts)`);
}

const isSubcmdReply = (r: Buffer, subcmd: number) =>
  r[0] === 0x21 && r.length > 14 && r[14] === subcmd;

export async function initRingCon(joycon: JoyCon): Promise<void> {
  console.log("Initializing Ring-Con...");

  // Reset MCU to Suspend state first — clears any leftover state from prior failed inits
  console.log("  [reset] MCU → Suspend");
  try {
    joycon.sendSubcommand(0x22, [MCU_MODE_SUSPEND]);
    await sleep(200);
    joycon.sendSubcommand(0x22, [MCU_MODE_SUSPEND]);
    await sleep(500);
  } catch {}

  // Step 1: Enable vibration
  await sendAndCheck(
    joycon,
    "Enable vibration",
    () => joycon.sendSubcommand(0x48, [0x01]),
    (r) => isSubcmdReply(r, 0x48)
  );

  // Step 2: Enable IMU
  await sendAndCheck(
    joycon,
    "Enable IMU",
    () => joycon.sendSubcommand(0x40, [0x01]),
    (r) => isSubcmdReply(r, 0x40)
  );

  // Step 3: Set input report mode to standard full (0x30)
  await sendAndCheck(
    joycon,
    "Set input report mode (0x30)",
    () => joycon.sendSubcommand(0x03, [0x30]),
    (r) => isSubcmdReply(r, 0x03)
  );

  // Step 4: Enable MCU → Standby
  await sendAndCheck(
    joycon,
    "Enable MCU (Standby)",
    () => joycon.sendSubcommand(0x22, [MCU_MODE_STANDBY]),
    (r) => isSubcmdReply(r, 0x22)
  );

  // MCU firmware needs time to come up (extra time for Bluetooth latency on Windows)
  await sleep(1500);

  // Step 5: Set MCU mode to MaybeRingcon. The MCU state byte shows up at
  // byte 22 of the subcommand reply; loop until the transition is observed.
  await sendAndCheck(
    joycon,
    "MCU SetMCUMode(MaybeRingcon)",
    () => joycon.sendMCUConfig(MCU_SUBCMD_SET_MCU_MODE, [MCU_MODE_MAYBE_RINGCON]),
    (r) => isSubcmdReply(r, 0x21) && r[22] === MCU_MODE_MAYBE_RINGCON,
    16
  );

  // Give MCU time to switch mode and detect Ring-Con on the rail
  await sleep(800);

  // Step 6: Configure MCU IR with IRSensorSleep mode
  // Payload: [ir_mode=1, no_of_frags=0, fw_major_lo, fw_major_hi, fw_minor_lo, fw_minor_hi]
  await sendAndCheck(
    joycon,
    "Configure MCU IR (IRSensorSleep)",
    () =>
      joycon.sendMCUConfig(MCU_SUBCMD_SET_IR_MODE, [
        IR_SENSOR_SLEEP,
        0, // no_of_frags
        0, 0, // fw_major
        0, 0, // fw_minor
      ]),
    (r) => isSubcmdReply(r, 0x21),
    16
  );

  // Wait for Ring-Con peripheral to be recognized after IR sleep config
  await sleep(1000);

  // Step 7: Get external device info (subcmd 0x59)
  // This asks the Ring-Con MCU to identify itself — needs Ring-Con on rail + MCU settled
  await sendAndCheck(
    joycon,
    "Get external device info (0x59)",
    () => joycon.sendSubcommand(0x59, []),
    (r) => isSubcmdReply(r, 0x59),
    32
  );

  // Step 8: Enable IMU in MaybeRingcon mode
  await sendAndCheck(
    joycon,
    "Enable IMU MaybeRingcon (sub 0x40 arg 3)",
    () => joycon.sendSubcommand(0x40, [IMU_MODE_MAYBE_RINGCON]),
    (r) => isSubcmdReply(r, 0x40),
    16
  );

  // Step 9: subcmd 0x5C with magic payload
  await sendAndCheck(
    joycon,
    "subcmd 0x5C (magic payload)",
    () => joycon.sendSubcommand(0x5c, SUBCMD_0X5C_6_PAYLOAD),
    (r) => isSubcmdReply(r, 0x5c),
    16
  );

  // Step 10: subcmd 0x5A — start polling
  await sendAndCheck(
    joycon,
    "subcmd 0x5A (start Ring-Con polling)",
    () => joycon.sendSubcommand(0x5a, SUBCMD_0X5A_PAYLOAD),
    (r) => isSubcmdReply(r, 0x5a),
    16
  );

  console.log("Ring-Con init complete.");
}
