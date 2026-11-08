#!/usr/bin/env python3
"""Composes the App Store header and search-results videos (iOS 27
creative assets) from the frames header_video.mjs captured: brand green,
white cards with real app footage, one small line of text. Muted and
looping: the last scene crossfades into the first frame, so the loop has
no seam.

Scenes (30 fps), search video only first: the phone screen with a plain
feet-inch-fraction sum typed key by key (frames from
scripts/promo/capture-calc.mjs, DSF=3, in <frames-dir>/calc-full). Then
the stud wall (3D turning beside the wall drawing, a
window sliding along it and back), then the block wall and concrete in
3D side by side.

  python3 scripts/store/header_video.py <frames-dir> <out-dir>

Writes header-3840x1646.mp4 and search-3600x2400.mp4: H.264 High,
yuv420p, level 5.1, no audio. (3600x2400 keeps the 3:2 search asset
inside H.264 level 5.1; 3840x2560 would need level 6.)
"""
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

FPS = 30
FADE = 18  # frames of crossfade between scenes
FONT = ('/System/Library/Fonts/HelveticaNeue.ttc', 1)  # Bold
TEXT = 'Takeoffs you can see'


def gradient(w, h):
    """The radial green of the store art: #0a8a4c at the top, #006839,
    #00431f at the edges."""
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    d = np.sqrt(((x - w / 2) / (0.9 * w)) ** 2 + (y / (1.2 * h)) ** 2)
    stops = [(0.0, (10, 138, 76)), (0.55, (0, 104, 57)), (1.0, (0, 67, 31))]
    out = np.zeros((h, w, 3), np.float32)
    for (a, ca), (b, cb) in zip(stops, stops[1:]):
        m = (d >= a) & (d <= b) if b < 1 else d >= a
        t = np.clip((d - a) / (b - a), 0, 1)[..., None]
        out = np.where(m[..., None], np.array(ca) * (1 - t) + np.array(cb) * t, out)
    return Image.fromarray(out.astype(np.uint8))


class Card:
    """A white rounded card holding one footage frame, with a soft shadow."""

    def __init__(self, w, h, radius, pad=0):
        self.w, self.h, self.r, self.pad = w, h, radius, pad
        mask = Image.new('L', (w, h), 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, w - 1, h - 1), radius, fill=255)
        self.mask = mask
        sh = Image.new('L', (w + 400, h + 400), 0)
        ImageDraw.Draw(sh).rounded_rectangle((200, 230, 200 + w, 230 + h), radius, fill=110)
        self.shadow = sh.filter(ImageFilter.GaussianBlur(70))

    def paste_shadow(self, canvas, x, y):
        black = Image.new('RGB', self.shadow.size, (0, 30, 12))
        canvas.paste(black, (x - 200, y - 200), self.shadow)

    def render(self, frame):
        card = Image.new('RGB', (self.w, self.h), (255, 255, 255))
        fw, fh = frame.size
        k = min((self.w - 2 * self.pad) / fw, (self.h - 2 * self.pad) / fh)
        f = frame.resize((round(fw * k), round(fh * k)), Image.LANCZOS)
        card.paste(f, ((self.w - f.width) // 2, (self.h - f.height) // 2))
        return card


def load(path):
    return Image.open(path).convert('RGB')


def trim(img, bg=(250, 250, 250), tol=6):
    """Crops the page background around a drawing (the elevation SVG)."""
    a = np.asarray(img).astype(int)
    m = (np.abs(a - a[0, 0]).sum(axis=2) > tol)
    ys, xs = np.where(m)
    if not len(xs):
        return img
    return img.crop((max(0, xs.min() - 8), max(0, ys.min() - 8), min(img.width, xs.max() + 9), min(img.height, ys.max() + 9)))


def layout(W, H):
    """Card boxes and the text line for an output size."""
    if W / H > 2:  # header 21:9: text on top, two cards in a row
        fs = 96
        top = 90 + fs + 70
        ch = H - top - 110
        cw = round(ch * 1.30)
        gap = 120
    else:  # search 3:2: bigger text, taller cards
        fs = 150
        top = 170 + fs + 120
        ch = H - top - 220
        cw = round((W - 3 * 140) / 2)
        ch = min(ch, round(cw / 1.05))
        gap = 140
    x0 = (W - (2 * cw + gap)) // 2
    return fs, [(x0, top, cw, ch), (x0 + cw + gap, top, cw, ch)]


def compose(frames_dir, W, H, intro=False, turn_len=None):
    bg = gradient(W, H)
    fs, boxes = layout(W, H)
    font = ImageFont.truetype(FONT[0], fs, index=FONT[1])
    d = ImageDraw.Draw(bg)
    tw = d.textlength(TEXT, font=font)
    d.text(((W - tw) / 2, boxes[0][1] - fs - (60 if W / H > 2 else 110)), TEXT, font=font, fill=(255, 255, 255))
    cards = [Card(w, h, round(h * 0.05), pad=round(h * 0.03)) for (_, _, w, h) in boxes]
    for c, (x, y, _, _) in zip(cards, boxes):
        c.paste_shadow(bg, x, y)

    def scene(left, right):
        out = bg.copy()
        for c, (x, y, _, _), f in zip(cards, boxes, (left, right)):
            out.paste(c.render(f), (x, y), c.mask)
        return out

    wall3d = sorted(os.listdir(f'{frames_dir}/wall/3d'))
    n_wall = len(wall3d)
    blocks = sorted(f for f in os.listdir(f'{frames_dir}/block') if f.endswith('.png'))
    concs = sorted(f for f in os.listdir(f'{frames_dir}/concrete') if f.endswith('.png'))
    n_turn = min(len(blocks), len(concs))

    def wall_frame(i):
        return scene(load(f'{frames_dir}/wall/3d/{wall3d[i]}'), trim(load(f'{frames_dir}/wall/elev/{wall3d[i]}')))

    def turn_frame(i):
        return scene(load(f'{frames_dir}/block/{blocks[i]}'), load(f'{frames_dir}/concrete/{concs[i]}'))

    if turn_len:
        n_turn = min(n_turn, turn_len)
    calc = calc_intro(frames_dir, W, H, gradient(W, H)) if intro else None
    if calc:
        for f in calc[:-FADE]:
            yield f
        for k in range(FADE):
            yield Image.blend(calc[len(calc) - FADE + k], wall_frame(k), (k + 1) / (FADE + 1))
        start = FADE
    else:
        start = 0
    # wall scene, crossfade into the turn scene, then crossfade back to the first frame
    for i in range(start, n_wall - FADE):
        yield wall_frame(i)
    for k in range(FADE):
        a = wall_frame(n_wall - FADE + k)
        b = turn_frame(k)
        yield Image.blend(a, b, (k + 1) / (FADE + 1))
    for i in range(FADE, n_turn - FADE):
        yield turn_frame(i)
    first = calc[0] if calc else wall_frame(0)
    for k in range(FADE):
        yield Image.blend(turn_frame(n_turn - FADE + k), first, (k + 1) / (FADE + 1))


def calc_intro(frames_dir, W, H, bg_full):
    """The phone, full screen calculator, typed key by key, beside the words.
    Returns the 30 fps frames and the first one (for the loop back)."""
    import json
    names = sorted(f for f in os.listdir(f'{frames_dir}/calc-full') if f.endswith('.png'))
    touch = json.load(open(f'{frames_dir}/calc-full/touch.json'))
    # seconds on screen per captured frame: a key press 0.11 s (two frames), a pause longer
    times = [0.11 if t else (0.15 if i < 4 else 0.24) for i, t in enumerate(touch)]
    bg = bg_full.copy()
    ph_h = round(H * 0.84)
    sw, sh = load(f'{frames_dir}/calc-full/{names[0]}').size
    ph_w = round(ph_h * sw / sh)
    bez = round(ph_h * 0.016)
    x0 = round(W * 0.14)
    y0 = (H - ph_h) // 2
    card = Card(ph_w + 2 * bez, ph_h + 2 * bez, round(ph_h * 0.075))
    card.paste_shadow(bg, x0 - bez, y0 - bez)
    d = ImageDraw.Draw(bg)
    d.rounded_rectangle((x0 - bez, y0 - bez, x0 + ph_w + bez, y0 + ph_h + bez), round(ph_h * 0.075), fill=(14, 18, 16))
    bold = ImageFont.truetype(FONT[0], round(H * 0.088), index=1)
    reg = ImageFont.truetype(FONT[0], round(H * 0.042), index=0)
    tx = x0 + ph_w + bez + round(W * 0.07)
    lines = [('Feet, inches,', bold), ('fractions.', bold)]
    y = round(H * 0.34)
    for txt, f in lines:
        d.text((tx, y), txt, font=f, fill=(255, 255, 255))
        y += round(f.size * 1.18)
    y += round(H * 0.03)
    d.text((tx, y), 'A calculator that speaks', font=reg, fill=(214, 238, 224))
    d.text((tx, y + round(reg.size * 1.3)), 'tape measure.', font=reg, fill=(214, 238, 224))
    smask = Image.new('L', (ph_w, ph_h), 0)
    ImageDraw.Draw(smask).rounded_rectangle((0, 0, ph_w - 1, ph_h - 1), round(ph_h * 0.062), fill=255)
    k = ph_w / 390
    frames = []
    cache = {}
    for i, (name, dt) in enumerate(zip(names, times)):
        if name not in cache:
            cache.clear()
            out = bg.copy()
            scr = load(f'{frames_dir}/calc-full/{name}').resize((ph_w, ph_h), Image.LANCZOS)
            out.paste(scr, (x0, y0), smask)
            if touch[i]:
                cx, cy = x0 + touch[i][0] * k, y0 + touch[i][1] * k
                r = round(ph_w * 0.075)
                lay = Image.new('RGBA', out.size, (0, 0, 0, 0))
                ld = ImageDraw.Draw(lay)
                ld.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(0, 104, 57, 60), outline=(0, 104, 57, 200), width=max(4, r // 10))
                ld.ellipse((cx - r * 0.36, cy - r * 0.36, cx + r * 0.36, cy + r * 0.36), fill=(0, 104, 57, 170))
                out = Image.alpha_composite(out.convert('RGBA'), lay).convert('RGB')
            cache[name] = out
        frames += [cache[name]] * max(1, round(dt * FPS))
    return frames


def encode(frames, W, H, path):
    cmd = ['ffmpeg', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS),
           '-i', '-', '-an', '-c:v', 'libx264', '-profile:v', 'high', '-level:v', '5.1', '-preset', 'slow', '-crf', '16',
           '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
           '-movflags', '+faststart', path]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    n = 0
    for f in frames:
        p.stdin.write(f.tobytes())
        n += 1
    p.stdin.close()
    if p.wait():
        raise SystemExit(f'ffmpeg failed for {path}')
    print(path, n, 'frames', f'{n / FPS:.1f} s')


if __name__ == '__main__':
    frames_dir, out = sys.argv[1], sys.argv[2]
    os.makedirs(out, exist_ok=True)
    only = sys.argv[3] if len(sys.argv) > 3 else 'header,search'
    if 'header' in only:
        encode(compose(frames_dir, 3840, 1646), 3840, 1646, f'{out}/header-3840x1646.mp4')
    if 'search' in only:
        encode(compose(frames_dir, 3600, 2400, intro=True, turn_len=165), 3600, 2400, f'{out}/search-3600x2400.mp4')
