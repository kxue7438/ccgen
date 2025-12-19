# Real-Time Whisper Captions for Chrome

Live transcription Chrome extension powered by `faster-whisper` running locally on your CPU.

## Quick Start

### 1. Set Up Backend (Python)

```bash
cd backend

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

## Project Structure

```
whisper-realtime/
├── backend/
│   ├── server.py          # WebSocket server + Whisper transcription
│   └── requirements.txt   # Python dependencies
│
└── extension/
    ├── manifest.json      # Extension config
    ├── popup.html         # Extension UI
    ├── popup.js           # UI logic
    ├── background.js      # Service worker - manages capture
    ├── offscreen.html     # Offscreen document for audio
    ├── offscreen.js       # Audio capture + WebSocket
    ├── content.js         # Caption overlay on pages
    ├── captions.css       # Caption styling
    └── icon*.png          # Extension icons
```

---

## Backend Configuration

### Model Selection

| Model | Speed | Accuracy | RAM | Best For |
|-------|-------|----------|-----|----------|
| `tiny` | ⚡⚡⚡⚡ | ★★☆☆ | ~1GB | Fastest, basic accuracy |
| `base` | ⚡⚡⚡ | ★★★☆ | ~1GB | Good for casual use |
| `small` | ⚡⚡ | ★★★★ | ~2GB | **Recommended** |
| `medium` | ⚡ | ★★★★★ | ~5GB | High accuracy, may lag |
| `large-v3` | 🐢 | ★★★★★ | ~10GB | Not for real-time |

Use `.en` suffix for English-only (faster):
```bash
./venv/bin/python server.py --model small.en
```

### Change Port

```bash
./venv/bin/python server.py --model small --port 9000
```

Then update WebSocket URL in the extension popup.

---

## Requirements

### Backend
- Python 3.9+
- ~2GB RAM for `small` model
- CPU with AVX2 support (most modern CPUs)

### Extension
- Chrome 116+ (for offscreen document support)
- Manifest V3 compatible

---

## Troubleshooting

### "Cannot connect to backend"
- Make sure server is running: `./venv/bin/python server.py --model small`
- Check port matches (default: 8765)
- Verify WebSocket URL in extension: `ws://127.0.0.1:8765`

### No captions appearing
- Check extension status shows "Capturing & Transcribing"
- Make sure the page has audio playing
- Try refreshing the page
- Check Chrome DevTools console for errors

### Captions are delayed
- Use a smaller model: `--model base` or `--model tiny`
- Close CPU-intensive applications
- Check CPU usage

### Extension won't capture
- Can't capture `chrome://` pages or Chrome Web Store
- Try on YouTube or other regular websites
- Reload the extension

### "Permission denied" on Linux
```bash
chmod +x venv/bin/activate
source venv/bin/activate
```

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

## License

MIT — do whatever you want with it.