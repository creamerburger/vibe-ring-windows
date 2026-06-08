# Vibe Ring (Windows)

Map Nintendo Ring Fit's Ring-Con to keyboard inputs on Windows — designed for use with Claude Code's `/voice` mode.

- **Squeeze** Ring-Con → Hold **Space** (held while squeezed, released when let go)
- **Pull outward** (short) → Tap **Enter**

This is a Windows port of [wong2/vibe-ring](https://github.com/wong2/vibe-ring).

## Prerequisites

- Windows 10/11
- Node.js 18+
- [pnpm](https://pnpm.io/)
- Python 3.x (must be on PATH)
- A Nintendo Joy-Con (R) with Ring-Con attached

## Setup

### 1. Install dependencies

```powershell
pnpm install
```

### 2. Pair the Joy-Con

Open **Settings → Bluetooth & devices**. Press the small sync button on the Joy-Con (R) rail (the button on the flat side) until the lights start flashing, then pair it from Windows.

### 3. Start the keyboard helper

The keyboard helper is a Python UDP server that receives key commands from the main process and injects them via the Windows `SendInput` API. It must be running before you start the main process.

```powershell
python src/keyboard-helper.py
```

Leave this running in its own terminal.

### 4. Start vibe-ring

In a second terminal:

```powershell
pnpm start
```

The program will:

1. Discover the paired Joy-Con (R) over Bluetooth HID
2. Initialize the Ring-Con MCU (you'll see step-by-step logs)
3. Enter the input loop — squeeze and pull to send keystrokes

Press **Ctrl+C** to quit.

### Example output

```
Found Joy-Con (R): \\?\HID#...
Initializing Ring-Con...
  [reset] MCU → Suspend
  [OK] Enable vibration
  [OK] Enable IMU
  [OK] Set input report mode (0x30)
  [OK] Enable MCU (Standby)
  [OK] MCU SetMCUMode(MaybeRingcon)
  [OK] Configure MCU IR (IRSensorSleep)
  [OK] Get external device info (0x59)
  [OK] Enable IMU MaybeRingcon (sub 0x40 arg 3)
  [OK] subcmd 0x5C (magic payload)
  [OK] subcmd 0x5A (start Ring-Con polling)
Ring-Con init complete.
Ring-Con ready! Listening for input...
  Squeeze → Space (hold) [voice record]
  Pull outward (short) → Enter [send]
  Ctrl+C to quit

[squeeze] Fn DOWN (flex=4065)
[release] Fn UP (flex=3487)
[pull start] (flex=1050)
[pull] Enter (duration=180ms)
```

## Use with Claude Code voice mode

1. Open Claude Code and run `/voice` to enable voice mode (hold mode)
2. Start `keyboard-helper.py` and `pnpm start` as described above
3. Focus the Claude Code terminal
4. **Squeeze** the Ring-Con to start recording, **release** to stop
5. **Pull** the Ring-Con outward to send the message

## Tuning

The flex sensor thresholds in `src/main.ts` may need adjustment for your specific Ring-Con. Run with `DEBUG_RINGCON=1` to see raw flex values:

```powershell
$env:DEBUG_RINGCON=1; pnpm start
```

| Constant | Default | Description |
|---|---|---|
| `SQUEEZE_THRESHOLD` | `4000` | Flex value above which a squeeze is detected |
| `SQUEEZE_RELEASE` | `3600` | Flex value below which a squeeze is released (hysteresis) |
| `PULL_THRESHOLD` | `2000` | Flex value below which an outward pull is detected |
| `PULL_RELEASE` | `2500` | Flex value above which a pull is released |
| `MAX_PULL_DURATION` | `500` ms | Pulls longer than this are ignored |

## Troubleshooting

**"Joy-Con (R) not found"** — Make sure the Joy-Con is paired and connected in Windows Bluetooth settings. Only Joy-Con (R) (VID `057E`, PID `2007`) is supported.

**Ring-Con initialization fails** — Physically remove the Joy-Con from the Ring-Con rail for a few seconds, reinsert it firmly, and try again. Re-pairing via Bluetooth may also help.

**Keys not appearing** — Make sure `keyboard-helper.py` is running before starting `pnpm start`. The target window must be focused when squeezing — the Ring-Con doesn't steal focus, so whatever window you had active will receive the keystrokes.

## License

ISC
