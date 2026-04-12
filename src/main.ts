import { JoyCon } from "./joycon.js";
import { initRingCon } from "./ringcon.js";
import { Keyboard } from "./keyboard.js";

// Ring-Con flex value is at bytes 39-40 of a 0x30 input report, as an int16
// little-endian, in the third IMU frame's accel_y slot (replaced by Ring-Con
// data when the Joy-Con is in MaybeRingcon IMU mode).
//
// Observed values on this controller:
//   Rest:    ~2380
//   Squeeze: 3800+
//   Pull:    1400-
const SQUEEZE_THRESHOLD = 3000; // flex > this → squeezing
const SQUEEZE_RELEASE = 2700;   // flex < this → release (hysteresis)
const PULL_THRESHOLD = 1800;    // flex < this → pulling outward
const PULL_RELEASE = 2100;      // flex > this → stop pull
const MAX_PULL_DURATION = 500;  // ms — pulls longer than this are ignored

const enum State {
  IDLE,
  SQUEEZING,
  PULLING,
}

const DEBUG = process.env.DEBUG_RINGCON === "1";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function findJoyConWithRetry(): Promise<JoyCon> {
  let logged = false;
  while (true) {
    try {
      return JoyCon.find();
    } catch (err) {
      if (!logged) {
        console.log("Waiting for Joy-Con (R) to connect...");
        logged = true;
      }
      await sleep(2000);
    }
  }
}

async function main() {
  const keyboard = new Keyboard();
  let joycon: JoyCon | null = null;

  const cleanup = () => {
    console.log("\nShutting down...");
    keyboard.fnUp(); // ensure Fn is released before exit
    keyboard.close();
    try { joycon?.close(); } catch {}
    process.exit(0);
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  while (true) {
    console.log("Looking for Joy-Con (R)...");
    joycon = await findJoyConWithRetry();
    try {
      await runSession(joycon, keyboard);
    } catch (err: any) {
      console.error(`Session ended: ${err?.message ?? err}`);
    }
    keyboard.fnUp();
    try { joycon.close(); } catch {}
    joycon = null;
    console.log("Disconnected. Reconnecting in 2s...");
    await sleep(2000);
  }
}

async function runSession(joycon: JoyCon, keyboard: Keyboard) {
  await initRingCon(joycon);

  console.log("Ring-Con ready! Listening for input...");
  console.log("  Squeeze → Fn (hold)");
  console.log("  Pull outward (short) → Enter");
  console.log("  Ctrl+C to quit\n");

  let state: State = State.IDLE;
  let pullStart = 0;
  let lastDebugPrint = 0;

  while (true) {
    let report: Buffer | null;
    try {
      report = joycon.read(64);
    } catch (err: any) {
      throw new Error(`read failed: ${err?.message ?? err}`);
    }
    if (!report) continue;
    if (report[0] !== 0x30 || report.length < 48) continue;

    // Ring-Con flex value: int16 LE at bytes 39-40 (Frame 3 accel_y slot,
    // replaced by Ring-Con data in MaybeRingcon IMU mode)
    const flex = report.readInt16LE(39);

    if (DEBUG) {
      const now = Date.now();
      if (now - lastDebugPrint > 200) {
        console.log(`flex=${flex} state=${state}`);
        lastDebugPrint = now;
      }
      continue;
    }

    switch (state) {
      case State.IDLE:
        if (flex > SQUEEZE_THRESHOLD) {
          state = State.SQUEEZING;
          keyboard.fnDown();
          console.log(`[squeeze] Fn DOWN (flex=${flex})`);
        } else if (flex < PULL_THRESHOLD) {
          state = State.PULLING;
          pullStart = Date.now();
          console.log(`[pull start] (flex=${flex})`);
        }
        break;

      case State.SQUEEZING:
        if (flex < SQUEEZE_RELEASE) {
          state = State.IDLE;
          keyboard.fnUp();
          console.log(`[release] Fn UP (flex=${flex})`);
        }
        break;

      case State.PULLING:
        if (flex >= PULL_RELEASE) {
          // Returned to rest — trigger Enter if short pull
          if (Date.now() - pullStart < MAX_PULL_DURATION) {
            keyboard.tapEnter();
            console.log(`[pull] Enter (duration=${Date.now() - pullStart}ms)`);
          }
          state = State.IDLE;
        } else if (Date.now() - pullStart > MAX_PULL_DURATION) {
          // Timeout — cancel
          console.log(`[pull timeout] cancelled`);
          state = State.IDLE;
        }
        break;
    }
  }
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  console.error("uncaughtException:", err?.message ?? err);
});
process.on("unhandledRejection", (err: any) => {
  console.error("unhandledRejection:", err?.message ?? err);
});
