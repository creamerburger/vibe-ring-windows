# Vibe Ring

[English](README.md)

将任天堂健身环（Ring-Con）映射为 macOS 键盘输入：

- **挤压**健身环 → 长按 **Fn** 键（按住期间持续生效，松开即释放）
- **向外短拉**健身环 → 敲击 **Enter** 键

## 前置条件

- macOS（暂不支持其他系统）
- Node.js 18+
- [pnpm](https://pnpm.io/)
- Xcode 命令行工具（`xcode-select --install`）
- 一个任天堂 Joy-Con (R) 手柄，并装上健身环

## 安装与配置

### 1. 安装依赖

```bash
pnpm install
```

这会同时构建 `node-hid` 原生绑定。Swift 键盘辅助程序会在首次运行时自动编译。

### 2. 配对 Joy-Con

打开**系统设置 → 蓝牙**，按住 Joy-Con (R) 侧面的小同步按钮直到指示灯闪烁，然后在 Mac 上完成配对。

### 3. 授予辅助功能权限

本程序通过 macOS CGEvent API 模拟键盘事件，需要辅助功能权限。

前往**系统设置 → 隐私与安全性 → 辅助功能**，添加你使用的终端应用（如 Terminal、iTerm2、Ghostty）。

## 使用方法

```bash
pnpm start
```

程序会：

1. 通过蓝牙 HID 发现已配对的 Joy-Con (R)
2. 初始化健身环 MCU（日志中可看到逐步进度）
3. 进入输入循环 —— 挤压和拉动健身环来发送按键

按 **Ctrl+C** 退出。

### 示例输出

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

## 参数调节

`src/main.ts` 中的 flex 传感器阈值为初始估计值，可能需要根据你的健身环进行调整：

| 常量 | 默认值 | 说明 |
|---|---|---|
| `SQUEEZE_THRESHOLD` | `0x0E` (14) | 超过此值视为挤压 |
| `SQUEEZE_RELEASE` | `0x0C` (12) | 低于此值释放挤压（迟滞防抖） |
| `PULL_THRESHOLD` | `0x06` (6) | 低于此值视为向外拉 |
| `REST_VALUE` | `0x0A` (10) | 大致静息值 |
| `MAX_PULL_DURATION` | `500` ms | 超过此时长的拉动不触发 Enter |

运行程序后观察日志中打印的 flex 值来校准这些参数。

## 常见问题

**"Joy-Con (R) not found"** — 确认 Joy-Con 已在 macOS 蓝牙设置中配对并连接。仅支持 Joy-Con (R)（VID `057E`，PID `2007`）。

**健身环初始化失败** — 尝试断开并重新连接 Joy-Con。确保健身环牢固安装在 Joy-Con 导轨上。

**按键模拟无效** — 确认终端应用已被授予辅助功能权限。

## 许可

ISC
