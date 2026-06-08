import { createSocket } from "node:dgram";
import { platform } from "node:os";
import { execSync, spawn } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const IS_WINDOWS = platform() === "win32";

const MACOS_VK_FUNCTION = 63;
const MACOS_VK_RETURN   = 36;
const WIN_VK_SPACE  = 0x20;
const WIN_VK_RETURN = 0x0D;

const VK_SQUEEZE = IS_WINDOWS
  ? (process.env.SQUEEZE_VK ? parseInt(process.env.SQUEEZE_VK, 16) : WIN_VK_SPACE)
  : MACOS_VK_FUNCTION;
const VK_ENTER = IS_WINDOWS ? WIN_VK_RETURN : MACOS_VK_RETURN;

const REPEAT_INTERVAL_MS = 40;
const UDP_PORT = 57624;

export class Keyboard {
  private udp = createSocket("udp4");
  private repeatTimer: ReturnType<typeof setInterval> | null = null;
  private macProc: ReturnType<typeof spawn> | null = null;

  constructor() {
    if (!IS_WINDOWS) {
      // macOS: compile and spawn Swift helper, communicate via stdin
      const SWIFT_SRC = join(__dirname, "keyboard-helper.swift");
      const BINARY    = join(__dirname, "keyboard-helper");
      const needsCompile = !existsSync(BINARY)
        || statSync(SWIFT_SRC).mtimeMs > statSync(BINARY).mtimeMs;
      if (needsCompile) {
        console.log("Compiling keyboard helper...");
        execSync(`swiftc -O -o "${BINARY}" "${SWIFT_SRC}"`, { stdio: "inherit" });
      }
      this.macProc = spawn(BINARY, [], { stdio: ["pipe", "inherit", "inherit"] });
      this.macProc.on("error", (e) => console.error("Keyboard helper error:", e.message));
    }
    // Windows: keyboard-helper.py must be running separately (see README)
  }

  private send(cmd: string) {
    if (IS_WINDOWS) {
      const buf = Buffer.from(cmd);
      this.udp.send(buf, UDP_PORT, "127.0.0.1");
    } else {
      this.macProc!.stdin!.write(cmd + "\n");
    }
  }

  fnDown() {
    this.send(`key_down ${VK_SQUEEZE}`);
    if (IS_WINDOWS && !this.repeatTimer) {
      this.repeatTimer = setInterval(() => {
        this.send(`key_down ${VK_SQUEEZE}`);
      }, REPEAT_INTERVAL_MS);
    }
  }

  fnUp() {
    if (this.repeatTimer) { clearInterval(this.repeatTimer); this.repeatTimer = null; }
    this.send(`key_up ${VK_SQUEEZE}`);
  }

  tapEnter() {
    this.send(`key_tap ${VK_ENTER}`);
  }

  close() {
    if (this.repeatTimer) { clearInterval(this.repeatTimer); this.repeatTimer = null; }
    this.udp.close();
    this.macProc?.kill();
  }
}
