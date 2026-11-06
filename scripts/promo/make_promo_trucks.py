"""The second A2 Calc promo, "trucks": opens on a cartoon gag (two concrete
trucks, one sent back; then one truck, Friday 4:55 PM, begging for half a
yard more), then the same app footage as make_promo.py, captioned for the
new narration (narration-trucks.txt), and ends on "One truck. The right
truck." Uses make_promo.py's drawing, timeline and audio mix as is.

  python make_promo_trucks.py --shots DIR --vo DIR --music FILE --music-start 0.75 --out trucks.mp4

Music: W. C. Handy, "Ole Miss Rag", Handy's Orchestra of Memphis, 1917
(Wikimedia Commons, File:W.C. Handy -Ole miss rag 1917.ogg; recording and
composition public domain in the US).
"""
import math

from PIL import Image, ImageDraw

import make_promo as mp
from make_promo import (GREEN, GREEN_HI, WHITE, caption, clamp, ease_back, ease_out, font, frame_at,
                        phone, place, rounded, seq)

RED = (196, 40, 40)
ORANGE = (240, 150, 30)
ROAD = (44, 48, 46)
GROUND = 1470      # where the wheels touch


# --- cartoon pieces --------------------------------------------------------------

def truck(spin=0.0, sticker=False, sad=False, empty=False, flip=False, brand=False):
    """A concrete mixer truck facing left (right if flip), 620x380, drawn flat."""
    img = Image.new('RGBA', (620, 380), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # chassis
    d.rounded_rectangle([40, 250, 600, 290], 12, fill=(58, 60, 62, 255))
    # cab (left)
    d.rounded_rectangle([20, 120, 190, 280], 26, fill=ORANGE + (255,))
    d.rounded_rectangle([40, 140, 150, 205], 12, fill=(190, 225, 240, 255))       # window
    d.rectangle([20, 240, 190, 256], fill=(210, 120, 20, 255))
    if sad:   # droopy headlight eye
        d.arc([28, 214, 58, 240], 200, 340, fill=(30, 30, 30, 255), width=5)
    else:
        d.ellipse([26, 214, 54, 240], fill=(255, 245, 190, 255))
    # drum (an egg on its side, tilted), with stripes that turn
    drum = Image.new('RGBA', (420, 240), (0, 0, 0, 0))
    dd = ImageDraw.Draw(drum)
    dd.ellipse([0, 10, 420, 230], fill=(236, 238, 236, 255), outline=(150, 156, 152, 255), width=6)
    for k in range(-3, 5):
        x = 60 + ((k * 80 + spin * 160) % 480) - 40
        dd.line([(x, 22), (x + 70, 218)], fill=GREEN + (255,), width=26)
    m = Image.new('L', drum.size, 0)
    ImageDraw.Draw(m).ellipse([3, 13, 417, 227], fill=255)
    drum.putalpha(Image.composite(drum.getchannel('A'), Image.new('L', drum.size, 0), m))
    dd = ImageDraw.Draw(drum)
    dd.ellipse([0, 10, 420, 230], outline=(120, 126, 122, 255), width=6)
    if empty:
        dd.text((120, 92), 'EMPTY', font=font(52), fill=RED + (255,))
    if brand:   # "A2" on a white badge, over the stripes
        dd.rounded_rectangle([140, 78, 280, 162], 22, fill=(255, 255, 255, 255), outline=GREEN + (255,), width=6)
        f = font(64)
        dd.text((210 - dd.textlength('A2', font=f) / 2, 82), 'A2', font=f, fill=GREEN + (255,))
    drum = drum.rotate(12, expand=True, resample=Image.BICUBIC)
    img.alpha_composite(drum, (190, 20))
    # chute at the back
    d.polygon([(590, 200), (612, 214), (585, 262), (566, 250)], fill=(90, 94, 92, 255))
    # wheels
    for cx in (110, 420, 520):
        d.ellipse([cx - 46, 250, cx + 46, 342], fill=(24, 24, 24, 255))
        d.ellipse([cx - 20, 276, cx + 20, 316], fill=(160, 164, 162, 255))
    if flip:   # turn around before the lettering, so it still reads
        img = img.transpose(Image.FLIP_LEFT_RIGHT)
    if sticker:
        s = Image.new('RGBA', (300, 110), (0, 0, 0, 0))
        sd = ImageDraw.Draw(s)
        sd.rounded_rectangle([0, 0, 299, 109], 14, fill=(255, 236, 60, 255), outline=(30, 30, 30, 255), width=5)
        f = font(36)
        for i, line in enumerate(['RETURN', 'TO PLANT']):
            sd.text(((300 - sd.textlength(line, font=f)) / 2, 8 + i * 46), line, font=f, fill=(30, 30, 30, 255))
        s = s.rotate(-8, expand=True, resample=Image.BICUBIC)
        img.alpha_composite(s, (70 if flip else 250, 70))
    return img


def put(frame, img, cx, ground, scale=1.0, flip=False, tilt=0.0):
    if flip:
        img = img.transpose(Image.FLIP_LEFT_RIGHT)
    if scale != 1:
        img = img.resize((int(img.width * scale), int(img.height * scale)), Image.LANCZOS)
    if tilt:
        img = img.rotate(tilt, expand=True, resample=Image.BICUBIC)
    frame.alpha_composite(img, (int(cx - img.width / 2), int(ground - img.height + 10 * scale)))


def street(frame, t):
    """Night-ish sky, a job site fence, the road."""
    frame.alpha_composite(mp.BG_DARK)
    d = ImageDraw.Draw(frame)
    d.rectangle([0, GROUND - 20, mp.W, mp.H], fill=ROAD + (255,))
    off = (t * 600) % 160
    for x in range(-160, mp.W + 160, 160):
        d.rectangle([x - off * 0, GROUND + 150, x + 80, GROUND + 166], fill=(220, 200, 80, 255))
    # site fence and a poured slab form, in the back
    d.rectangle([60, GROUND - 160, mp.W - 60, GROUND - 150], fill=(150, 120, 80, 255))
    for x in range(80, mp.W - 40, 90):
        d.rectangle([x, GROUND - 200, x + 10, GROUND - 20], fill=(150, 120, 80, 255))


def bubble(frame, text, x, y, size, k, tail=(0, 1)):
    if k <= 0:
        return
    f = font(size)
    d = ImageDraw.Draw(frame)
    lines = text.split('\n')
    tw = max(d.textlength(l, font=f) for l in lines)
    lay = Image.new('RGBA', (int(tw + 70), int(size * 1.2 * len(lines) + 90)), (0, 0, 0, 0))
    ld = ImageDraw.Draw(lay)
    bh = lay.height - 50
    ld.rounded_rectangle([0, 0, lay.width - 1, bh], 34, fill=(255, 255, 255, 250))
    ld.polygon([(lay.width * 0.65, bh - 4), (lay.width * 0.8, lay.height - 1), (lay.width * 0.82, bh - 4)], fill=(255, 255, 255, 250))
    for i, l in enumerate(lines):
        ld.text(((lay.width - ld.textlength(l, font=f)) / 2, 20 + i * size * 1.2), l, font=f, fill=(20, 20, 20, 255))
    s = max(0.01, ease_back(k))
    lay = lay.resize((max(1, int(lay.width * s)), max(1, int(lay.height * s))), Image.LANCZOS)
    frame.alpha_composite(lay, (int(x - lay.width * 0.8), int(y - lay.height)))


def guy(frame, x, ground, t):
    """A stick-figure super on the phone, the free arm flapping."""
    d = ImageDraw.Draw(frame)
    c = (250, 250, 250, 255)
    w = 14
    hip = (x, ground - 210)
    neck = (x, ground - 380)
    d.line([hip, neck], fill=c, width=w)
    d.line([hip, (x - 60, ground)], fill=c, width=w)
    d.line([hip, (x + 60, ground)], fill=c, width=w)
    d.ellipse([x - 52, ground - 490, x + 52, ground - 386], outline=c, width=w)
    d.rounded_rectangle([x - 52, ground - 518, x + 52, ground - 476], 12, fill=(255, 210, 40, 255))   # hard hat
    d.line([neck, (x - 70, ground - 300), (x - 40, ground - 440)], fill=c, width=w, joint='curve')     # phone arm
    d.rounded_rectangle([x - 62, ground - 470, x - 30, ground - 420], 6, fill=(30, 30, 30, 255))
    a = math.sin(t * 14) * 0.6
    hx, hy = x + 70 + 40 * math.cos(a), ground - 400 - 70 * math.sin(a + 0.8)
    d.line([neck, (x + 60, ground - 320), (hx, hy)], fill=c, width=w, joint='curve')                   # flapping arm
    for i in range(3):    # sweat
        sy = ground - 470 + ((t * 300 + i * 50) % 120)
        d.ellipse([x + 60 + i * 14, sy, x + 74 + i * 14, sy + 22], fill=(120, 200, 255, 220))


def clock(frame, t, x, y):
    d = ImageDraw.Draw(frame)
    d.rounded_rectangle([x, y, x + 520, y + 200], 26, fill=(14, 16, 15, 255), outline=(80, 84, 82, 255), width=6)
    colon = ':' if int(t * 2) % 2 == 0 else ' '
    f = font(110)
    txt = f'4{colon}55'
    d.text((x + 40, y + 30), txt, font=f, fill=(255, 70, 60, 255))
    d.text((x + 345, y + 34), 'PM', font=font(54), fill=(255, 70, 60, 255))
    d.text((x + 345, y + 104), 'FRI', font=font(54), fill=(255, 70, 60, 255))


# --- scenes --------------------------------------------------------------------

def s_two_trucks(frame, t, d):
    street(frame, 0)
    arrive = ease_out(t / 1.0)
    # back truck: stays
    put(frame, truck(spin=t * 1.5), 300 + (1 - arrive) * 900, GROUND - 150, 1.1)
    # front truck: arrives, gets the sticker, leaves in shame
    leave = clamp((t - 2.0) / 1.2)
    stick = t > 1.75
    x = 700 + (1 - arrive) * 1200 + (leave ** 2) * 1500
    bob = math.sin(t * 30) * 4 * leave
    put(frame, truck(spin=t * 1.5, sticker=stick, sad=stick, flip=leave > 0), x, GROUND + 70 + bob, 1.3, tilt=-3 * leave)
    if leave > 0:   # exhaust puffs
        dd = ImageDraw.Draw(frame)
        for i in range(4):
            r = 20 + i * 18 + leave * 40
            px = x - 420 - i * 70
            dd.ellipse([px - r, GROUND - 40 - i * 20 - r, px + r, GROUND - 40 - i * 20 + r], fill=(200, 200, 200, max(0, 140 - i * 30)))
    caption(frame, 'ORDERED 2 TRUCKS...', t - 0.1, y=150, size=80)
    if t > 1.75:
        caption(frame, '...SENT ONE BACK', t - 1.75, y=330, size=74, box=RED, tilt=-3)


def s_friday(frame, t, d):
    street(frame, 0)
    put(frame, truck(spin=0, empty=True), 330, GROUND + 60, 1.15)
    guy(frame, 860, GROUND + 60, t)
    clock(frame, t, 280, 520)
    caption(frame, 'FRIDAY. 4:55 PM.', t - 0.05, y=150, size=84)
    bubble(frame, '1/2 YARD MORE??\nPLEASE??', 920, 1000, 62, (t - 0.9) / 0.35)


def s_meet(frame, t, d):
    frame.alpha_composite(mp.BG)
    place(frame, phone(frame_at('concrete-3d', t / (d - 0.1)), 700, (0, 1500)), t, top=430, enter=0.3, from_y=900)
    caption(frame, 'MEET A2 TAKEOFF CALC', t, y=110, size=76)
    if t > 1.7:
        caption(frame, 'ROUNDED UP TO\nWHAT YOU ORDER', t - 1.7, y=1600, size=62, box=GREEN_HI, tilt=-2)


def s_framing(frame, t, d):
    frame.alpha_composite(mp.BG)
    place(frame, phone(frame_at('wall-3d-turn', t / (d - 0.1)), 720, (0, 1528)), t, top=430, enter=0.3, from_y=0)
    words = [('STUD.', 0.7), ('KING.', 1.1), ('JACK.', 1.5), ('CRIPPLE.', 1.9)]
    shown = ' '.join(w for w, at in words if t >= at)
    if shown:
        caption(frame, shown, 0.4, y=110, size=70)
    if t > 2.6:
        caption(frame, '(REAL NAMES, WE SWEAR)', t - 2.6, y=1660, size=54, box=GREEN, tilt=2)


def s_window(frame, t, d):
    frame.alpha_composite(mp.BG_DARK)
    k = clamp(t / (d - 0.1))
    width, top, crop = 760, 280, 110
    ph = phone(frame_at('wall-drag', k), width, (crop, 1528))
    place(frame, ph, t, top=top, enter=0.3, from_y=0)
    idx = min(int(k * len(seq('wall-drag'))), len(mp.TOUCH) - 1)
    p = mp.TOUCH[idx]
    if p:
        sc = width / 390
        x = mp.W / 2 - ph.width / 2 + 60 + 16 + p[0] * sc
        y = top + 60 + 16 + (p[1] - crop / 2) * sc
        dot = Image.new('RGBA', (140, 140), (0, 0, 0, 0))
        dd = ImageDraw.Draw(dot)
        dd.ellipse([10, 10, 130, 130], fill=(255, 255, 255, 90), outline=(255, 255, 255, 230), width=6)
        dd.ellipse([46, 46, 94, 94], fill=(255, 255, 255, 200))
        frame.alpha_composite(dot, (int(x - 70), int(y - 70)))
    if t < 1.9:
        caption(frame, 'MOVED THE WINDOW.\nAGAIN?', t, y=60, size=66, box=RED, tilt=-2)
    else:
        caption(frame, 'JUST SLIDE IT.', t - 1.9, y=90, size=74, box=GREEN)


def s_block(frame, t, d):
    frame.alpha_composite(mp.BG)
    place(frame, phone(frame_at('block-3d', t / (d - 0.1)), 720, (0, 1340)), t, top=430, enter=0.3, from_y=0)
    caption(frame, 'BLOCK WALLS?', t, y=110, size=84)
    if t > 1.5:
        caption(frame, 'DONE BEFORE\nTHE PUMP SHOWS UP', t - 1.5, y=1600, size=60, box=GREEN, tilt=2)


def s_calc(frame, t, d):
    frame.alpha_composite(mp.BG)
    k = (t - 0.2) / (d - 0.6)
    place(frame, phone(frame_at('calc', k), 700, (0, 1460)), t, top=470, zoom=0.03, dur=d)
    caption(frame, "FEET · INCHES · 1/16\"", t, y=110, size=72)
    if t > 1.8:
        caption(frame, 'NO PENCIL REQUIRED', t - 1.8, y=290, size=58, box=GREEN, tilt=-2)


def s_free(frame, t, d):
    mp.s_free(frame, t * 1.35, d)


def s_end(frame, t, d):
    frame.alpha_composite(mp.BG)
    k = ease_back(t / 0.45)
    size = max(1, int(320 * k))
    icon = rounded(Image.open(mp.ICON).convert('RGB').resize((size, size), Image.LANCZOS), int(size * 0.22))
    frame.alpha_composite(icon, ((mp.W - size) // 2, 330 + (320 - size) // 2))
    if t > 0.25:
        caption(frame, 'A2 TAKEOFF CALC', t - 0.25, y=730, size=88)
    if t > 1.0:
        caption(frame, 'One truck.\nThe right truck.', t - 1.0, y=910, size=70, box=GREEN_HI, tilt=-2)
    # the right truck rolls in and parks
    roll = ease_out((t - 0.6) / 1.0)
    if t > 0.6:
        put(frame, truck(spin=t * 1.5, brand=True), mp.W / 2 + (1 - roll) * 900, 1640, 0.8)
    if t > 2.0:
        k2 = ease_out((t - 2.0) / 0.5)
        f = font(44)
        txt = 'Free  ·  by A2 Labs'
        dr = ImageDraw.Draw(frame)
        tw = dr.textlength(txt, font=f)
        dr.text(((mp.W - tw) / 2, 1740 + (1 - k2) * 40), txt, font=f, fill=(255, 255, 255, int(230 * k2)))
    # the plug, as the last line starts
    if t > PLUG_AT:
        caption(frame, 'USED DAILY AT A2 CONSTRUCTION', t - PLUG_AT, y=1180, size=44, box=GREEN, tilt=2)
    if t > PLUG_AT + 1.6:
        k3 = ease_out((t - PLUG_AT - 1.6) / 0.5)
        f = font(40)
        txt = 'A2 Construction  ·  a2cons.com'
        dr = ImageDraw.Draw(frame)
        tw = dr.textlength(txt, font=f)
        dr.text(((mp.W - tw) / 2, 1805 + (1 - k3) * 40), txt, font=f, fill=(255, 255, 255, int(200 * k3)))


mp.SCENES = [('vo01', s_two_trucks, 3.2), ('vo02', s_friday, 0), ('vo03', s_meet, 0), ('vo04', s_framing, 0),
             ('vo05', s_window, 4.0), ('vo06', s_block, 0), ('vo07', s_calc, 0), ('vo08', s_free, 2.3), ('vo09plug', s_end, 0)]
mp.s_end = s_end          # make_promo's timeline holds the last scene by this name
mp.END_HOLD = 0.3
mp.LEAD, mp.GAP = 0.1, 0.12   # a snappier read than v1

PLUG_AT = 3.0     # set from the clips in __main__
PLUG_GAP = 0.2    # pause between "The right truck." and the plug


def join_end_clips(vo):
    """vo09 + a pause + vo10 -> vo09plug.wav; returns when vo10 starts."""
    import wave
    with wave.open(str(vo / 'vo09.wav')) as a, wave.open(str(vo / 'vo10.wav')) as b:
        p = a.getparams()
        first = a.readframes(a.getnframes())
        rest = b.readframes(b.getnframes())
    with wave.open(str(vo / 'vo09plug.wav'), 'wb') as o:
        o.setparams(p)
        o.writeframes(first + b'\0' * (int(PLUG_GAP * p.framerate) * p.sampwidth * p.nchannels) + rest)
    return mp.LEAD + len(first) / (p.framerate * p.sampwidth * p.nchannels) + PLUG_GAP


if __name__ == '__main__':
    import sys
    from pathlib import Path
    PLUG_AT = join_end_clips(Path(sys.argv[sys.argv.index('--vo') + 1]))
    mp.main()
