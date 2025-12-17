#!/usr/bin/env python3
"""
Real-time Whisper transcription backend for Chrome extension.
Optimized for Ryzen 5800X (8c/16t) CPU.

Usage:
    python server.py [--model MODEL] [--port PORT]

Example:
    python server.py --model small.en --port 8765
"""

import asyncio
import json
import argparse
import logging
import numpy as np
from collections import deque
from typing import Optional
import websockets
from websockets.server import WebSocketServerProtocol

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger(__name__)

# Lazy imports for faster startup
_whisper_model = None
_vad_model = None

def get_whisper_model(model_size: str):
    """Lazy load Whisper model."""
    global _whisper_model
    if _whisper_model is None:
        from faster_whisper import WhisperModel
        logger.info(f"Loading Whisper model: {model_size}")
        
        # Optimize for 5800X: use 8 threads, int8 quantization
        _whisper_model = WhisperModel(
            model_size,
            device="cpu",
            compute_type="int8",  # Faster on CPU
            cpu_threads=8,        # Match 5800X cores
            num_workers=2
        )
        logger.info("Whisper model loaded")
    return _whisper_model

def get_vad_model():
    """Lazy load Silero VAD model."""
    global _vad_model
    if _vad_model is None:
        import torch
        logger.info("Loading Silero VAD model...")
        model, utils = torch.hub.load(
            repo_or_dir='snakers4/silero-vad',
            model='silero_vad',
            force_reload=False,
            onnx=True  # ONNX is faster on CPU
        )
        _vad_model = (model, utils)
        logger.info("VAD model loaded")
    return _vad_model

class AudioBuffer:
    """
    Manages audio buffering with VAD-based chunking.
    Accumulates audio until speech segment detected, then transcribes.
    """
    
    def __init__(
        self,
        sample_rate: int = 16000,
        min_speech_ms: int = 500,      # Minimum speech duration to transcribe
        max_speech_ms: int = 10000,    # Force transcribe after this duration
        silence_ms: int = 500,         # Silence duration to end segment
        overlap_ms: int = 200          # Overlap for context
    ):
        self.sample_rate = sample_rate
        self.min_speech_samples = int(sample_rate * min_speech_ms / 1000)
        self.max_speech_samples = int(sample_rate * max_speech_ms / 1000)
        self.silence_samples = int(sample_rate * silence_ms / 1000)
        self.overlap_samples = int(sample_rate * overlap_ms / 1000)
        
        self.buffer = deque(maxlen=int(sample_rate * 30))  # 30s max buffer
        self.speech_buffer = []
        self.is_speaking = False
        self.silence_count = 0
        self.vad_threshold = 0.5
        
        # VAD state
        self.vad_model = None
        self.vad_utils = None
        self.vad_iterator = None
        
    def init_vad(self):
        """Initialize VAD on first use."""
        if self.vad_model is None:
            self.vad_model, self.vad_utils = get_vad_model()
            (get_speech_timestamps, _, read_audio, *_) = self.vad_utils
            self.get_speech_timestamps = get_speech_timestamps
    
    def add_audio(self, audio_int16: np.ndarray) -> Optional[np.ndarray]:
        """
        Add audio chunk and return speech segment if ready for transcription.
        Returns None if not ready yet.
        """
        self.init_vad()
        
        # Convert int16 to float32
        audio_float = audio_int16.astype(np.float32) / 32768.0
        
        # Add to buffer
        self.buffer.extend(audio_float)
        
        # Simple energy-based VAD for real-time (Silero VAD for segments)
        energy = np.sqrt(np.mean(audio_float ** 2))
        is_speech = energy > 0.01  # Adjust threshold as needed
        
        if is_speech:
            self.speech_buffer.extend(audio_float)
            self.silence_count = 0
            self.is_speaking = True
        elif self.is_speaking:
            self.silence_count += len(audio_float)
            self.speech_buffer.extend(audio_float)  # Include trailing silence
            
            # Check if speech segment ended
            if self.silence_count >= self.silence_samples:
                if len(self.speech_buffer) >= self.min_speech_samples:
                    segment = np.array(self.speech_buffer)
                    # Keep overlap for next segment
                    self.speech_buffer = list(segment[-self.overlap_samples:])
                    self.is_speaking = False
                    self.silence_count = 0
                    return segment
                else:
                    # Too short, discard
                    self.speech_buffer = []
                    self.is_speaking = False
                    self.silence_count = 0
        
        # Force transcribe if too long
        if len(self.speech_buffer) >= self.max_speech_samples:
            segment = np.array(self.speech_buffer)
            self.speech_buffer = list(segment[-self.overlap_samples:])
            return segment
        
        return None
    
    def flush(self) -> Optional[np.ndarray]:
        """Flush any remaining audio."""
        if len(self.speech_buffer) >= self.min_speech_samples:
            segment = np.array(self.speech_buffer)
            self.speech_buffer = []
            return segment
        return None


class TranscriptionServer:
    """WebSocket server for real-time transcription."""
    
    def __init__(self, model_size: str = "small.en", port: int = 8765):
        self.model_size = model_size
        self.port = port
        self.model = None
        self.clients = set()
        
    async def start(self):
        """Start the WebSocket server."""
        # Pre-load model
        logger.info("Pre-loading models...")
        self.model = get_whisper_model(self.model_size)
        get_vad_model()  # Pre-load VAD too
        
        logger.info(f"Starting server on ws://127.0.0.1:{self.port}")
        async with websockets.serve(
            self.handle_client,
            "127.0.0.1",
            self.port,
            ping_interval=30,
            ping_timeout=10,
            max_size=10 * 1024 * 1024  # 10MB max message
        ):
            logger.info("Server ready! Waiting for connections...")
            await asyncio.Future()  # Run forever
    
    async def handle_client(self, websocket: WebSocketServerProtocol):
        """Handle a single client connection."""
        client_id = id(websocket)
        self.clients.add(websocket)
        logger.info(f"Client {client_id} connected")
        
        audio_buffer = AudioBuffer()
        sample_rate = 16000
        
        try:
            async for message in websocket:
                # Handle config message
                if isinstance(message, str):
                    try:
                        data = json.loads(message)
                        if data.get('type') == 'config':
                            sample_rate = data.get('sampleRate', 16000)
                            logger.info(f"Client config: sample_rate={sample_rate}")
                    except json.JSONDecodeError:
                        pass
                    continue
                
                # Handle binary audio data
                if isinstance(message, bytes):
                    # Convert bytes to int16 numpy array
                    audio_int16 = np.frombuffer(message, dtype=np.int16)
                    
                    # Process through buffer
                    segment = audio_buffer.add_audio(audio_int16)
                    
                    if segment is not None:
                        # Transcribe segment
                        text = await self.transcribe(segment)
                        if text:
                            await websocket.send(json.dumps({
                                'type': 'transcript',
                                'text': text,
                                'is_final': True
                            }))
            
            # Flush remaining audio on disconnect
            segment = audio_buffer.flush()
            if segment is not None:
                text = await self.transcribe(segment)
                if text:
                    await websocket.send(json.dumps({
                        'type': 'transcript',
                        'text': text,
                        'is_final': True
                    }))
                    
        except websockets.exceptions.ConnectionClosed:
            logger.info(f"Client {client_id} disconnected")
        except Exception as e:
            logger.error(f"Error handling client {client_id}: {e}")
        finally:
            self.clients.discard(websocket)
    
    async def transcribe(self, audio: np.ndarray) -> str:
        """Transcribe audio segment using faster-whisper."""
        try:
            # Run in thread pool to not block event loop
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None,
                self._transcribe_sync,
                audio
            )
            return result
        except Exception as e:
            logger.error(f"Transcription error: {e}")
            return ""
    
    def _transcribe_sync(self, audio: np.ndarray) -> str:
        """Synchronous transcription (runs in thread pool)."""
        segments, info = self.model.transcribe(
            audio,
            beam_size=3,           # Smaller beam = faster
            best_of=1,
            temperature=0.0,       # Greedy decoding = faster
            condition_on_previous_text=False,
            vad_filter=True,       # Use built-in VAD
            vad_parameters={
                "min_silence_duration_ms": 300
            }
        )
        
        # Collect all text
        text_parts = []
        for segment in segments:
            text_parts.append(segment.text.strip())
        
        return " ".join(text_parts)


def main():
    parser = argparse.ArgumentParser(
        description="Real-time Whisper transcription server"
    )
    parser.add_argument(
        "--model", "-m",
        default="small.en",
        choices=["tiny", "tiny.en", "base", "base.en", "small", "small.en", 
                 "medium", "medium.en", "large-v2", "large-v3"],
        help="Whisper model to use (default: small.en)"
    )
    parser.add_argument(
        "--port", "-p",
        type=int,
        default=8765,
        help="WebSocket server port (default: 8765)"
    )
    
    args = parser.parse_args()
    
    logger.info(f"Configuration: model={args.model}, port={args.port}")
    
    server = TranscriptionServer(
        model_size=args.model,
        port=args.port
    )
    
    try:
        asyncio.run(server.start())
    except KeyboardInterrupt:
        logger.info("Server stopped")


if __name__ == "__main__":
    main()