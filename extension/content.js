// content.js - Caption overlay on web pages

(function() {
	// Prevent double injection
	if (window.__whisperCaptionsInjected) return;
	window.__whisperCaptionsInjected = true;
  
	let captionContainer = null;
	let captionText = null;
	let fadeTimeout = null;
	let hideTimeout = null;
	let position = 'bottom';
	
	function createCaptionOverlay() {
	  // Remove any existing overlay first
	  const existing = document.getElementById('whisper-caption-container');
	  if (existing) {
		existing.remove();
	  }
	  
	  captionContainer = document.createElement('div');
	  captionContainer.id = 'whisper-caption-container';
	  captionContainer.className = `whisper-caption-${position}`;
	  
	  captionText = document.createElement('div');
	  captionText.id = 'whisper-caption-text';
	  
	  captionContainer.appendChild(captionText);
	  document.body.appendChild(captionContainer);
	}
	
	function showCaption(text, isFinal) {
	  if (!captionContainer || !document.body.contains(captionContainer)) {
		createCaptionOverlay();
	  }
	  
	  // Don't show empty text
	  if (!text || !text.trim()) {
		return;
	  }
	  
	  captionText.textContent = text;
	  captionText.className = isFinal ? 'final' : 'partial';
	  captionContainer.classList.add('visible');
	  
	  // Clear previous timeouts
	  if (fadeTimeout) {
		clearTimeout(fadeTimeout);
		fadeTimeout = null;
	  }
	  if (hideTimeout) {
		clearTimeout(hideTimeout);
		hideTimeout = null;
	  }
	  
	  // Auto-fade after 3 seconds of no updates
	  fadeTimeout = setTimeout(() => {
		if (captionContainer) {
		  captionContainer.classList.remove('visible');
		}
	  }, 3000);
	  
	  // Fully hide after 5 seconds (cleanup)
	  hideTimeout = setTimeout(() => {
		hideCaption();
	  }, 5000);
	}
	
	function hideCaption() {
	  if (fadeTimeout) {
		clearTimeout(fadeTimeout);
		fadeTimeout = null;
	  }
	  if (hideTimeout) {
		clearTimeout(hideTimeout);
		hideTimeout = null;
	  }
	  
	  if (captionContainer) {
		captionContainer.classList.remove('visible');
		// Fully remove after fade animation
		setTimeout(() => {
		  if (captionContainer && captionContainer.parentNode) {
			captionContainer.remove();
			captionContainer = null;
			captionText = null;
		  }
		}, 300);
	  }
	}
	
	function setPosition(newPosition) {
	  position = newPosition;
	  if (captionContainer) {
		captionContainer.className = `whisper-caption-${position}`;
		if (captionContainer.classList.contains('visible')) {
		  captionContainer.classList.add('visible');
		}
	  }
	}
	
	// Listen for messages from background
	chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
	
	// Load saved position
	chrome.storage.local.get(['captionPosition'], (data) => {
	  if (data.captionPosition) {
		position = data.captionPosition;
	  }
	});
	
	// Cleanup on page unload
	window.addEventListener('beforeunload', () => {
	  hideCaption();
	});
	
	console.log('Whisper Captions loaded');
  })();