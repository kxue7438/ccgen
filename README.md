# Real-Time Whisper Captions for Chrome

Live transcription Chrome extension powered by `faster-whisper` running locally on your CPU.

## Quick Start

### 1. Set Up Backend (Python)

```bash
cd whisper_backend

# Create virtual environment
python3 -m venv venv

# Install dependencies
./venv/bin/pip install -r requirements.txt

# Run server
./venv/bin/python server.py --model small
```

First run downloads the model (~500MB). After that it's cached.

### 2. Install Chrome Extension

1. Open Chrome → `chrome://extensions/`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `extension` folder

### 3. Use It

1. Start the backend server
2. Open a tab with audio (YouTube, video call, etc.)
3. Click the extension icon
4. Click **Start Capture**
5. Captions appear at the bottom of the page!

You can close the popup — capture continues in the background.

---

## Backend Configuration

### Model Selection

| Model | Speed | Accuracy | RAM | Best For |
|-------|-------|----------|-----|----------|
| `tiny` | ⚡⚡⚡⚡ | ★★☆☆ | ~1GB | **Fastest** - multilingual, real-time |
| `base` | ⚡⚡⚡ | ★★★☆ | ~1GB | **Recommended** - good speed & accuracy |
| `small` | ⚡⚡ | ★★★★ | ~2GB | High accuracy, slower |
| `medium` | ⚡ | ★★★★★ | ~5GB | Very high accuracy, may lag |
| `large-v3` | 🐢 | ★★★★★ | ~10GB | Not for real-time |

**For multilingual support (Chinese, Spanish, etc.):**
```bash
./venv/bin/python server.py --model base
```

**For English-only (faster):**
```bash
./venv/bin/python server.py --model base.en
```

Models without `.en` suffix support 99+ languages including Chinese, Japanese, Korean, Spanish, French, etc. with automatic language detection.

### Change Port

```bash
./venv/bin/python server.py --model small --port 9000
```

Then update WebSocket URL in the extension popup.

---

## Troubleshooting

### "Cannot connect to backend"
- `cd whisper_backend`
- Make sure server is running: `./venv/bin/python server.py --model small`
- Check port matches (default: 8765)
- Verify WebSocket URL in extension: `ws://127.0.0.1:8765`

### Captions are delayed
- Use a faster model: `--model base` or `--model tiny` (for multilingual) or `--model base.en` / `--model tiny.en` (English-only)
- Close CPU-intensive applications
- Check CPU usage
- For Chinese/multilingual: `base` is 2-5x faster than `small` with good accuracy


Or run directly:
```bash
./venv/bin/python server.py --model small
```

---

## How It Works

```
┌─────────────────┐                      ┌──────────────────┐
│ Chrome Tab      │                      │  Python Backend  │
│ (YouTube, etc)  │                      │                  │
└────────┬────────┘                      │  faster-whisper  │
         │ audio                         │  + Silero VAD    │
         ▼                               └────────▲─────────┘
┌─────────────────┐     WebSocket               │
│ Offscreen Doc   │─────(PCM16 audio)──────────►│
│ (audio capture) │                              │
└─────────────────┘◄────(transcripts)────────────┘
         │
         ▼
┌─────────────────┐
│ Content Script  │
│ (caption overlay)│
└─────────────────┘
```

1. **Offscreen document** captures tab audio using `chrome.tabCapture`
2. Audio converted to 16kHz PCM16 and sent via WebSocket
3. **Backend** uses VAD to detect speech segments
4. **faster-whisper** transcribes segments
5. Transcripts sent back and displayed as captions

---

## Tips for Best Results

1. **Use English-only models** (`.en`) if you only need English — they're faster and more accurate
2. **Start with `small.en`** — best balance of speed and accuracy
3. **Keep audio clear** — background noise reduces accuracy
4. **Close the popup** — capture continues in background, saves resources

---
