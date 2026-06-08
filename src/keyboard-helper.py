import sys
import ctypes
from ctypes import wintypes
import socket

user32 = ctypes.windll.user32

KEYEVENTF_KEYUP = 0x0002
INPUT_KEYBOARD  = 1

class KEYBDINPUT(ctypes.Structure):
    _fields_ = [("wVk", wintypes.WORD), ("wScan", wintypes.WORD),
                ("dwFlags", wintypes.DWORD), ("time", wintypes.DWORD),
                ("dwExtraInfo", ctypes.c_size_t)]

class MOUSEINPUT(ctypes.Structure):
    _fields_ = [("dx", wintypes.LONG), ("dy", wintypes.LONG),
                ("mouseData", wintypes.DWORD), ("dwFlags", wintypes.DWORD),
                ("time", wintypes.DWORD), ("dwExtraInfo", ctypes.c_size_t)]

class _U(ctypes.Union):
    _fields_ = [("ki", KEYBDINPUT), ("mi", MOUSEINPUT)]

class INPUT(ctypes.Structure):
    _fields_ = [("type", wintypes.DWORD), ("_u", _U)]

SCAN = {0x20: 0x39, 0x0D: 0x1C}

def _send(vk, flags):
    inp = INPUT(type=INPUT_KEYBOARD)
    inp._u.ki.wVk    = vk
    inp._u.ki.wScan  = SCAN.get(vk, 0)
    inp._u.ki.dwFlags = flags
    r = user32.SendInput(1, ctypes.byref(inp), ctypes.sizeof(INPUT))
    if r == 0:
        print(f"[kb-py] SendInput FAILED err={ctypes.GetLastError()}", flush=True)

def key_down(vk): _send(vk, 0)
def key_up(vk):   _send(vk, KEYEVENTF_KEYUP)
def key_tap(vk):
    import time
    key_down(vk); time.sleep(0.03); key_up(vk)

PORT = 57624
sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
sock.bind(('127.0.0.1', PORT))
print(f"[kb-py] listening on UDP 127.0.0.1:{PORT}", flush=True)

while True:
    data, _ = sock.recvfrom(256)
    parts = data.decode().strip().split()
    if len(parts) < 2:
        continue
    cmd, vk = parts[0], int(parts[1])
    if   cmd == "key_down": key_down(vk)
    elif cmd == "key_up":   key_up(vk)
    elif cmd == "key_tap":  key_tap(vk)
    print(f"[kb-py] {cmd} vk={vk}", flush=True)
