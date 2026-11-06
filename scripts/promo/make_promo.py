"""A2 Calc promo video, TikTok style (same recipe as the BIN Inventory promo).

Frames are drawn with PIL and piped to ffmpeg. App footage comes from PNG
frame sequences captured from the web build (capture.mjs); the narration
is Kokoro am_onyx (say.py), laid over upbeat music. The mix follows the A2 Labs
voiceover tools: voice lightly compressed, music compressed hard to an
even level at a fixed volume under it (no ducking), limiter, -14 LUFS.

  python make_promo.py --shots DIR --vo DIR --music FILE --music-start 0 --music-gain 1.5 --out promo.mp4
  python make_promo.py ... --width 886 --out app-preview.mp4   # App Store
  python make_promo.py --video old.mp4 --vo DIR --music FILE ... --out new.mp4
      # new music only: keeps the picture of an earlier render (same narration)

Music: Loyalty Freak Music, "Roller Fever", from the album ROLLER DISCO
DANCE DANCE, CC0 1.0 (public domain dedication, no attribution needed):
https://archive.org/details/LoyaltyFreakMusic-ROLLERDISCODANCEDANCE
(129 BPM disco-funk; gain 1.5 puts it ~11 dB under the voice).
Earlier: Scott Joplin, "Maple Leaf Rag" (1916 piano roll, public domain).

--width 886 gives the 886x1920 App Store app preview (same cut; Apple
wants 15-30 s, 30 fps, H.264, stereo AAC).
"""
import argparse
import json
import math
import subprocess
import wave
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
ICON = ROOT / 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png'
H, FPS = 1920, 30
W = 1080
GREEN = (0, 104, 57)          # brand #006839
GREEN_HI = (22, 150, 88)
INK = (10, 30, 20)
WHITE = (255, 255, 255)
FONT = '/System/Library/Fonts/Supplemental/Arial Black.ttf'
MARKER = '/System/Library/Fonts/MarkerFelt.ttc'
LEAD = 0.2        # narration starts this long into its scene
GAP = 0.2         # breath after each line
CAP_DARK = (8, 36, 22)

A = None          # parsed args


def wav_len(p):
    with wave.open(str(p)) as w:
        return w.getnframes() / w.getframerate()


def clamp(t):
    return min(max(t, 0.0), 1.0)


def ease_out(t):
    return 1 - (1 - clamp(t)) ** 3


def ease_back(t):
    t = clamp(t)
    c = 1.70158
    return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2


_fonts = {}


def font(size, path=FONT):
    key = (size, path)
    if key not in _fonts:
        _fonts[key] = ImageFont.truetype(path, size)
    return _fonts[key]


def gradient(top, bottom):
    g = Image.new('RGB', (1, H))
    for y in range(H):
        f = y / (H - 1)
        g.putpixel((0, y), tuple(int(top[i] + (bottom[i] - top[i]) * f) for i in range(3)))
    return g.resize((W, H)).convert('RGBA')


BG = BG_DARK = None


def rounded(img, radius):
    mask = Image.new('L', img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, img.width - 1, img.height - 1], radius, fill=255)
    out = img.convert('RGBA')
    out.putalpha(mask)
    return out


# --- footage -----------------------------------------------------------------

_seqs = {}


def seq(name):
    if name not in _seqs:
        _seqs[name] = sorted((A.shots / name).glob('*.png'))
    return _seqs[name]


def frame_at(name, k):
    """Frame of a sequence at progress k (0..1)."""
    fs = seq(name)
    return fs[min(int(clamp(k) * len(fs)), len(fs) - 1)]


_phones = {}


def phone(path, width, crop=None):
    """A screenshot as a phone card: rounded, dark bezel, soft shadow."""
    key = (str(path), width, crop)
    if key in _phones:
        return _phones[key]
    shot = Image.open(path).convert('RGB')
    if crop:
        shot = shot.crop((0, crop[0], shot.width, min(crop[1], shot.height)))
    h = int(shot.height * width / shot.width)
    screen = rounded(shot.resize((width, h), Image.LANCZOS), 60)
    bezel = 16
    card = Image.new('RGBA', (width + 2 * bezel, h + 2 * bezel), (0, 0, 0, 0))
    ImageDraw.Draw(card).rounded_rectangle([0, 0, card.width - 1, card.height - 1], 76, fill=(14, 16, 15, 255))
    card.alpha_composite(screen, (bezel, bezel))
    shadow = Image.new('RGBA', (card.width + 120, card.height + 120), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle([60, 80, 60 + card.width, 80 + card.height], 76, fill=(0, 0, 0, 120))
    shadow = shadow.filter(ImageFilter.GaussianBlur(26))
    shadow.alpha_composite(card, (60, 60))
    if len(_phones) > 40:
        _phones.clear()
    _phones[key] = shadow
    return shadow


def place(frame, ph, t, top, enter=0.4, from_y=900, zoom=0.0, dur=3.0):
    k = ease_out(t / enter) if enter else 1
    s = 1 + zoom * clamp(t / max(dur, 0.1))
    p = ph if s == 1 else ph.resize((int(ph.width * s), int(ph.height * s)), Image.BILINEAR)
    frame.alpha_composite(p, (int(W / 2 - p.width / 2), int(top + (1 - k) * from_y)))


def caption(frame, text, t, y, size=74, color=WHITE, box=CAP_DARK, tilt=0):
    """TikTok caption: bold text on a rounded box, popping in."""
    k = ease_back(t / 0.35)
    if k <= 0:
        return
    f = font(size)
    d = ImageDraw.Draw(frame)
    lines = text.split('\n')
    widths = [d.textlength(l, font=f) for l in lines]
    lh = size * 1.18
    bw, bh = max(widths) + 70, lh * len(lines) + 46
    layer = Image.new('RGBA', (int(bw), int(bh)), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    ld.rounded_rectangle([0, 0, bw - 1, bh - 1], 34, fill=box + (238,))
    for i, l in enumerate(lines):
        ld.text(((bw - widths[i]) / 2, 20 + i * lh), l, font=f, fill=color)
    if tilt:
        layer = layer.rotate(tilt, expand=True, resample=Image.BICUBIC)
    fit = min(1.0, (W - 40) / layer.width)
    s = max(0.01, k) * fit
    layer = layer.resize((max(1, int(layer.width * s)), max(1, int(layer.height * s))), Image.LANCZOS)
    frame.alpha_composite(layer, (int((W - layer.width) / 2), int(y + (bh * fit - layer.height) / 2)))


# --- scenes: each draws the frame at local time t of a scene lasting d -------

def s_hook(frame, t, d):
    """A drywall scrap with pencil math on it, then the question."""
    frame.alpha_composite(BG_DARK)
    wob = math.sin(t * 9) * 5 * max(0, 1 - t / 1.2)
    # the scrap of drywall
    k = ease_back(t / 0.4)
    board = Image.new('RGBA', (820, 560), (0, 0, 0, 0))
    bd = ImageDraw.Draw(board)
    bd.polygon([(10, 30), (800, 0), (815, 520), (30, 555)], fill=(228, 224, 214, 255))
    bd.line([(10, 30), (800, 0)], fill=(196, 190, 176, 255), width=6)
    pencil = (70, 70, 78, 255)
    mf = font(78, MARKER)
    sums = ["12' 6 1/2\"", "+ 3' 4 3/4\"", "= ???"]
    shown = int(clamp((t - 0.3) / 1.4) * sum(len(s) for s in sums))
    for i, s in enumerate(sums):
        n = max(0, min(len(s), shown))
        shown -= len(s)
        bd.text((90 + i * 18, 70 + i * 140), s[:n], font=mf, fill=pencil)
    if t > 1.9:
        bd.line([(420, 410), (700, 330)], fill=(200, 40, 40, 255), width=10)
        bd.line([(420, 330), (700, 420)], fill=(200, 40, 40, 255), width=10)
    board = board.rotate(-4 + wob * 0.3, expand=True, resample=Image.BICUBIC)
    s = max(0.01, k) * min(1.0, (W - 60) / board.width)
    b2 = board.resize((max(1, int(board.width * s)), max(1, int(board.height * s))), Image.LANCZOS)
    frame.alpha_composite(b2, (int((W - b2.width) / 2 + wob), int(700 - b2.height / 2)))
    caption(frame, "FEET + INCHES\nON DRYWALL?", t - 0.1, y=1100, size=96, box=GREEN, tilt=2)


def s_calc(frame, t, d):
    frame.alpha_composite(BG)
    k = (t - 0.35) / (d - 0.9)
    place(frame, phone(frame_at('calc', k), 700, (0, 1460)), t, top=470, zoom=0.03, dur=d)
    caption(frame, "MEET A2 CALC", t, y=110, size=86)
    if t > 1.6:
        caption(frame, "TALKS TAPE MEASURE", t - 1.6, y=290, size=58, box=GREEN)


def s_wall(frame, t, d):
    frame.alpha_composite(BG)
    split = 1.25
    if t < split:
        place(frame, phone(seq('wall-plan')[0], 720, (0, 1300)), t, top=430, enter=0.25, zoom=0.03, dur=split)
        caption(frame, "DRAW YOUR WALLS", t, y=110, size=80)
    else:
        lt = t - split
        place(frame, phone(frame_at('wall-3d-turn', lt / (d - split - 0.15)), 720, (0, 1528)), lt,
              top=430, enter=0.3, from_y=0)
        caption(frame, "EVERY STUD.\nEVERY HEADER.", lt, y=90, size=76)


TOUCH = None


def s_drag(frame, t, d):
    frame.alpha_composite(BG_DARK)
    k = clamp(t / (d - 0.1))
    path = frame_at('wall-drag', k)
    width, top, crop = 760, 280, 110
    ph = phone(path, width, (crop, 1528))
    place(frame, ph, t, top=top, enter=0.3, from_y=0)
    # finger: where the mouse was, in CSS px of the 390-wide capture
    idx = min(int(k * len(seq('wall-drag'))), len(TOUCH) - 1)
    p = TOUCH[idx]
    if p:
        sc = width / 390
        x = W / 2 - ph.width / 2 + 60 + 16 + p[0] * sc
        y = top + 60 + 16 + (p[1] - crop / 2) * sc
        dot = Image.new('RGBA', (140, 140), (0, 0, 0, 0))
        dd = ImageDraw.Draw(dot)
        dd.ellipse([10, 10, 130, 130], fill=(255, 255, 255, 90), outline=(255, 255, 255, 230), width=6)
        dd.ellipse([46, 46, 94, 94], fill=(255, 255, 255, 200))
        frame.alpha_composite(dot, (int(x - 70), int(y - 70)))
    if t < 2.0:
        caption(frame, "SLIDE THE WINDOW...", t, y=90, size=72, box=GREEN)
    else:
        caption(frame, "...IT REFRAMES. LIVE.", t - 2.0, y=90, size=72, tilt=-2)


def s_block(frame, t, d):
    frame.alpha_composite(BG)
    place(frame, phone(frame_at('block-3d', t / (d - 0.1)), 720, (0, 1340)), t, top=430, enter=0.3, from_y=0)
    caption(frame, "BLOCK WALLS?", t, y=110, size=84)
    if t > 1.0:
        caption(frame, "GROUT + LINTELS. DONE.", t - 1.0, y=1680, size=62, box=GREEN, tilt=2)


def s_concrete(frame, t, d):
    frame.alpha_composite(BG)
    place(frame, phone(frame_at('concrete-3d', t / (d - 0.1)), 700, (0, 1500)), t, top=430, enter=0.3, from_y=0)
    caption(frame, "CONCRETE?", t, y=110, size=84)
    if t > 1.0:
        caption(frame, "ROUNDED UP TO THE ORDER", t - 1.0, y=1680, size=58, box=GREEN, tilt=-2)


def s_free(frame, t, d):
    """Rubber stamps, one per promise."""
    frame.alpha_composite(BG_DARK)
    stamps = [("FREE", -6, 380, 150), ("OPEN SOURCE", 4, 640, 104), ("NO ADS", -3, 900, 130),
              ("STAYS ON\nYOUR PHONE", 3, 1160, 104)]
    for i, (txt, rot, y, size) in enumerate(stamps):
        lt = t - 0.15 - i * 0.55
        if lt <= 0:
            continue
        k = clamp(lt / 0.18)
        s = 2.2 - 1.2 * ease_out(k)          # slams down from big
        f = font(size)
        d0 = ImageDraw.Draw(frame)
        lines = txt.split('\n')
        tw = max(d0.textlength(l, font=f) for l in lines)
        lh = size * 1.1
        lay = Image.new('RGBA', (int(tw + 80), int(lh * len(lines) + 60)), (0, 0, 0, 0))
        ld = ImageDraw.Draw(lay)
        col = (90, 220, 140, 255) if i % 2 == 0 else (255, 255, 255, 255)
        ld.rounded_rectangle([4, 4, lay.width - 5, lay.height - 5], 22, outline=col, width=10)
        for j, l in enumerate(lines):
            ld.text(((lay.width - ld.textlength(l, font=f)) / 2, 22 + j * lh), l, font=f, fill=col)
        lay = lay.rotate(rot, expand=True, resample=Image.BICUBIC)
        s *= min(1.0, (W - 60) / lay.width)
        lay = lay.resize((int(lay.width * s), int(lay.height * s)), Image.LANCZOS)
        if k < 1:
            lay.putalpha(lay.getchannel('A').point(lambda a: int(a * k)))
        frame.alpha_composite(lay, (int((W - lay.width) / 2), int(y - lay.height / 2 + 80)))


def s_end(frame, t, d):
    frame.alpha_composite(BG)
    k = ease_back(t / 0.45)
    size = max(1, int(340 * k))
    icon = rounded(Image.open(ICON).convert('RGB').resize((size, size), Image.LANCZOS), int(size * 0.22))
    frame.alpha_composite(icon, ((W - size) // 2, 470 + (340 - size) // 2))
    if t > 0.3:
        caption(frame, "A2 TAKEOFF CALC", t - 0.3, y=900, size=88)
    if t > 1.3:
        caption(frame, "Measure twice.\nCalculate once.", t - 1.3, y=1090, size=66, box=GREEN_HI, tilt=-2)
    if t > 2.2:
        k2 = ease_out((t - 2.2) / 0.5)
        f = font(44)
        txt = "Free  ·  by A2 Labs"
        dr = ImageDraw.Draw(frame)
        tw = dr.textlength(txt, font=f)
        dr.text(((W - tw) / 2, 1440 + (1 - k2) * 40), txt, font=f, fill=(255, 255, 255, int(230 * k2)))


# (narration clip, scene, minimum length in seconds)
SCENES = [('vo01', s_hook, 3.0), ('vo02', s_calc, 0), ('vo03', s_wall, 3.0), ('vo04', s_drag, 4.7),
          ('vo05', s_block, 2.6), ('vo06', s_concrete, 2.8), ('vo07', s_free, 3.3), ('vo08', s_end, 0)]
END_HOLD = 0.8


def main():
    global A, W, BG, BG_DARK, TOUCH
    ap = argparse.ArgumentParser()
    ap.add_argument('--shots', type=Path, help='captured footage (not needed with --video)')
    ap.add_argument('--vo', type=Path, required=True)
    ap.add_argument('--music', type=Path, required=True)
    ap.add_argument('--music-start', type=float, default=0.2)
    ap.add_argument('--music-gain', type=float, default=2.0)   # ~10.5 dB under the voice
    ap.add_argument('--out', type=Path, required=True)
    ap.add_argument('--width', type=int, default=1080)
    ap.add_argument('--music-fade', type=float, default=1.6, help='fade-out at the end, seconds')
    ap.add_argument('--audio', type=Path, help='reuse this mixed soundtrack')
    ap.add_argument('--video', type=Path,
                    help='reuse the picture of an earlier render (same narration, so the same timing) and only remix the sound')
    A = ap.parse_args()
    if not A.video and not A.shots:
        ap.error('--shots is required unless --video is given')
    W = A.width
    BG = gradient((14, 128, 72), (0, 64, 34))
    BG_DARK = gradient((22, 40, 31), (6, 14, 10))
    TOUCH = json.loads((A.shots / 'wall-drag' / 'touch.json').read_text()) if A.shots else []

    timeline, t0 = [], 0.0
    for vo, fn, least in SCENES:
        d = max(LEAD + wav_len(A.vo / f'{vo}.wav') + GAP, least)
        if fn is s_end:
            d += END_HOLD
        timeline.append((t0, d, vo, fn))
        t0 += d
    total = t0
    print(f'total {total:.2f}s')

    work = A.out.with_suffix('')
    if A.video:
        video = A.video
        have = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0',
                                     str(video)], capture_output=True, text=True, check=True).stdout)
        if abs(have - total) > 2 / FPS:
            raise SystemExit(f'{video} is {have:.2f}s but the narration makes {total:.2f}s: render it again')
    else:
        video = Path(f'{work}-video.mp4')
        proc = subprocess.Popen([
            'ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', f'{W}x{H}', '-r', str(FPS),
            '-i', '-', '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-preset', 'medium',
            # App Store previews want ~10-12 Mbps; the social cut is quality-based
            *(['-b:v', '11M', '-maxrate', '12M', '-bufsize', '24M'] if W != 1080 else ['-crf', '17']),
            '-r', str(FPS), str(video),
        ], stdin=subprocess.PIPE)
        for i in range(int(round(total * FPS))):
            t = i / FPS
            for start, d, vo, fn in timeline:
                if start <= t < start + d or (fn is s_end and t >= start):
                    frame = Image.new('RGBA', (W, H))
                    fn(frame, t - start, d)
                    lt = t - start
                    if 0 <= lt < 0.08 and start > 0:   # quick white flash at each cut
                        frame.alpha_composite(Image.new('RGBA', (W, H), (255, 255, 255, int(150 * (1 - lt / 0.08)))))
                    break
            proc.stdin.write(frame.tobytes())
        proc.stdin.close()
        proc.wait()

    audio = A.audio
    if not audio:
        audio = Path(f'{work}-audio.m4a')
        inputs, filters, labels = [], [], []
        for idx, (start, d, vo, fn) in enumerate(timeline):
            inputs += ['-i', str(A.vo / f'{vo}.wav')]
            ms = int((start + LEAD) * 1000)
            filters.append(f'[{idx}:a]aresample=48000,adelay={ms}|{ms}[v{idx}]')
            labels.append(f'[v{idx}]')
        m = len(timeline)
        inputs += ['-ss', str(A.music_start), '-i', str(A.music)]
        filters.append(f'{"".join(labels)}amix=inputs={m}:normalize=0,'
                       f'acompressor=threshold=-18dB:ratio=3:attack=5:release=120,volume=1.6,'
                       f'apad=whole_dur={total:.2f}[vo]')
        filters.append(f'[{m}:a]aresample=48000,atrim=0:{total:.2f},'
                       f'acompressor=threshold=0.015:ratio=10:attack=300:release=3000:knee=6,'
                       f'volume={A.music_gain},afade=t=out:st={total - A.music_fade:.2f}:d={A.music_fade}[mus]')
        filters.append(f'[mus][vo]amix=inputs=2:normalize=0,alimiter=limit=0.95,atrim=0:{total:.2f},'
                       f'loudnorm=I=-14:TP=-1.5:LRA=11,aformat=channel_layouts=stereo[out]')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', *inputs, '-filter_complex', ';'.join(filters),
                        '-map', '[out]', '-ar', '48000', '-ac', '2', '-c:a', 'aac', '-b:a', '256k', str(audio)], check=True)

    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(video), '-i', str(audio), '-map', '0:v:0', '-map', '1:a:0',
                    '-c:v', 'copy', '-c:a', 'copy', '-shortest', '-movflags', '+faststart', str(A.out)], check=True)
    if not A.video:
        video.unlink()
    print('wrote', A.out)


if __name__ == '__main__':
    main()
