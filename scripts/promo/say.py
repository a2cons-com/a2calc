"""Narration clips for the promo video: Kokoro TTS v1.0 (kokoro-onnx,
Apache-2.0), voice am_onyx, run locally. Same approach as the A2 Labs
voiceover tools: one sentence per clip, built-in silence trimmed.

  python say.py lines.txt out_dir [--speed 1.05]     # one clip per line
  python say.py --phonemes "Meet A-two Calc."        # check pronunciation

Needs: pip install kokoro-onnx soundfile numpy; brew install espeak-ng;
KOKORO_MODELS = folder with kokoro-v1.0.onnx and voices-v1.0.bin (from
github.com/thewh1teagle/kokoro-onnx releases, model-files-v1.0).
Write "A-two" for A2, or Kokoro reads it as "A two" with a stop.
"""
import argparse
import os
import pathlib

import numpy as np
import soundfile as sf
from kokoro_onnx import EspeakConfig, Kokoro

ESPEAK = EspeakConfig(lib_path="/opt/homebrew/lib/libespeak-ng.dylib",
                      data_path="/opt/homebrew/share/espeak-ng-data")


def load():
    m = pathlib.Path(os.environ["KOKORO_MODELS"])
    return Kokoro(str(m / "kokoro-v1.0.onnx"), str(m / "voices-v1.0.bin"), espeak_config=ESPEAK)


def trim(a, sr, threshold=0.01, head=0.03, tail=0.08):
    idx = np.nonzero(np.abs(a) > threshold)[0]
    if len(idx) == 0:
        return a
    return a[max(idx[0] - int(head * sr), 0):min(idx[-1] + int(tail * sr), len(a))]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("lines", nargs="?")
    ap.add_argument("out", nargs="?")
    ap.add_argument("--voice", default="am_onyx")
    ap.add_argument("--speed", type=float, default=1.05)
    ap.add_argument("--phonemes")
    a = ap.parse_args()
    k = load()
    if a.phonemes:
        print(k.tokenizer.phonemize(a.phonemes, "en-us"))
        return
    out = pathlib.Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    lines = [l.strip() for l in open(a.lines) if l.strip() and not l.startswith("#")]
    for i, line in enumerate(lines, 1):
        audio, sr = k.create(line, voice=a.voice, speed=a.speed, lang="en-us")
        audio = trim(np.asarray(audio), sr)
        sf.write(out / f"vo{i:02d}.wav", audio, sr)
        print(f"vo{i:02d} {len(audio) / sr:5.2f}s  {line}")


if __name__ == "__main__":
    main()
