#!/usr/bin/env bash
# Generates one narration clip per segment with ElevenLabs and records durations.
# Usage: demo/tts.sh <out-dir>   (ELEVENLABS key is injected by the environment proxy)
set -euo pipefail
OUT=${1:?out dir}; mkdir -p "$OUT"
DIR=$(cd "$(dirname "$0")" && pwd)
VOICE=$(python3 -c "import json;print(json.load(open('$DIR/narration.json'))['voiceId'])")
python3 - "$DIR/narration.json" "$OUT" "$VOICE" <<'PY'
import json, subprocess, sys
spec, out, voice = sys.argv[1], sys.argv[2], sys.argv[3]
segs = json.load(open(spec))["segments"]
durations = {}
for s in segs:
    raw = f"{out}/{s['id']}.raw.mp3"
    path = f"{out}/{s['id']}.wav"
    body = json.dumps({"text": s["text"], "model_id": "eleven_multilingual_v2",
                       "voice_settings": {"stability": 0.55, "similarity_boost": 0.72, "style": 0.0, "use_speaker_boost": False}})
    subprocess.run(["curl", "-s", "-f", "-X", "POST",
                    f"https://api.elevenlabs.io/v1/text-to-speech/{voice}?output_format=mp3_44100_128",
                    "-H", "xi-api-key: proxy-injected", "-H", "Content-Type: application/json",
                    "-d", body, "-o", raw], check=True)
    # Even loudness with headroom: no clipping or crackle after encoding.
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", raw, "-af",
                    "highpass=f=70,loudnorm=I=-16:TP=-3:LRA=7,aresample=48000,"
                    "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.04,areverse,"
                    "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08,areverse",
                    "-ac", "2", "-c:a", "pcm_s16le", path], check=True)
    d = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path]).strip())
    durations[s["id"]] = d
    print(f"{s['id']} {d:5.2f}s  {s['text'][:60]}")
json.dump(durations, open(f"{out}/durations.json", "w"), indent=1)
print("total", round(sum(durations.values()), 1), "s")
PY
