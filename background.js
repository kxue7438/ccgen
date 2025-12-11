let currentStream = null;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
	if (msg.type === "START_CAPTURE") {
		chrome.tabCapture.capture(
			{
				audio: true,
				video: false
			},
			stream => {
				if (chrome.runtime.lastError || !stream) {
					console.error("Capture failed:", chrome.runtime.lastError);
					sendResponse({ ok: false, error: chrome.runtime.lastError?.message });
					return;
				}

				currentStream = stream;

				// Example: hook into Web Audio API (not required just to prove it works)
				const audioCtx = new AudioContext();
				const source = audioCtx.createMediaStreamSource(stream);
				source.connect(audioCtx.destination); // play back / monitor audio

				sendResponse({ ok: true });
			}
		);

		// keep the message channel open for async sendResponse
		return true;
	}

	if (msg.type === "STOP_CAPTURE") {
		if (currentStream) {
			currentStream.getTracks().forEach(t => t.stop());
			currentStream = null;
		}
		sendResponse({ ok: true });
	}
});