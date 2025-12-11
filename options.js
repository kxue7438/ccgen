// Load saved API key
chrome.storage.sync.get(['assemblyApiKey'], (result) => {
	if (result.assemblyApiKey) {
		document.getElementById('apiKey').value = result.assemblyApiKey;
		showStatus('API key loaded', 'info');
	}
});

// Save API key
document.getElementById('save').addEventListener('click', () => {
	const apiKey = document.getElementById('apiKey').value.trim();

	if (!apiKey) {
		showStatus('Please enter an API key', 'error');
		return;
	}

	chrome.storage.sync.set({ assemblyApiKey: apiKey }, () => {
		showStatus('API key saved successfully!', 'success');
	});
});

function showStatus(message, type) {
	const statusDiv = document.getElementById('status');
	statusDiv.textContent = message;
	statusDiv.className = type === 'success' ? 'success' : 'info';

	setTimeout(() => {
		statusDiv.textContent = '';
		statusDiv.className = '';
	}, 3000);
}