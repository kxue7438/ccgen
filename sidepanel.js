let stream = null;
let audioContext = null;
let mediaRecorder = null;
let audioChunks = [];

document.getElementById('start').addEventListener('click', startCapture);
document.getElementById('stop').addEventListener('click', stopCapture);

chrome.runtime.onMessage.addListener((msg) => {
	if (msg.action === 'START_CAPTURE') {
		startCapture();
	}
});

function startCapture() {
	updateStatus('🎵 Starting capture...');

	chrome.tabCapture.capture(
		{ audio: true, video: false },
		(capturedStream) => {
			if (chrome.runtime.lastError) {
				updateStatus('❌ ' + chrome.runtime.lastError.message);
				console.error(chrome.runtime.lastError);
				return;
			}

			stream = capturedStream;

			// Play audio back
			audioContext = new AudioContext();
			const source = audioContext.createMediaStreamSource(stream);
			source.connect(audioContext.destination);

			// Start transcription
			startTranscription(stream);

			updateStatus('✅ Playing audio & transcribing!');
		}
	);
}

function startTranscription(stream) {
	mediaRecorder = new MediaRecorder(stream, {
		mimeType: 'audio/webm;codecs=opus'
	});

	audioChunks = [];

	mediaRecorder.ondataavailable = (event) => {
		if (event.data.size > 0) {
			audioChunks.push(event.data);
		}
	};

	mediaRecorder.onstop = async () => {
		if (audioChunks.length > 0) {
			const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
			await transcribeAudio(audioBlob);
			audioChunks = [];

			// Restart recording if still active
			if (stream && stream.active && mediaRecorder) {
				mediaRecorder.start();
				setTimeout(() => {
					if (mediaRecorder && mediaRecorder.state === 'recording') {
						mediaRecorder.stop();
					}
				}, 5000); // Transcribe every 5 seconds
			}
		}
	};

	// Start recording
	mediaRecorder.start();

	// Stop and process every 5 seconds
	setTimeout(() => {
		if (mediaRecorder && mediaRecorder.state === 'recording') {
			mediaRecorder.stop();
		}
	}, 5000);
}

async function transcribeAudio(audioBlob) {
	try {
		updateStatus('🔄 Transcribing...');

		// Get API key from storage
		const { assemblyApiKey } = await chrome.storage.sync.get(['assemblyApiKey']);

		if (!assemblyApiKey) {
			throw new Error('Please set your AssemblyAI API key in extension settings');
		}

		// Step 1: Upload audio file
		const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
			method: 'POST',
			headers: {
				'authorization': assemblyApiKey
			},
			body: audioBlob
		});

		const { upload_url } = await uploadResponse.json();

		// Step 2: Request transcription
		const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
			method: 'POST',
			headers: {
				'authorization': assemblyApiKey,
				'content-type': 'application/json'
			},
			body: JSON.stringify({
				audio_url: upload_url
			})
		});

		const { id } = await transcriptResponse.json();

		// Step 3: Poll for result
		let transcript = null;
		while (!transcript || transcript.status !== 'completed') {
			await new Promise(resolve => setTimeout(resolve, 1000));

			const pollingResponse = await fetch(
				`https://api.assemblyai.com/v2/transcript/${id}`,
				{
					headers: {
						'authorization': assemblyApiKey
					}
				}
			);

			transcript = await pollingResponse.json();

			if (transcript.status === 'error') {
				throw new Error(transcript.error);
			}
		}

		if (transcript.text) {
			addTranscript(transcript.text, true);
			updateStatus('✅ Playing audio & transcribing!');
		}

	} catch (error) {
		console.error('Transcription error:', error);
		addTranscript('❌ Error: ' + error.message, false);
		updateStatus('⚠️ Transcription error');
	}
}

function addTranscript(text, isFinal) {
	const transcriptDiv = document.getElementById('transcripts');
	const p = document.createElement('p');
	const timestamp = new Date().toLocaleTimeString();
	p.innerHTML = `<span style="color: #666; font-size: 12px;">[${timestamp}]</span> ${text}`;
	p.className = isFinal ? 'final' : 'interim';
	transcriptDiv.appendChild(p);
	transcriptDiv.scrollTop = transcriptDiv.scrollHeight;
}

function stopCapture() {
	if (mediaRecorder && mediaRecorder.state === 'recording') {
		mediaRecorder.stop();
		mediaRecorder = null;
	}
	if (audioContext) {
		audioContext.close();
		audioContext = null;
	}
	if (stream) {
		stream.getTracks().forEach(t => t.stop());
		stream = null;
	}
	audioChunks = [];
	updateStatus('⏹️ Stopped');
}

function updateStatus(text) {
	document.getElementById('status').textContent = text;
}