# Vibe Ring (Windows)

Nintendo Ring Fit의 링콘을 Windows 키보드 입력으로 매핑합니다 — Claude Code의 `/voice` 모드와 함께 사용하도록 설계되었습니다.

- **스퀴즈** (링콘 누르기) → **Space** 키 홀드 (누르는 동안 유지, 놓으면 해제)
- **풀** (링콘 당기기, 짧게) → **Enter** 키 탭

이 프로젝트는 [wong2/vibe-ring](https://github.com/wong2/vibe-ring)의 Windows 포팅 버전입니다.

## 필요 사항

- Windows 10/11
- Node.js 18+
- [pnpm](https://pnpm.io/)
- Python 3.x (PATH에 등록되어 있어야 함)
- 링콘이 연결된 Nintendo Joy-Con (R)

## 설치

### 1. 의존성 설치

```powershell
pnpm install
```

### 2. Joy-Con 페어링

**설정 → Bluetooth 및 장치**를 엽니다. Joy-Con (R) 레일의 작은 동기화 버튼(평평한 면의 버튼)을 불이 깜빡일 때까지 누른 뒤, Windows에서 페어링합니다.

### 3. 키보드 헬퍼 실행

키보드 헬퍼는 메인 프로세스에서 키 명령을 받아 Windows `SendInput` API로 주입하는 Python UDP 서버입니다. 메인 프로세스보다 먼저 실행해야 합니다.

```powershell
python src/keyboard-helper.py
```

이 터미널은 그대로 열어두세요.

### 4. vibe-ring 실행

두 번째 터미널에서:

```powershell
pnpm start
```

프로그램이 수행하는 작업:

1. 페어링된 Joy-Con (R)을 Bluetooth HID로 탐색
2. 링콘 MCU 초기화 (단계별 로그 출력)
3. 입력 루프 진입 — 스퀴즈와 풀로 키 입력 전송

종료하려면 **Ctrl+C**를 누르세요.

### 실행 예시

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

## Claude Code 보이스 모드와 함께 사용하기

1. Claude Code에서 `/voice`를 실행해 보이스 모드 활성화 (홀드 모드)
2. 위 설명대로 `keyboard-helper.py`와 `pnpm start` 실행
3. Claude Code 터미널에 포커스
4. 링콘을 **스퀴즈**하면 녹음 시작, **놓으면** 녹음 종료
5. 링콘을 **풀**하면 메시지 전송

## 임계값 조정

`src/main.ts`의 플렉스 센서 임계값은 사용하는 링콘에 따라 조정이 필요할 수 있습니다. 원시 플렉스 값을 보려면 `DEBUG_RINGCON=1`로 실행하세요:

```powershell
$env:DEBUG_RINGCON=1; pnpm start
```

| 상수 | 기본값 | 설명 |
|---|---|---|
| `SQUEEZE_THRESHOLD` | `4000` | 이 값 이상이면 스퀴즈로 감지 |
| `SQUEEZE_RELEASE` | `3600` | 이 값 미만이면 스퀴즈 해제 (히스테리시스) |
| `PULL_THRESHOLD` | `2000` | 이 값 미만이면 풀로 감지 |
| `PULL_RELEASE` | `2500` | 이 값 이상이면 풀 해제 |
| `MAX_PULL_DURATION` | `500` ms | 이 시간 이상 당기면 무시 |

## 문제 해결

**"Joy-Con (R) not found"** — Joy-Con이 Windows Bluetooth 설정에서 페어링 및 연결되어 있는지 확인하세요. Joy-Con (R) (VID `057E`, PID `2007`)만 지원됩니다.

**링콘 초기화 실패** — Joy-Con을 링콘 레일에서 몇 초간 분리했다가 단단히 다시 꽂아 보세요. Bluetooth에서 재페어링하는 것도 도움이 될 수 있습니다.

**키 입력이 안 됨** — `pnpm start` 실행 전에 `keyboard-helper.py`가 실행 중인지 확인하세요. 스퀴즈할 때 대상 창이 포커스되어 있어야 합니다 — 링콘은 포커스를 빼앗지 않으므로, 현재 활성화된 창으로 키 입력이 전달됩니다.

## 라이선스

ISC
