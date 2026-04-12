import CoreGraphics
import Foundation

// Read commands from stdin, one per line:
//   "key_down <keycode>"   — press key
//   "key_up <keycode>"     — release key
//   "key_tap <keycode>"    — press + release key

func simulateKey(keyCode: CGKeyCode, down: Bool) {
    guard let event = CGEvent(keyboardEventSource: nil, virtualKey: keyCode, keyDown: down) else {
        return
    }
    event.post(tap: .cghidEventTap)
}

while let line = readLine() {
    let parts = line.split(separator: " ")
    guard parts.count == 2, let keyCode = UInt16(parts[1]) else {
        continue
    }

    switch parts[0] {
    case "key_down":
        simulateKey(keyCode: CGKeyCode(keyCode), down: true)
    case "key_up":
        simulateKey(keyCode: CGKeyCode(keyCode), down: false)
    case "key_tap":
        simulateKey(keyCode: CGKeyCode(keyCode), down: true)
        simulateKey(keyCode: CGKeyCode(keyCode), down: false)
    default:
        break
    }
}
