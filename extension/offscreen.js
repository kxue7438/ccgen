// offscreen.js - Handles audio capture and WebSocket in offscreen document

let ws = null;
let mediaStream = null;
let audioContext = null;
let processor = null;
let isCapturing = false;

const SAMPLE_RATE = 16000;
const CHUNK_SIZE = 4096;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'START_CAPTURE':
      startCapture(message.wsUrl, message.streamId, message.tabId)
        .then(result => sendResponse(result));
      return true;
      
    case 'STOP_CAPTURE':
      stopCapture();
      sendResponse({ success: true });
      break;
      
    case 'GET_STATUS':
      sendResponse({ 
        capturing: isCapturing,
        connected: ws && ws.readyState === WebSocket.OPEN
      });
      break;
  }
});

async function startCapture(wsUrl, streamId, tabId) {
  try {
    // Connect WebSocket
    const wsConnected = await connectWebSocket(wsUrl, tabId);
    if (!wsConnected) {
      return { success: false, error: 'Cannot connect to backend' };
    }
    
    // Get media stream from streamId
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId
        }
      }
    });
    
    mediaStream = stream;
    
    // Set up audio processing
    audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
    const source = audioContext.createMediaStreamSource(stream);
    processor = audioContext.createScriptProcessor(CHUNK_SIZE, 1, 1);
    
    processor.onaudioprocess = (e) => {
      if (!isCapturing || !ws || ws.readyState !== WebSocket.OPEN) return;
      
      const inputData = e.inputBuffer.getChannelData(0);
      
      // Convert to Int16
      const pcm16 = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        const s = Math.max(-1, Math.min(1, inputData[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      
      ws.send(pcm16.buffer);
    };
    
    source.connect(processor);
    processor.connect(audioContext.destination);
    
    isCapturing = true;
    return { success: true };
    
  } catch (e) {
    console.error('Capture error:', e);
    stopCapture();
    return { success: false, error: e.message };
  }
}

function connectWebSocket(url, tabId) {
  return new Promise((resolve) => {
    try {
      ws = new WebSocket(url);
      
      const timeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          ws.close();
          resolve(false);
        }
      }, 3000);
      
      ws.onopen = () => {
        clearTimeout(timeout);
        console.log('WebSocket connected');
        
        ws.send(JSON.stringify({
          type: 'config',
          sampleRate: SAMPLE_RATE
        }));
        
        resolve(true);
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'transcript') {
            // Send to background to relay to content script
            chrome.runtime.sendMessage({
              type: 'TRANSCRIPT',
              text: data.text,
              isFinal: data.is_final,
              tabId: tabId
            });
          }
        } catch (e) {
          console.error('Parse error:', e);
        }
      };
      
      ws.onerror = () => {
        console.error('WebSocket error');
        resolve(false);
      };
      
      ws.onclose = () => {
        console.log('WebSocket closed');
        isCapturing = false;
        chrome.runtime.sendMessage({ type: 'CAPTURE_STOPPED' });
      };
      
    } catch (e) {
      resolve(false);
    }
  });
}

function stopCapture() {
  console.log('Stopping capture...');
  isCapturing = false;
  
  if (processor) {
    try {
      processor.disconnect();
    } catch (e) {}
    processor = null;
  }
  
  if (audioContext) {
    try {
      audioContext.close();
    } catch (e) {}
    audioContext = null;
  }
  
  if (mediaStream) {
    try {
      mediaStream.getTracks().forEach(track => {
        track.stop();
        track.enabled = false;
      });
    } catch (e) {}
    mediaStream = null;
  }
  
  if (ws) {
    try {
      ws.close();
    } catch (e) {}
    ws = null;
  }
  
  console.log('Capture stopped');
}