// content.js - Caption overlay on web pages

(function() {
	// Prevent double injection
	if (window.__whisperCaptionsInjected) return;
	window.__whisperCaptionsInjected = true;

	let captionContainer = null;
	let position = 'bottom';
	let subtitleLines = []; // Array of {text: string, timestamp: number, element: HTMLElement}
	const LINE_DURATION = 5000; // 5 seconds per line
	let cleanupInterval = null;

	function createCaptionOverlay() {
	  // Remove any existing overlay first
	  const existing = document.getElementById('whisper-caption-container');
	  if (existing) {
		existing.remove();
	  }

	  captionContainer = document.createElement('div');
	  captionContainer.id = 'whisper-caption-container';
	  captionContainer.className = `whisper-caption-${position}`;

	  document.body.appendChild(captionContainer);

	  // Start cleanup interval
	  if (cleanupInterval) {
		clearInterval(cleanupInterval);
	  }
	  cleanupInterval = setInterval(removeExpiredLines, 100);
	}

	function removeExpiredLines() {
	  if (!captionContainer) return;

	  const now = Date.now();
	  const linesToRemove = [];

	  // Find expired lines
	  subtitleLines.forEach((line, index) => {
		if (now - line.timestamp >= LINE_DURATION) {
		  linesToRemove.push(index);
		}
	  });

	  // Remove expired lines from bottom to top (reverse order to maintain indices)
	  linesToRemove.reverse().forEach(index => {
		const line = subtitleLines[index];
		if (line.element && line.element.parentNode) {
		  line.element.classList.add('fade-out');
		  setTimeout(() => {
			if (line.element && line.element.parentNode) {
			  line.element.remove();
			}
		  }, 300);
		}
		subtitleLines.splice(index, 1);
	  });

	  // Hide container if no lines
	  if (subtitleLines.length === 0) {
		captionContainer.classList.remove('visible');
	  }
	}

	function showCaption(text, isFinal) {
	  if (!captionContainer || !document.body.contains(captionContainer)) {
		createCaptionOverlay();
	  }

	  // Don't show empty text
	  if (!text || !text.trim()) {
		return;
	  }

	  // Create new line element
	  const lineElement = document.createElement('div');
	  lineElement.className = 'caption-line';
	  lineElement.textContent = text;

	  // Add to container
	  captionContainer.appendChild(lineElement);
	  captionContainer.classList.add('visible');

	  // Add to tracking array
	  subtitleLines.push({
		text: text,
		timestamp: Date.now(),
		element: lineElement
	  });

	  // Limit to max 5 lines on screen
	  while (subtitleLines.length > 5) {
		const oldestLine = subtitleLines.shift();
		if (oldestLine.element && oldestLine.element.parentNode) {
		  oldestLine.element.classList.add('fade-out');
		  setTimeout(() => {
			if (oldestLine.element && oldestLine.element.parentNode) {
			  oldestLine.element.remove();
			}
		  }, 300);
		}
	  }
	}

	function hideCaption() {
	  if (cleanupInterval) {
		clearInterval(cleanupInterval);
		cleanupInterval = null;
	  }

	  if (captionContainer) {
		captionContainer.classList.remove('visible');
		// Fully remove after fade animation
		setTimeout(() => {
		  if (captionContainer && captionContainer.parentNode) {
			captionContainer.remove();
			captionContainer = null;
			subtitleLines = [];
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