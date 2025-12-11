const startBtn = document.getElementById("start");
const stopBtn = document.getElementById("stop");
const statusEl = document.getElementById("status");

startBtn.addEventListener("click", () => {
	chrome.runtime.sendMessage({ type: "START_CAPTURE" }, response => {
		if (!response || !response.ok) {
			statusEl.textContent = "Error starting capture: " + (response?.error || "unknown");
			return;
		}
		statusEl.textContent = "Capturing tab audio…";
	});
});

stopBtn.addEventListener("click", () => {
	chrome.runtime.sendMessage({ type: "STOP_CAPTURE" }, response => {
		statusEl.textContent = "Stopped.";
	});
});
