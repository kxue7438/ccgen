// offscreen.js - Web Speech API recognition + Gemini Nano translation

let recognition = null;
let mediaStream = null;
let audioContext = null;
let isCapturing = false;
let currentTabId = null;
let translator = null;
let translateTo = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'OFFSCREEN_START':
      startCapture(message.streamId, message.tabId, message.speechLang, message.translateTo)
        .then(result => sendResponse(result));
      return true;
      
    case 'OFFSCREEN_STOP':
      stopCapture();
      sendResponse({ success: true });
      break;
  }
});

async function startCapture(streamId, tabId, speechLang, targetLang) {
  try {
    currentTabId = tabId;
    translateTo = targetLang;
    
    // Initialize Gemini Nano translator if needed
    if (translateTo) {
      await initTranslator(translateTo);
    }
    
    // Get media stream from tab
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId
        }
      }
    });
    
    mediaStream = stream;
    
    // Play audio so we can hear it
    audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(audioContext.destination);
    
    // Set up Web Speech API
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      return { success: false, error: 'Speech Recognition not supported' };
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = speechLang || 'en-US';
    recognition.maxAlternatives = 1;
    
    recognition.onresult = async (event) => {
      let finalTranscript = '';
      let interimTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }
      
      // Send interim results immediately
      if (interimTranscript) {
        const text = translateTo ? await translate(interimTranscript) : interimTranscript;
        sendTranscript(text, false);
      }
      
      // Send final results
      if (finalTranscript) {
        const text = translateTo ? await translate(finalTranscript) : finalTranscript;
        sendTranscript(text, true);
      }
    };
    
    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'no-speech') {
        // Restart on no-speech
        if (isCapturing) {
          try { recognition.start(); } catch (e) {}
        }
      } else if (event.error === 'audio-capture') {
        chrome.runtime.sendMessage({
          type: 'OFFSCREEN_WARNING',
          text: 'Audio capture failed. Try refreshing the page.'
        });
      }
    };
    
    recognition.onend = () => {
      // Auto-restart if still capturing
      if (isCapturing) {
        try { recognition.start(); } catch (e) {}
      }
    };
    
    recognition.start();
    isCapturing = true;
    
    return { success: true };
    
  } catch (e) {
    console.error('Start error:', e);
    stopCapture();
    return { success: false, error: e.message };
  }
}

function stopCapture() {
  isCapturing = false;
  
  if (recognition) {
    try { recognition.stop(); } catch (e) {}
    recognition = null;
  }
  
  if (audioContext) {
    try { audioContext.close(); } catch (e) {}
    audioContext = null;
  }
  
  if (mediaStream) {
    mediaStream.getTracks().forEach(t => t.stop());
    mediaStream = null;
  }
  
  translator = null;
}

function sendTranscript(text, isFinal) {
  chrome.runtime.sendMessage({
    type: 'TRANSCRIPT',
    text: text,
    isFinal: isFinal,
    tabId: currentTabId
  });
}

// Gemini Nano Translation
async function initTranslator(targetLang) {
  try {
    // Check if translation API is available
    if (!('translation' in self) && !('ai' in self)) {
      chrome.runtime.sendMessage({
        type: 'OFFSCREEN_WARNING',
        text: 'Gemini Nano not available. Showing original text.'
      });
      translateTo = null;
      return;
    }
    
    // Try the new Translator API (Chrome 128+)
    if ('translation' in self) {
      const canTranslate = await translation.canTranslate({
        sourceLanguage: 'en',
        targetLanguage: targetLang
      });
      
      if (canTranslate === 'no') {
        chrome.runtime.sendMessage({
          type: 'OFFSCREEN_WARNING',
          text: `Translation to ${targetLang} not available.`
        });
        translateTo = null;
        return;
      }
      
      translator = await translation.createTranslator({
        sourceLanguage: 'en',
        targetLanguage: targetLang
      });
      
      console.log('Translator initialized:', targetLang);
      return;
    }
    
    // Fallback: Try window.ai (older API)
    if ('ai' in self && 'languageModel' in self.ai) {
      // Use language model for translation
      translator = {
        type: 'languageModel',
        targetLang: targetLang
      };
      console.log('Using AI Language Model for translation');
      return;
    }
    
    translateTo = null;
    
  } catch (e) {
    console.error('Translator init error:', e);
    chrome.runtime.sendMessage({
      type: 'OFFSCREEN_WARNING',
      text: 'Translation unavailable: ' + e.message
    });
    translateTo = null;
  }
}

async function translate(text) {
  if (!translator || !text.trim()) return text;
  
  try {
    // Native Translator API
    if (translator.translate) {
      return await translator.translate(text);
    }
    
    // Language Model fallback
    if (translator.type === 'languageModel') {
      const session = await self.ai.languageModel.create({
        systemPrompt: `You are a translator. Translate the following text to ${translator.targetLang}. Only output the translation, nothing else.`
      });
      const result = await session.prompt(text);
      session.destroy();
      return result;
    }
    
    return text;
  } catch (e) {
    console.error('Translation error:', e);
    return text;
  }
}
