document.getElementById('openPanel').addEventListener('click', async () => {
	const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

	// This grants activeTab permission
	await chrome.sidePanel.open({ windowId: tab.windowId });

	// Tell side panel to start capture
	chrome.runtime.sendMessage({ action: 'START_CAPTURE', tabId: tab.id });

	window.close();
});