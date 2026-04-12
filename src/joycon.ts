import HID from "node-hid";
import { crc8 } from "./crc8.js";

const VID = 0x057e;
const PID_JOYCON_R = 0x2007;

const RUMBLE_NEUTRAL = Buffer.from([0x00, 0x01, 0x40, 0x40, 0x00, 0x01, 0x40, 0x40]);

export class JoyCon {
  private device: HID.HID;
  private counter = 0;

  constructor(device: HID.HID) {
    this.device = device;
  }

  static find(): JoyCon {
    const devices = HID.devices().filter(
      (d) => d.vendorId === VID && d.productId === PID_JOYCON_R
    );
    if (devices.length === 0) {
      throw new Error(
        "Joy-Con (R) not found. Make sure it is paired via Bluetooth."
      );
    }
    console.log(`Found Joy-Con (R): ${devices[0].path}`);
    const hid = new HID.HID(devices[0].path!);
    return new JoyCon(hid);
  }

  private nextCounter(): number {
    const c = this.counter & 0xf;
    this.counter++;
    return c;
  }

  /** Send a subcommand via report 0x01.
   * Per dekuNukem wiki, subcommands 0x21 and 0x59 require CRC-8 at byte 47
   * over bytes 11-46. Auto-apply CRC for those subcommands.
   */
  sendSubcommand(subcmd: number, data: Buffer | number[] = []): void {
    const buf = Buffer.alloc(49);
    buf[0] = 0x01;
    buf[1] = this.nextCounter();
    RUMBLE_NEUTRAL.copy(buf, 2);
    buf[10] = subcmd;
    const d = Buffer.from(data);
    d.copy(buf, 11);
    if (subcmd === 0x21 || subcmd === 0x59) {
      buf[47] = crc8(buf, 11, 47);
    }
    this.device.write([...buf]);
  }

  /** Send an MCU command via report 0x11 */
  sendMCUCommand(subcmd: number, data: Buffer | number[] = []): void {
    const buf = Buffer.alloc(49);
    buf[0] = 0x11;
    buf[1] = this.nextCounter();
    RUMBLE_NEUTRAL.copy(buf, 2);
    buf[10] = subcmd;
    const d = Buffer.from(data);
    d.copy(buf, 11);
    this.device.write([...buf]);
  }

  /**
   * Send an MCU configuration command via subcommand 0x21.
   * Layout (matches Yamakaky/joy Rust implementation):
   *   byte 10: 0x21 (subcommand id)
   *   byte 11: 0x21 (MCUCommandId::ConfigureMCU)
   *   byte 12: MCUSubCommandId (0 = SetMCUMode, 1 = SetIRMode)
   *   bytes 13..47: data payload (up to 35 bytes)
   *   byte 48: CRC-8 over bytes 12..47 inclusive (36 bytes)
   */
  sendMCUConfig(mcuSubCmd: number, payload: number[]): void {
    const buf = Buffer.alloc(49);
    buf[0] = 0x01;
    buf[1] = this.nextCounter();
    RUMBLE_NEUTRAL.copy(buf, 2);
    buf[10] = 0x21;
    buf[11] = 0x21;
    buf[12] = mcuSubCmd;
    for (let i = 0; i < payload.length && i < 35; i++) {
      buf[13 + i] = payload[i];
    }
    buf[48] = crc8(buf, 12, 48);
    this.device.write([...buf]);
  }

  /** Read an input report (blocking with timeout in ms) */
  read(timeout = 64): Buffer | null {
    const data = this.device.readTimeout(timeout);
    if (!data || data.length === 0) return null;
    return Buffer.from(data);
  }

  /** Read reports until we get one matching a condition, or timeout after maxRetries */
  readUntil(
    predicate: (report: Buffer) => boolean,
    maxRetries = 8,
    timeout = 100
  ): Buffer | null {
    for (let i = 0; i < maxRetries; i++) {
      const report = this.read(timeout);
      if (report && predicate(report)) return report;
    }
    return null;
  }

  close(): void {
    this.device.close();
  }
}
