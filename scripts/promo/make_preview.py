"""A2 Calc App Store app preview, second cut (886x1920, ~24 s, music only).

In App Store search the preview is the first thing people see, playing
muted, so it has to explain the app by itself:
  1. the phone screen, full bleed: a plain feet-inch-fraction sum typed
     key by key (also the poster frame);
  2. then the takeoffs, as cards on green: the stud wall in 3D, a window
     slid along the wall as every stud reframes, block grout, concrete;
  3. the icon and name.
Captions carry the words (no narration). Footage: capture-calc.mjs and
capture.mjs (wall,block,concrete). Drawing helpers come from make_promo.py.

  python make_preview.py --shots DIR --music FILE --out app-preview.mp4
"""
import argparse
import json
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw

import make_promo as mp
from make_promo import caption, clamp, ease_out, ease_back, phone, place, frame_at, seq, rounded, font

W, H, FPS = 886, 1920, 30
APP_BG = (243, 245, 244)
SC = W / 390          # CSS px of the 390-wide capture -> video px

CALC_TOUCH = None


def calc_timing():
    """Seconds each captured calculator frame stays on screen."""
    out = []
    for i, t in enumerate(CALC_TOUCH):
        out.append(0.11 if t else (0.15 if i < 4 else 0.22))
    return out


def calc_frame(t):
    acc = 0.0
    for i, d in enumerate(CALC_TIMES):
        acc += d
        if t < acc:
            return i
    return len(CALC_TIMES) - 1


def full_screen(frame, path, scale=1.0, cx=None, cy=None, radius=0):
    shot = Image.open(path).convert('RGB')
    w = int(W * scale)
    h = int(shot.height * w / shot.width)
    img = shot.resize((w, h), Image.LANCZOS)
    if radius:
        img = rounded(img, radius)
    cx = W / 2 if cx is None else cx
    cy = H / 2 if cy is None else cy
    frame.alpha_composite(img.convert('RGBA'), (int(cx - w / 2), int(cy - h / 2)))


def finger(frame, x, y, k=1.0):
    dot = Image.new('RGBA', (130, 130), (0, 0, 0, 0))
    dd = ImageDraw.Draw(dot)
    a = int(255 * k)
    dd.ellipse([8, 8, 122, 122], fill=(0, 104, 57, int(60 * k)), outline=(0, 104, 57, int(200 * k)), width=6)
    dd.ellipse([44, 44, 86, 86], fill=(0, 104, 57, int(170 * k)))
    frame.alpha_composite(dot, (int(x - 65), int(y - 65)))


def s_calc(frame, t, d):
    frame.alpha_composite(Image.new('RGBA', (W, H), APP_BG + (255,)))
    i = calc_frame(t)
    full_screen(frame, seq('calc-full')[i])
    p = CALC_TOUCH[i]
    if p:
        finger(frame, p[0] * SC, p[1] * SC)
    # over the A-F memory row, clear of the tape and the keys
    if t < d - 1.6:
        caption(frame, "FEET · INCHES · FRACTIONS", t - 0.25, y=632, size=52, box=mp.GREEN)
    else:
        caption(frame, "LIKE A TAPE MEASURE", t - (d - 1.6), y=632, size=52, box=mp.GREEN)


def s_turn(frame, t, d):
    """The calculator shrinks to a card and slides away; the 3D wall comes in."""
    frame.alpha_composite(mp.BG)
    k = ease_out(t / 0.6)
    last = seq('calc-full')[-1]
    scale = 1 - 0.32 * k
    slide = ease_out((t - 0.75) / 0.5)
    if slide < 1:
        full_screen(frame, last, scale, cx=W / 2 - slide * W * 1.1, cy=H / 2 + 120 * k, radius=int(60 * k))
    if t > 0.75:
        ph = phone(frame_at('wall-3d-turn', (t - 0.75) / (d - 0.75 + 2.0) * 0.4), 720, (0, 1528))
        x = int(W / 2 - ph.width / 2 + (1 - slide) * W * 1.1)
        frame.alpha_composite(ph, (x, 430))
    caption(frame, "NOT JUST A\nCALCULATOR", t - 0.2, y=90, size=72, tilt=-2)


def s_wall(frame, t, d):
    frame.alpha_composite(mp.BG)
    k = 0.4 * (2.0 + 0) / (d + 2.0) + t / d * 0.6
    place(frame, phone(frame_at('wall-3d-turn', k), 720, (0, 1528)), t, top=430, enter=0, from_y=0)
    caption(frame, "STUD WALLS\nIN 3D", t - 0.05, y=90, size=76, box=mp.GREEN)


def s_drag(frame, t, d):
    frame.alpha_composite(mp.BG_DARK)
    k = clamp(t / (d - 0.1))
    width, top, crop = 760, 300, 110
    ph = phone(frame_at('wall-drag', k), width, (crop, 1528))
    place(frame, ph, t, top=top, enter=0.3, from_y=0)
    idx = min(int(k * len(seq('wall-drag'))), len(mp.TOUCH) - 1)
    p = mp.TOUCH[idx]
    if p:
        sc = width / 390
        x = W / 2 - ph.width / 2 + 60 + 16 + p[0] * sc
        y = top + 60 + 16 + (p[1] - crop / 2) * sc
        finger(frame, x, y)
    if t < 1.8:
        caption(frame, "SLIDE A WINDOW...", t, y=90, size=70, box=mp.GREEN)
    else:
        caption(frame, "...EVERY STUD\nREFRAMES", t - 1.8, y=70, size=70, tilt=-2)


def s_block(frame, t, d):
    frame.alpha_composite(mp.BG)
    place(frame, phone(frame_at('block-3d', t / (d - 0.1)), 720, (70, 1340)), t, top=430, enter=0.3, from_y=0)
    caption(frame, "BLOCK WALLS", t, y=110, size=80)
    if t > 0.8:
        caption(frame, "GROUT + LINTELS", t - 0.8, y=1640, size=64, box=mp.GREEN, tilt=2)


def s_concrete(frame, t, d):
    frame.alpha_composite(mp.BG)
    # from the order card down: no project buttons (not in this release)
    place(frame, phone(frame_at('concrete-3d', t / (d - 0.1)), 720, (230, 1688)), t, top=400, enter=0.3, from_y=0)
    caption(frame, "CONCRETE", t, y=110, size=80)
    if t > 0.8:
        caption(frame, "YARDS TO ORDER", t - 0.8, y=1640, size=64, box=mp.GREEN, tilt=-2)


def s_end(frame, t, d):
    frame.alpha_composite(mp.BG)
    k = ease_back(t / 0.45)
    size = max(1, int(300 * k))
    icon = rounded(Image.open(mp.ICON).convert('RGB').resize((size, size), Image.LANCZOS), int(size * 0.22))
    frame.alpha_composite(icon, ((W - size) // 2, 520 + (300 - size) // 2))
    if t > 0.25:
        caption(frame, "A2 TAKEOFF CALC", t - 0.25, y=900, size=76)
    if t > 0.9:
        caption(frame, "Calculator + takeoffs", t - 0.9, y=1080, size=58, box=mp.GREEN_HI, tilt=-2)
    if t > 1.5:
        k2 = ease_out((t - 1.5) / 0.5)
        f = font(42)
        txt = "Free  ·  no ads  ·  no account"
        dr = ImageDraw.Draw(frame)
        tw = dr.textlength(txt, font=f)
        dr.text(((W - tw) / 2, 1330 + (1 - k2) * 40), txt, font=f, fill=(255, 255, 255, int(235 * k2)))


def main():
    global CALC_TOUCH, CALC_TIMES
    ap = argparse.ArgumentParser()
    ap.add_argument('--shots', type=Path, required=True)
    ap.add_argument('--music', type=Path, required=True)
    ap.add_argument('--music-start', type=float, default=0.2)
    ap.add_argument('--out', type=Path, required=True)
    a = ap.parse_args()
    mp.A = argparse.Namespace(shots=a.shots)
    mp.W = W
    mp.BG = mp.gradient((14, 128, 72), (0, 64, 34))
    mp.BG_DARK = mp.gradient((22, 40, 31), (6, 14, 10))
    mp.TOUCH = json.loads((a.shots / 'wall-drag' / 'touch.json').read_text())
    CALC_TOUCH = json.loads((a.shots / 'calc-full' / 'touch.json').read_text())
    CALC_TIMES = calc_timing()

    scenes = [(s_calc, sum(CALC_TIMES)), (s_turn, 1.6), (s_wall, 1.6), (s_drag, 4.2),
              (s_block, 2.6), (s_concrete, 2.6), (s_end, 2.8)]
    timeline, t0 = [], 0.0
    for fn, d in scenes:
        timeline.append((t0, d, fn))
        t0 += d
    total = t0
    print(f'total {total:.2f}s, calculator {scenes[0][1]:.2f}s')

    video = a.out.with_name(a.out.stem + '-video.mp4')
    proc = subprocess.Popen([
        'ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', f'{W}x{H}', '-r', str(FPS),
        '-i', '-', '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-preset', 'medium',
        '-b:v', '11M', '-maxrate', '12M', '-bufsize', '24M', '-r', str(FPS), str(video)], stdin=subprocess.PIPE)
    for i in range(int(round(total * FPS))):
        t = i / FPS
        for start, d, fn in timeline:
            if start <= t < start + d or (fn is s_end and t >= start):
                frame = Image.new('RGBA', (W, H))
                fn(frame, t - start, d)
                lt = t - start
                if 0 <= lt < 0.08 and start > 0 and fn not in (s_turn,):
                    frame.alpha_composite(Image.new('RGBA', (W, H), (255, 255, 255, int(150 * (1 - lt / 0.08)))))
                break
        proc.stdin.write(frame.tobytes())
    proc.stdin.close()
    proc.wait()

    fade = 1.6
    subprocess.run([
        'ffmpeg', '-v', 'error', '-y', '-i', str(video), '-ss', str(a.music_start), '-i', str(a.music),
        '-filter_complex',
        f'[1:a]aresample=48000,atrim=0:{total:.2f},acompressor=threshold=0.05:ratio=4:attack=50:release=800,'
        f'afade=t=out:st={total - fade:.2f}:d={fade},loudnorm=I=-16:TP=-1.5:LRA=11,aformat=channel_layouts=stereo[out]',
        '-map', '0:v:0', '-map', '[out]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000',
        '-shortest', '-movflags', '+faststart', str(a.out)], check=True)
    video.unlink()
    print('wrote', a.out)


if __name__ == '__main__':
    main()
