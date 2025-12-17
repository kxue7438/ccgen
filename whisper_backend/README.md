# Real-Time Whisper Captions for Chrome

Live transcription Chrome extension powered by `faster-whisper` running locally on your CPU.

**Optimized for:** Ryzen 5800X (8c/16t) + any GPU (GPU not used - CPU is faster for this use case)

## Quick Start

### 1. Set Up Backend (Python)

```bash
cd whisper_backend

# Create virtual environment
python -m venv venv

# Activate it
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start server
python server.py --model small.en
```

Or on Windows, just double-click `start_server.bat`.

### 2. Install Chrome Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select the `extension` folder
5. Pin the extension to your toolbar

### 3. Use It

1. Start the backend server (see step 1)
2. Open any tab with audio (YouTube, video call, etc.)
3. Click the extension icon
4. Click **Start Capture**
5. Captions appear at the bottom of the page!

## Model Selection

| Model | Speed | Accuracy | Best For |
|-------|-------|----------|----------|
| `tiny.en` | ⚡⚡⚡ | ★★☆ | Maximum speed, basic accuracy |
| `base.en` | ⚡⚡⚡ | ★★★ | Good balance for casual use |
| `small.en` | ⚡⚡ | ★★★★ | **Recommended** - best real-time balance |
| `medium.en` | ⚡ | ★★★★★ | High accuracy, may lag |
| `large-v3` | 🐌 | ★★★★★ | Not recommended for real-time |

Change model:
```bash
python server.py --model base.en  # faster
python server.py --model small.en  # recommended (default)
```

## Architecture

```
┌─────────────────┐     WebSocket      ┌──────────────────┐
│ Chrome Extension│◄──────────────────►│  Python Backend  │
│                 │   (PCM16 audio)    │                  │
│  - Tab Capture  │                    │  - faster-whisper│
│  - Audio→PCM16  │   (transcripts)    │  - Silero VAD    │
│  - Captions UI  │◄──────────────────►│  - Async server  │
└─────────────────┘                    └──────────────────┘
```

## Performance Tips

### For your 5800X:

1. **Use `.en` models** - English-only models are ~2x faster
2. **Start with `small.en`** - Best speed/accuracy for your CPU
3. **Close unnecessary apps** - More CPU = faster transcription
4. **Use wired audio** - Bluetooth adds latency

### Typical latency:
- `tiny.en`: ~200-400ms
- `base.en`: ~400-600ms  
- `small.en`: ~600-1000ms
- `medium.en`: ~1500-2500ms (may feel laggy)

## Troubleshooting

### "Cannot connect to backend"
- Make sure the server is running (`python server.py`)
- Check the port matches (default: 8765)
- Firewall might be blocking localhost connections

### No captions appearing
- Click the extension icon and verify status shows "Capturing"
- Check the page has audio playing
- Try refreshing the page after starting capture

### Laggy/delayed captions
- Switch to a faster model: `python server.py --model base.en`
- Close CPU-intensive applications
- Check CPU usage in Task Manager

### Extension not capturing audio
- Some pages (like `chrome://` pages) don't allow capture
- Make sure you're on a regular webpage
- Try on YouTube or another video site

## Files

```
realtime-whisper/
├── extension/
│   ├── manifest.json      # Extension config
│   ├── popup.html/js      # Extension UI
│   ├── background.js      # Audio capture + WebSocket
│   ├── content.js         # Caption overlay
│   └── captions.css       # Caption styling
│
└── backend/
    ├── server.py          # Main server
    ├── requirements.txt   # Python dependencies
    └── start_server.bat   # Windows launcher
```

## Why Not Use the RX 590?

- ROCm (AMD's CUDA equivalent) doesn't support older cards well
- Even if it did, CPU is often faster for smaller models
- Your 5800X is genuinely excellent for this workload
- Browser-based GPU compute (WebGPU) isn't ready for Whisper yet

## Advanced Configuration

### Change server port:
```bash
python server.py --port 9000
```
Then update the WebSocket URL in the extension popup.

### Adjust VAD sensitivity:
Edit `server.py`, find `AudioBuffer` class:
```python
self.vad_threshold = 0.5  # Lower = more sensitive
```

### Longer/shorter segments:
```python
min_speech_ms=500,   # Minimum speech duration
max_speech_ms=10000, # Maximum before forced transcribe
silence_ms=500,      # Silence to end segment
```

## License

MIT - Do whatever you want with it.