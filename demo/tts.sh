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
    path = f"{out}/{s['id']}.mp3"
    body = json.dumps({"text": s["text"], "model_id": "eleven_multilingual_v2",
                       "voice_settings": {"stability": 0.5, "similarity_boost": 0.85, "style": 0.15, "use_speaker_boost": True}})
    subprocess.run(["curl", "-s", "-f", "-X", "POST",
                    f"https://api.elevenlabs.io/v1/text-to-speech/{voice}?output_format=mp3_44100_128",
                    "-H", "xi-api-key: proxy-injected", "-H", "Content-Type: application/json",
                    "-d", body, "-o", path], check=True)
    d = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path]).strip())
    durations[s["id"]] = d
    print(f"{s['id']} {d:5.2f}s  {s['text'][:60]}")
json.dump(durations, open(f"{out}/durations.json", "w"), indent=1)
print("total", round(sum(durations.values()), 1), "s")
PY
