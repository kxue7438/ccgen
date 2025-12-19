// popup.js - Simple UI that talks to background

const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const wsUrlInput = document.getElementById('wsUrl');
const captionPosition = document.getElementById('captionPosition');
const transcriptPreview = document.getElementById('transcriptPreview');

let isCapturing = false;

// Load saved settings
chrome.storage.local.get(['wsUrl', 'captionPosition'], (data) => {
  if (data.wsUrl) wsUrlInput.value = data.wsUrl;
  if (data.captionPosition) captionPosition.value = data.captionPosition;
  checkStatus();
});

// Save settings on change
wsUrlInput.addEventListener('change', () => {
  chrome.storage.local.set({ wsUrl: wsUrlInput.value });
});

captionPosition.addEventListener('change', () => {
  chrome.storage.local.set({ captionPosition: captionPosition.value });
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { 
        type: 'SET_POSITION', 
        position: captionPosition.value 
      }).catch(() => {});
    }
  });
});

async function checkStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
    if (response) {
      isCapturing = response.capturing;
      updateUI(response.capturing);
      if (response.lastTranscript) {
        transcriptPreview.textContent = response.lastTranscript;
      }
    }
  } catch (e) {
    updateUI(false);
  }
}

function updateUI(capturing) {
  statusDot.className = 'status-dot';
  if (capturing) {
    statusDot.classList.add('capturing');
    statusText.textContent = 'Capturing & Transcribing';
  } else {
    statusText.textContent = 'Ready';
  }
  
  startBtn.disabled = capturing;
  stopBtn.disabled = !capturing;
  isCapturing = capturing;
}

// Start capture
startBtn.addEventListener('click', async () => {
  const wsUrl = wsUrlInput.value;
  chrome.storage.local.set({ wsUrl });
  statusText.textContent = 'Starting...';
  
  try {
    const result = await chrome.runtime.sendMessage({ 
      type: 'START_CAPTURE_REQUEST',
      wsUrl: wsUrl
    });
    
    if (result && result.success) {
      updateUI(true);
    } else {
      statusText.textContent = result?.error || 'Failed to start';
    }
  } catch (e) {
    statusText.textContent = 'Error: ' + e.message;
  }
});

// Stop capture
stopBtn.addEventListener('click', async () => {
  try {
    await chrome.runtime.sendMessage({ type: 'STOP_CAPTURE_REQUEST' });
    updateUI(false);
  } catch (e) {
    console.error('Stop error:', e);
  }
});

// Listen for updates
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'TRANSCRIPT_UPDATE') {
    transcriptPreview.textContent = message.text;
    transcriptPreview.scrollTop = transcriptPreview.scrollHeight;
  } else if (message.type === 'STATUS_UPDATE') {
    updateUI(message.capturing);
  }
});

// Initial UI
checkStatus();
startBtn.disabled = false;