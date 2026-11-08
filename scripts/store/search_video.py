#!/usr/bin/env python3
"""The App Store search results video (iOS 27 creative asset, 3600x2400,
muted, looping): everything people see of the app in search, so all of
it shows the app working.

  left:   a phone, the calculator, sums typed key by key, never stopping
  middle: a phone doing a stud wall takeoff by hand: open it from the
          menu, add a wall, type its length, add a window, slide it as the
          studs reframe, turn it in 3D, the cut list
  right:  those steps as a list, the current one lit

Both phones loop on the same period (the takeoff's length; the
calculator's pauses stretch to fit), so the video loops without a seam.

  node scripts/promo/capture-calc.mjs <dir>  (DSF=3, URL=...)
  node scripts/store/capture-flow.mjs <dir>
  python3 scripts/store/search_video.py <dir> <out.mp4>
"""
import json
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H, FPS = 3600, 2400, 30
HEL = '/System/Library/Fonts/HelveticaNeue.ttc'
STEPS = ['Open a takeoff', 'Add a wall', 'Type its length', 'Add a window',
         'Slide it: studs reframe', 'See it in 3D', 'Get the cut list']
GREEN = (0, 104, 57)


def gradient(w, h):
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    d = np.sqrt(((x - w / 2) / (0.9 * w)) ** 2 + (y / (1.2 * h)) ** 2)
    stops = [(0.0, (10, 138, 76)), (0.55, (0, 104, 57)), (1.0, (0, 67, 31))]
    out = np.zeros((h, w, 3), np.float32)
    for (a, ca), (b, cb) in zip(stops, stops[1:]):
        m = (d >= a) & (d <= b) if b < 1 else d >= a
        t = np.clip((d - a) / (b - a), 0, 1)[..., None]
        out = np.where(m[..., None], np.array(ca) * (1 - t) + np.array(cb) * t, out)
    return Image.fromarray(out.astype(np.uint8))


def font(size, bold=True):
    return ImageFont.truetype(HEL, size, index=1 if bold else 0)


class Phone:
    """A phone outline at (x, y) with the screen h px tall."""

    def __init__(self, bg, x, y, h, aspect):
        self.x, self.y, self.h = x, y, h
        self.w = round(h * aspect)
        bez = round(h * 0.018)
        r = round(h * 0.075)
        sh = Image.new('L', (self.w + 2 * bez + 400, h + 2 * bez + 400), 0)
        ImageDraw.Draw(sh).rounded_rectangle((200, 240, 200 + self.w + 2 * bez, 240 + h + 2 * bez), r, fill=120)
        sh = sh.filter(ImageFilter.GaussianBlur(60))
        bg.paste(Image.new('RGB', sh.size, (0, 30, 12)), (x - bez - 200, y - bez - 200), sh)
        ImageDraw.Draw(bg).rounded_rectangle((x - bez, y - bez, x + self.w + bez, y + h + bez), r, fill=(16, 20, 18))
        self.mask = Image.new('L', (self.w, h), 0)
        ImageDraw.Draw(self.mask).rounded_rectangle((0, 0, self.w - 1, h - 1), round(h * 0.062), fill=255)
        self.k = self.w / 390

    def screen(self, path):
        return Image.open(path).convert('RGB').resize((self.w, self.h), Image.LANCZOS)

    def finger(self, layer, at):
        cx, cy = self.x + at[0] * self.k, self.y + at[1] * self.k
        r = round(self.w * 0.07)
        d = ImageDraw.Draw(layer)
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(0, 104, 57, 55), outline=(0, 104, 57, 210), width=max(4, r // 9))
        d.ellipse((cx - r * 0.36, cy - r * 0.36, cx + r * 0.36, cy + r * 0.36), fill=(0, 104, 57, 175))


def per_frame(items, total):
    """[(file, dur, touch, step)] -> one entry per output frame, `total` frames."""
    out = []
    acc = 0.0
    for it in items:
        acc += it[1]
        while len(out) < round(acc * FPS):
            out.append(it)
    while len(out) < total:
        out.append(items[-1])
    return out[:total]


def main():
    src, dest = sys.argv[1], sys.argv[2]
    flow = json.load(open(f'{src}/flow/timeline.json'))
    flow_items = [(f'{src}/flow/{f["file"]}', f['dur'], f['touch'], f['step']) for f in flow]
    period = sum(f[1] for f in flow_items)
    total = round(period * FPS)

    calc_names = sorted(f for f in os.listdir(f'{src}/calc-full') if f.endswith('.png'))
    touch = json.load(open(f'{src}/calc-full/touch.json'))
    key_t = 0.2
    keys = sum(1 for t in touch if t)
    pauses = len(touch) - keys
    pause_t = max(0.12, (period - keys * key_t) / pauses)
    calc_items = [(f'{src}/calc-full/{n}', key_t if t else pause_t, t, 0) for n, t in zip(calc_names, touch)]

    bg = gradient(W, H)
    ph_h = 1980
    top = 300
    aspect = Image.open(calc_items[0][0]).width / Image.open(calc_items[0][0]).height
    left = Phone(bg, 200, top, ph_h, aspect)
    mid = Phone(bg, 200 + left.w + 230, top, ph_h, aspect)
    d = ImageDraw.Draw(bg)
    lab = font(84)
    for ph, txt in ((left, 'Feet-inch calculator'), (mid, 'Takeoffs')):
        tw = d.textlength(txt, font=lab)
        d.text((ph.x + (ph.w - tw) / 2, 120), txt, font=lab, fill=(255, 255, 255))
    rx = mid.x + mid.w + 200
    title = font(118)
    d.text((rx, 330), 'A stud wall', font=title, fill=(255, 255, 255))
    d.text((rx, 330 + 140), 'in a few taps', font=title, fill=(255, 255, 255))
    foot = font(70, bold=False)
    d.text((rx, 2150), 'Free · no ads · no account', font=foot, fill=(200, 232, 214))

    step_font = font(72)
    step_font_dim = font(72, bold=False)
    num_font = font(64)
    sy0, sdy = 760, 185

    def steps_layer(cur):
        lay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        dl = ImageDraw.Draw(lay)
        for i, s in enumerate(STEPS, 1):
            y = sy0 + (i - 1) * sdy
            on = i == cur
            done = i < cur
            if on:
                dl.rounded_rectangle((rx - 40, y - 34, W - 90, y + 118), 40, fill=(255, 255, 255, 255))
            cx, cy, r = rx + 42, y + 42, 46
            if on:
                dl.ellipse((cx - r, cy - r, cx + r, cy + r), fill=GREEN + (255,))
                col_n, col_t = (255, 255, 255, 255), GREEN + (255,)
            else:
                dl.ellipse((cx - r, cy - r, cx + r, cy + r), outline=(255, 255, 255, 200 if done else 110), width=5)
                col_n = col_t = (255, 255, 255, 215 if done else 120)
            if done:  # a check mark, drawn (the font has none)
                dl.line([(cx - 20, cy + 2), (cx - 5, cy + 18), (cx + 22, cy - 16)], fill=col_n, width=9, joint='curve')
            else:
                tw = dl.textlength(str(i), font=num_font)
                dl.text((cx - tw / 2, cy - num_font.size * 0.58), str(i), font=num_font, fill=col_n)
            dl.text((rx + 120, y + 2), s, font=step_font if on or done else step_font_dim, fill=col_t)
        return lay

    steps_cache = {}
    screens = {}

    def screen(ph, path):
        key = (id(ph), path)
        if key not in screens:
            if len(screens) > 24:
                screens.clear()
            screens[key] = ph.screen(path)
        return screens[key]

    flow_f = per_frame(flow_items, total)
    calc_f = per_frame(calc_items, total)
    proc = subprocess.Popen(['ffmpeg', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}',
                             '-r', str(FPS), '-i', '-', '-an', '-c:v', 'libx264', '-profile:v', 'high', '-level:v', '5.1',
                             '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-colorspace', 'bt709',
                             '-color_primaries', 'bt709', '-color_trc', 'bt709', '-movflags', '+faststart', dest],
                            stdin=subprocess.PIPE)
    XF = 3  # frames of crossfade when a screen jumps (a tap, a sheet opening)
    prev = {'calc': None, 'flow': None}
    fade = {'calc': (None, 0), 'flow': (None, 0)}
    for i in range(total):
        out = bg.copy()
        lay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        for name, ph, it in (('calc', left, calc_f[i]), ('flow', mid, flow_f[i])):
            img = screen(ph, it[0])
            p = prev[name]
            if p is not None and p[0] != it[0] and p[1] >= 0.1 and it[1] >= 0.1:
                fade[name] = (screen(ph, p[0]), XF)
            old, k = fade[name]
            if k > 0:
                img = Image.blend(old, img, 1 - k / (XF + 1))
                fade[name] = (old, k - 1)
            out.paste(img, (ph.x, ph.y), ph.mask)
            if it[2]:
                ph.finger(lay, it[2])
            prev[name] = it
        cur = flow_f[i][3]
        if cur not in steps_cache:
            steps_cache[cur] = steps_layer(cur)
        out = Image.alpha_composite(Image.alpha_composite(out.convert('RGBA'), steps_cache[cur]), lay).convert('RGB')
        proc.stdin.write(out.tobytes())
    proc.stdin.close()
    if proc.wait():
        raise SystemExit('ffmpeg failed')
    print(dest, total, 'frames', f'{period:.1f} s')


if __name__ == '__main__':
    main()
