// background.js - Manages offscreen document for Web Speech API

let currentTabId = null;
let isCapturing = false;
let lastTranscript = '';
let warningMsg = '';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'START_CAPTURE':
      handleStartCapture(message.speechLang, message.translateTo)
        .then(result => sendResponse(result));
      return true;
      
    case 'STOP_CAPTURE':
      handleStopCapture().then(() => sendResponse({ success: true }));
      return true;
      
    case 'GET_STATUS':
      sendResponse({
        capturing: isCapturing,
        lastTranscript: lastTranscript,
        warning: warningMsg
      });
      break;
      
    case 'TRANSCRIPT':
      lastTranscript = message.text;
      // Relay to content script
      if (currentTabId) {
        chrome.tabs.sendMessage(currentTabId, {
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
      
    case 'OFFSCREEN_WARNING':
      warningMsg = message.text;
      chrome.runtime.sendMessage({ type: 'WARNING', text: message.text }).catch(() => {});
      break;
  }
});

async function handleStartCapture(speechLang, translateTo) {
  try {
    await handleStopCapture();
    await closeOffscreen();
    warningMsg = '';
    
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
    
    // Get stream ID
    const streamId = await chrome.tabCapture.getMediaStreamId({
      targetTabId: tab.id
    });
    
    // Create offscreen document
    await setupOffscreen();
    
    // Start capture
    const result = await chrome.runtime.sendMessage({
      type: 'OFFSCREEN_START',
      streamId: streamId,
      tabId: tab.id,
      speechLang: speechLang,
      translateTo: translateTo
    });
    
    if (result && result.success) {
      isCapturing = true;
    }
    
    return result;
    
  } catch (e) {
    console.error('Start error:', e);
    return { success: false, error: e.message };
  }
}

async function handleStopCapture() {
  try {
    await chrome.runtime.sendMessage({ type: 'OFFSCREEN_STOP' });
  } catch (e) {}
  
  isCapturing = false;
  
  if (currentTabId) {
    chrome.tabs.sendMessage(currentTabId, { type: 'HIDE_CAPTION' }).catch(() => {});
  }
}

async function setupOffscreen() {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  });
  
  if (contexts.length > 0) return;
  
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['USER_MEDIA', 'AUDIO_PLAYBACK'],
    justification: 'Speech recognition from tab audio'
  });
}

async function closeOffscreen() {
  try {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT']
    });
    if (contexts.length > 0) {
      await chrome.offscreen.closeDocument();
    }
  } catch (e) {}
}
