import CoreGraphics
import Foundation

// Read commands from stdin, one per line:
//   "key_down <keycode>"   — press key
//   "key_up <keycode>"     — release key
//   "key_tap <keycode>"    — press + release key

let eventSource = CGEventSource(stateID: .privateState)
let functionKey = CGKeyCode(63)

func simulateKey(keyCode: CGKeyCode, down: Bool) {
    guard let eventSource,
          let event = CGEvent(keyboardEventSource: eventSource, virtualKey: keyCode, keyDown: down) else {
        return
    }

    // For non-modifier keys, explicitly clear flags so the synthetic event
    // cannot accidentally inherit Command/Control/Option/Shift state from the
    // current session.
    if keyCode != functionKey {
        event.flags = []
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
