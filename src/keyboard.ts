import { spawn, execSync, type ChildProcess } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SWIFT_SRC = join(__dirname, "keyboard-helper.swift");
const BINARY = join(__dirname, "keyboard-helper");

const VK_FUNCTION = 63; // kVK_Function
const VK_RETURN = 36; // kVK_Return

function ensureCompiled() {
  const needsCompile = !existsSync(BINARY)
    || statSync(SWIFT_SRC).mtimeMs > statSync(BINARY).mtimeMs;

  if (needsCompile) {
    console.log("Compiling keyboard helper...");
    execSync(`swiftc -O -o "${BINARY}" "${SWIFT_SRC}"`, { stdio: "inherit" });
    console.log("Keyboard helper compiled.");
  }
}

export class Keyboard {
  private proc: ChildProcess;

  constructor() {
    ensureCompiled();
    this.proc = spawn(BINARY, [], { stdio: ["pipe", "inherit", "inherit"] });
    this.proc.on("error", (err) => {
      console.error("Keyboard helper error:", err.message);
    });
  }

  private send(cmd: string) {
    this.proc.stdin!.write(cmd + "\n");
  }

  fnDown() {
    this.send(`key_down ${VK_FUNCTION}`);
  }

  fnUp() {
    this.send(`key_up ${VK_FUNCTION}`);
  }

  tapEnter() {
    this.send(`key_tap ${VK_RETURN}`);
  }

  close() {
    this.proc.stdin!.end();
    this.proc.kill();
  }
}
