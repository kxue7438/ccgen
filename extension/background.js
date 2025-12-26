// background.js - Manages offscreen document and relays messages

let currentTabId = null;
let isCapturing = false;
let lastTranscript = '';

// Handle messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'START_CAPTURE_REQUEST':
      handleStartCapture(message.wsUrl)
        .then(result => sendResponse(result));
      return true;
      
    case 'STOP_CAPTURE_REQUEST':
      handleStopCapture().then(() => sendResponse({ success: true }));
      return true;
      
    case 'GET_STATUS':
      sendResponse({
        capturing: isCapturing,
        lastTranscript: lastTranscript
      });
      break;
      
    case 'TRANSCRIPT':
      lastTranscript = message.text;
      // Relay to content script
      if (message.tabId) {
        chrome.tabs.sendMessage(message.tabId, {
          type: 'SHOW_CAPTION',
          text: message.text,
          isFinal: message.isFinal
        }).catch(() => {});
      }
      // Relay to popup
      chrome.runtime.sendMessage({
        type: 'TRANSCRIPT_UPDATE',
        text: message.text,
        isFinal: message.isFinal
      }).catch(() => {});
      break;
      
    case 'CAPTURE_STOPPED':
      isCapturing = false;
      chrome.runtime.sendMessage({ type: 'STATUS_UPDATE', capturing: false }).catch(() => {});
      break;
  }
});

async function handleStartCapture(wsUrl) {
  try {
    // Stop any existing capture first
    await handleStopCapture();
    await closeOffscreen();
    
    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      return { success: false, error: 'No active tab' };
    }
    currentTabId = tab.id;
    
    // Inject content script
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ['captions.css']
      });
    } catch (e) {
      console.log('Script inject:', e.message);
    }
    
    // Get stream ID for tab capture
    const streamId = await chrome.tabCapture.getMediaStreamId({
      targetTabId: tab.id
    });
    
    // Create offscreen document if needed
    await setupOffscreen();
    
    // Start capture in offscreen document
    const result = await chrome.runtime.sendMessage({
      type: 'START_CAPTURE',
      wsUrl: wsUrl,
      streamId: streamId,
      tabId: tab.id
    });
    
    if (result.success) {
      isCapturing = true;
    }
    
    return result;
    
  } catch (e) {
    console.error('Start capture error:', e);
    return { success: false, error: e.message };
  }
}

async function handleStopCapture() {
  try {
    await chrome.runtime.sendMessage({ type: 'STOP_CAPTURE' });
    isCapturing = false;
    
    if (currentTabId) {
      chrome.tabs.sendMessage(currentTabId, { type: 'HIDE_CAPTION' }).catch(() => {});
    }
  } catch (e) {
    console.error('Stop error:', e);
  }
}

async function setupOffscreen() {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  });
  
  if (existingContexts.length > 0) {
    return;
  }
  
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['USER_MEDIA'],
    justification: 'Audio capture for transcription'
  });
}

async function closeOffscreen() {
  try {
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT']
    });
    
    if (existingContexts.length > 0) {
      await chrome.offscreen.closeDocument();
    }
  } catch (e) {
    // Ignore errors
  }
}