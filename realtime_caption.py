import subprocess
import json
import threading
import tkinter as tk
from transformers import MarianMTModel, MarianTokenizer

# — 1. Translation setup — 
# Swap in the model for your target language:
# e.g. "Helsinki-NLP/opus-mt-en-es" for English→Spanish
MODEL_NAME = "Helsinki-NLP/opus-mt-en-es"
tokenizer = MarianTokenizer.from_pretrained(MODEL_NAME)
mt_model = MarianMTModel.from_pretrained(MODEL_NAME)

def translate(text: str) -> str:
    batch = tokenizer([text], return_tensors="pt", padding=True)
    gen = mt_model.generate(**batch)
    return tokenizer.batch_decode(gen, skip_special_tokens=True)[0]

# — 2. GUI overlay — 
root = tk.Tk()
root.title("Live Translated Captions")
root.attributes("-topmost", True)
root.config(bg="black")
label = tk.Label(root,
                 text="Initializing…",
                 font=("Helvetica", 24),
                 fg="white",
                 bg="black",
                 wraplength=800,
                 justify="left")
label.pack(padx=20, pady=20)

# Thread-safe way to update the label
def display(text: str):
    root.after(0, label.config, {"text": text})

# — 3. Spawn whisper.cpp in stream mode — 
def transcribe_and_translate():
    # Assumes ./main is your whisper.cpp binary and 
    # models/ggml-base.en.bin is next to it.
    proc = subprocess.Popen(
        ["./main", "-m", "models/ggml-base.en.bin", "--stream"],
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        text=True,
        bufsize=1,
    )
    for line in proc.stdout:
        line = line.strip()
        if not line.startswith("{"):
            continue
        obj = json.loads(line)
        txt = obj.get("text", "").strip()
        if txt:
            tr = translate(txt)
            display(tr)

# — 4. Start the worker thread & GUI loop — 
threading.Thread(target=transcribe_and_translate, daemon=True).start()
root.mainloop()

