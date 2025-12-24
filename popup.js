// popup.js - UI for Web Speech + Gemini Nano captions

const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const speechLang = document.getElementById('speechLang');
const translateTo = document.getElementById('translateTo');
const captionPosition = document.getElementById('captionPosition');
const transcriptPreview = document.getElementById('transcriptPreview');
const warning = document.getElementById('warning');

let isCapturing = false;

// Load saved settings
chrome.storage.local.get(['speechLang', 'translateTo', 'captionPosition'], (data) => {
  if (data.speechLang) speechLang.value = data.speechLang;
  if (data.translateTo) translateTo.value = data.translateTo;
  if (data.captionPosition) captionPosition.value = data.captionPosition;
  checkStatus();
});

// Save settings
speechLang.addEventListener('change', () => {
  chrome.storage.local.set({ speechLang: speechLang.value });
});

translateTo.addEventListener('change', () => {
  chrome.storage.local.set({ translateTo: translateTo.value });
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
      if (response.warning) {
        showWarning(response.warning);
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
    statusText.textContent = 'Listening...';
  } else {
    statusDot.classList.add('ready');
    statusText.textContent = 'Ready';
  }
  
  startBtn.disabled = capturing;
  stopBtn.disabled = !capturing;
  isCapturing = capturing;
}

function showWarning(msg) {
  warning.textContent = msg;
  warning.classList.add('show');
}

// Start capture
startBtn.addEventListener('click', async () => {
  const lang = speechLang.value;
  const translate = translateTo.value;
  chrome.storage.local.set({ speechLang: lang, translateTo: translate });
  
  statusText.textContent = 'Starting...';
  warning.classList.remove('show');
  
  try {
    const result = await chrome.runtime.sendMessage({ 
      type: 'START_CAPTURE',
      speechLang: lang,
      translateTo: translate
    });
    
    if (result && result.success) {
      updateUI(true);
    } else {
      statusText.textContent = 'Ready';
      showWarning(result?.error || 'Failed to start');
    }
  } catch (e) {
    statusText.textContent = 'Ready';
    showWarning('Error: ' + e.message);
  }
});

// Stop
stopBtn.addEventListener('click', async () => {
  try {
    await chrome.runtime.sendMessage({ type: 'STOP_CAPTURE' });
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
  } else if (message.type === 'WARNING') {
    showWarning(message.text);
  }
});

checkStatus();
