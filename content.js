// content.js - Caption overlay

(function() {
  if (window.__captionsInjected) return;
  window.__captionsInjected = true;

  let captionContainer = null;
  let captionText = null;
  let fadeTimeout = null;
  let position = 'bottom';
  
  function createOverlay() {
    const existing = document.getElementById('caption-container');
    if (existing) existing.remove();
    
    captionContainer = document.createElement('div');
    captionContainer.id = 'caption-container';
    captionContainer.className = `caption-${position}`;
    
    captionText = document.createElement('div');
    captionText.id = 'caption-text';
    
    captionContainer.appendChild(captionText);
    document.body.appendChild(captionContainer);
  }
  
  function showCaption(text, isFinal) {
    if (!captionContainer || !document.body.contains(captionContainer)) {
      createOverlay();
    }
    
    if (!text || !text.trim()) return;
    
    captionText.textContent = text;
    captionText.className = isFinal ? 'final' : 'partial';
    captionContainer.classList.add('visible');
    
    if (fadeTimeout) {
      clearTimeout(fadeTimeout);
      fadeTimeout = null;
    }
    
    if (isFinal) {
      fadeTimeout = setTimeout(() => {
        if (captionContainer) {
          captionContainer.classList.remove('visible');
        }
      }, 4000);
    }
  }
  
  function hideCaption() {
    if (fadeTimeout) {
      clearTimeout(fadeTimeout);
      fadeTimeout = null;
    }
    if (captionContainer) {
      captionContainer.classList.remove('visible');
    }
  }
  
  function setPosition(newPosition) {
    position = newPosition;
    if (captionContainer) {
      captionContainer.className = `caption-${position}`;
      if (captionText.textContent) {
        captionContainer.classList.add('visible');
      }
    }
  }
  
  chrome.runtime.onMessage.addListener((message) => {
    switch (message.type) {
      case 'SHOW_CAPTION':
        showCaption(message.text, message.isFinal);
        break;
      case 'HIDE_CAPTION':
        hideCaption();
        break;
      case 'SET_POSITION':
        setPosition(message.position);
        break;
    }
  });
  
  chrome.storage.local.get(['captionPosition'], (data) => {
    if (data.captionPosition) position = data.captionPosition;
  });
})();
