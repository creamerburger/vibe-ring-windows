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
const SQUEEZE_THRESHOLD = 4000; // flex > this → squeezing
const SQUEEZE_RELEASE = 3600;   // flex < this → release (hysteresis)
const PULL_THRESHOLD = 2000;    // flex < this → pulling outward
const PULL_RELEASE = 2500;      // flex > this → stop pull
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
    console.log("Disconnected. Reconnecting in 5s...");
    await sleep(5000);
  }
}

async function runSession(joycon: JoyCon, keyboard: Keyboard) {
  await initRingCon(joycon);

  console.log("Ring-Con ready! Listening for input...");
  console.log("  Squeeze → Space (hold) [voice record]");
  console.log("  Pull outward (short) → Enter [send]");
  console.log("  Ctrl+C to quit\n");

  let state: State = State.IDLE;
  let pullStart = 0;
  let lastDebugPrint = 0;
  let zeroFlexCount = 0;

  while (true) {
    let report: Buffer | null;
    try {
      report = joycon.read(0);
    } catch (err: any) {
      throw new Error(`read failed: ${err?.message ?? err}`);
    }
    if (!report) {
      await sleep(1); // yield to event loop for UDP send callbacks
      continue;
    }
    if (report[0] !== 0x30 || report.length < 48) continue;

    // Ring-Con flex value: int16 LE at bytes 39-40 (Frame 3 accel_y slot,
    // replaced by Ring-Con data in MaybeRingcon IMU mode)
    const flex = report.readInt16LE(39);

    if (DEBUG) {
      const now = Date.now();
      if (now - lastDebugPrint > 200) {
        const hex = [...report.slice(35, 45)].map(b => b.toString(16).padStart(2, '0')).join(' ');
        console.log(`flex=${flex} bytes[35-44]=${hex}`);
        lastDebugPrint = now;
      }
      continue;
    }

    // flex=0 means Ring-Con MCU hasn't started sending valid data yet
    if (flex === 0) {
      if (++zeroFlexCount > 300) {
        throw new Error("Ring-Con MCU not sending data — reinitializing");
      }
      continue;
    }
    zeroFlexCount = 0;

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
