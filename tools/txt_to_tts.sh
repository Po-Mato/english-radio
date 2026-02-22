#!/usr/bin/env bash
set -euo pipefail

CHANNEL="${1:-beginner}"
SCRIPT_DIR="scripts/${CHANNEL}"
OUT_DIR="assets/${CHANNEL}"
VOICE="${VOICE:-Samantha}"

mkdir -p "$OUT_DIR"

for txt in "$SCRIPT_DIR"/*.txt; do
  [ -f "$txt" ] || continue
  base="$(basename "$txt" .txt)"
  aiff="${OUT_DIR}/${base}.aiff"
  mp3="${OUT_DIR}/${base}.mp3"
  echo "[tts] $txt -> $mp3"
  say -v "$VOICE" -o "$aiff" "$(cat "$txt")"
  ffmpeg -y -i "$aiff" -ar 44100 -ac 2 -b:a 128k "$mp3" >/dev/null 2>&1
  rm -f "$aiff"
done

echo "done: $OUT_DIR"
