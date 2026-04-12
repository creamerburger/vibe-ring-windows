// CRC-8-CCITT with polynomial 0x07
// Used for MCU configuration command checksums on Joy-Con
// Lookup table taken from Yamakaky/joy (which copied from jc_toolkit)

const POLY = 0x07;

const table = new Uint8Array(256);
for (let i = 0; i < 256; i++) {
  let crc = i;
  for (let bit = 0; bit < 8; bit++) {
    if (crc & 0x80) {
      crc = ((crc << 1) ^ POLY) & 0xff;
    } else {
      crc = (crc << 1) & 0xff;
    }
  }
  table[i] = crc;
}

export function crc8(data: Uint8Array | Buffer, start: number, end: number): number {
  let crc = 0x00;
  for (let i = start; i < end; i++) {
    crc = table[crc ^ data[i]];
  }
  return crc;
}
