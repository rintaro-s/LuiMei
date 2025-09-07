#!/usr/bin/env python3
import sys
import json
import wave
import os

try:
    from vosk import Model, KaldiRecognizer
except Exception as e:
    print(json.dumps({"error": "vosk_import_failed", "message": str(e)}))
    sys.exit(1)

def transcribe(wav_path, model_path, sample_rate=16000):
    if not os.path.exists(model_path):
        return {"error": "model_not_found", "message": f"Model not found at {model_path}"}

    wf = wave.open(wav_path, 'rb')
    if wf.getnchannels() != 1 or wf.getsampwidth() != 2:
        return {"error": "invalid_wav", "message": "WAV must be mono PCM16"}

    model = Model(model_path)
    rec = KaldiRecognizer(model, sample_rate)

    results = []
    while True:
        data = wf.readframes(4000)
        if len(data) == 0:
            break
        if rec.AcceptWaveform(data):
            results.append(json.loads(rec.Result()))
    final = json.loads(rec.FinalResult())
    results.append(final)

    # Join texts
    full_text = ' '.join([r.get('text','') for r in results if isinstance(r, dict)])
    return {"text": full_text, "confidence": 0.85}

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(json.dumps({"error": "usage", "message": "vosk_stt.py <wav_path> <model_path> [sample_rate]"}))
        sys.exit(2)
    wav_path = sys.argv[1]
    model_path = sys.argv[2]
    sample_rate = int(sys.argv[3]) if len(sys.argv) > 3 else 16000
    res = transcribe(wav_path, model_path, sample_rate)
    print(json.dumps(res, ensure_ascii=False))
