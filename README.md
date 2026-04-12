# Vibe Ring

[中文说明](README_CN.md)

Map Nintendo Ring Fit's Ring-Con to macOS keyboard inputs:

- **Squeeze** Ring-Con → Hold **Fn** key (held while squeezed, released when let go)
- **Pull outward** (short) → Tap **Enter** key

## Prerequisites

- macOS (other platforms not supported)
- Node.js 18+
- [pnpm](https://pnpm.io/)
- Xcode Command Line Tools (`xcode-select --install`)
- A Nintendo Joy-Con (R) with Ring-Con attached

## Setup

### 1. Install dependencies

```bash
pnpm install
```

This also builds the native `node-hid` binding. The Swift keyboard helper is compiled automatically on first run.

### 2. Pair the Joy-Con

Open **System Settings → Bluetooth**. Hold the small sync button on the Joy-Con (R) rail until the lights start flashing, then pair it from your Mac.

### 3. Grant Accessibility permission

The app simulates keyboard events via the macOS CGEvent API, which requires Accessibility access.

Go to **System Settings → Privacy & Security → Accessibility** and add your terminal app (e.g. Terminal, iTerm2, Ghostty).

## Usage

```bash
pnpm start
```

The program will:

1. Discover the paired Joy-Con (R) over Bluetooth HID
2. Initialize the Ring-Con MCU (you'll see step-by-step logs)
3. Enter the input loop — squeeze and pull to send keystrokes

Press **Ctrl+C** to quit.

### Example output

```
Found Joy-Con (R): IOService:/...
Initializing Ring-Con...
  [OK] Enable vibration
  [OK] Enable IMU
  [OK] Set input report mode (0x30)
  [OK] Enable MCU
  [OK] MCU status check
  [OK] MCU configure (init mode)
  [OK] MCU external device ready
  [OK] Get external device info
  [OK] Enable IMU + Ring-Con
  [OK] Start Ring-Con polling
  [OK] Set external config
Ring-Con initialized successfully!
Ring-Con ready! Listening for input...
  Squeeze → Fn (hold)
  Pull outward (short) → Enter
  Ctrl+C to quit

[squeeze] Fn DOWN (flex=18)
[release] Fn UP (flex=10)
[pull start] (flex=4)
[pull] Enter (duration=120ms)
```

## Tuning

The flex sensor thresholds in `src/main.ts` are starting estimates and may need adjustment for your specific Ring-Con:

| Constant | Default | Description |
|---|---|---|
| `SQUEEZE_THRESHOLD` | `0x0E` (14) | Flex value above which a squeeze is detected |
| `SQUEEZE_RELEASE` | `0x0C` (12) | Flex value below which a squeeze is released (hysteresis) |
| `PULL_THRESHOLD` | `0x06` (6) | Flex value below which an outward pull is detected |
| `REST_VALUE` | `0x0A` (10) | Approximate resting flex value |
| `MAX_PULL_DURATION` | `500` ms | Pulls longer than this are ignored |

Run the program and watch the logged flex values to calibrate these for your setup.

## Troubleshooting

**"Joy-Con (R) not found"** — Make sure the Joy-Con is paired and connected in macOS Bluetooth settings. Only Joy-Con (R) (VID `057E`, PID `2007`) is supported.

**Ring-Con initialization fails** — Try disconnecting and reconnecting the Joy-Con. Ensure the Ring-Con is firmly seated on the Joy-Con rail.

**Key simulation not working** — Confirm that your terminal app has been granted Accessibility permission in System Settings.

## License

ISC
