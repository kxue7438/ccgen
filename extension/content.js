// content.js - Caption overlay on web pages

(function() {
	// Prevent double injection
	if (window.__whisperCaptionsInjected) return;
	window.__whisperCaptionsInjected = true;
  
	let captionContainer = null;
	let captionText = null;
	let fadeTimeout = null;
	let position = 'bottom';
	
	function createCaptionOverlay() {
	  if (captionContainer) return;
	  
	  captionContainer = document.createElement('div');
	  captionContainer.id = 'whisper-caption-container';
	  captionContainer.className = `whisper-caption-${position}`;
	  
	  captionText = document.createElement('div');
	  captionText.id = 'whisper-caption-text';
	  
	  captionContainer.appendChild(captionText);
	  document.body.appendChild(captionContainer);
	}
	
	function showCaption(text, isFinal) {
	  if (!captionContainer) createCaptionOverlay();
	  
	  captionText.textContent = text;
	  captionText.className = isFinal ? 'final' : 'partial';
	  captionContainer.classList.add('visible');
	  
	  // Clear previous fade timeout
	  if (fadeTimeout) {
		clearTimeout(fadeTimeout);
		fadeTimeout = null;
	  }
	  
	  // Auto-fade after 4 seconds of no updates (only for final)
	  if (isFinal) {
		fadeTimeout = setTimeout(() => {
		  captionContainer.classList.remove('visible');
		}, 4000);
	  }
	}
	
	function hideCaption() {
	  if (captionContainer) {
		captionContainer.classList.remove('visible');
	  }
	  if (fadeTimeout) {
		clearTimeout(fadeTimeout);
		fadeTimeout = null;
	  }
	}
	
	function setPosition(newPosition) {
	  position = newPosition;
	  if (captionContainer) {
		captionContainer.className = `whisper-caption-${position}`;
		captionContainer.classList.add('visible');
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
	
	console.log('Whisper Captions content script loaded');
  })();