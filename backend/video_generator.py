"""
ForensicLens Transition Video Generator
Creates animated GIF: Original → Manipulation Detected → Estimated Original
"""

import io
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import base64

FONT_CANDIDATES = [
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
    "/System/Library/Fonts/Geneva.ttf",
]

def _font(size=20):
    for p in FONT_CANDIDATES:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                pass
    return ImageFont.load_default()


def _add_label(img: Image.Image, text: str, sub: str = "",
               bar_color=(15, 15, 25), accent=(99, 102, 241)) -> Image.Image:
    """Add bottom label bar with phase name."""
    w, h = img.size
    bar_h = max(48, h // 9)
    out = img.convert("RGB").copy()
    draw = ImageDraw.Draw(out)

    # Gradient-ish bar
    for i in range(bar_h):
        alpha_v = int(220 * (1 - i / bar_h * 0.3))
        draw.line([(0, h - bar_h + i), (w, h - bar_h + i)],
                  fill=(bar_color[0], bar_color[1], bar_color[2]))

    # Accent top line
    draw.line([(0, h - bar_h), (w, h - bar_h)], fill=accent, width=3)

    # Main text
    fnt = _font(max(16, bar_h // 2 - 2))
    bb = draw.textbbox((0, 0), text, font=fnt)
    tx = max(8, (w - (bb[2] - bb[0])) // 2)
    ty = h - bar_h + max(4, (bar_h // 2 - (bb[3] - bb[1])) // 2 - 2)
    draw.text((tx, ty), text, fill=(255, 255, 255), font=fnt)

    # Sub text
    if sub:
        sfnt = _font(max(11, bar_h // 4))
        sb = draw.textbbox((0, 0), sub, font=sfnt)
        sx = max(8, (w - (sb[2] - sb[0])) // 2)
        sy = ty + (bb[3] - bb[1]) + 2
        draw.text((sx, sy), sub, fill=(160, 165, 200), font=sfnt)

    return out


def _add_scan_overlay(img: Image.Image, scan_y: int,
                      color=(239, 68, 68)) -> Image.Image:
    """Animated scan line effect (red sweep line)."""
    out = img.copy()
    draw = ImageDraw.Draw(out)
    h = img.height
    sweep_h = max(4, h // 60)
    for dy in range(sweep_h):
        y = scan_y + dy
        if 0 <= y < h:
            alpha = 1.0 - abs(dy - sweep_h // 2) / (sweep_h / 2 + 1)
            c = tuple(int(c * alpha) for c in color)
            draw.line([(0, y), (img.width, y)], fill=c, width=1)
    return out


def _crossfade(img_a: Image.Image, img_b: Image.Image, t: float) -> Image.Image:
    """Linear crossfade between two images. t in [0,1]."""
    a = np.array(img_a, dtype=np.float32)
    b = np.array(img_b, dtype=np.float32)
    blended = (a * (1 - t) + b * t).clip(0, 255).astype(np.uint8)
    return Image.fromarray(blended)


def _normalise_size(imgs, max_dim=640):
    """Resize all images to same dimensions."""
    # Find target size from first image
    w, h = imgs[0].size
    scale = min(1.0, max_dim / max(w, h))
    tw, th = int(w * scale), int(h * scale)
    return [img.resize((tw, th), Image.LANCZOS).convert("RGB") for img in imgs]


def create_transition_gif(
    original: Image.Image,
    composite_overlay: Image.Image,
    restored: Image.Image,
    max_dim: int = 540,
    frame_duration_ms: int = 80,
) -> bytes:
    """
    Generate animated GIF with three phases:
    1. Original (hold)
    2. Scan sweep → fade to composite overlay (manipulation detected)
    3. Hold overlay
    4. Fade to restored
    5. Hold restored
    Returns raw GIF bytes.
    """
    imgs = _normalise_size([original, composite_overlay, restored], max_dim)
    orig, overlay, rest = imgs
    w, h = orig.size

    frames = []

    # ── Phase 1: Show original (8 frames) ──────────────────
    lbl_orig = _add_label(orig, "ORIGINAL", "업로드된 사진", accent=(99, 102, 241))
    for _ in range(8):
        frames.append(lbl_orig)

    # ── Phase 2: Scan sweep (16 frames) ────────────────────
    for i in range(16):
        scan_y = int((i / 15) * h)
        t = i / 15
        # Progressively blend toward overlay while scan runs
        blended = _crossfade(orig, overlay, t * 0.6)
        frame = _add_scan_overlay(blended, scan_y, color=(239, 68, 68))
        frame = _add_label(frame, "분석 중...", f"{'█' * (i+1)}{'░' * (15-i)}", accent=(239, 68, 68))
        frames.append(frame)

    # ── Phase 3: Full overlay / manipulation highlighted (10 frames) ──
    lbl_ov = _add_label(overlay, "조작 흔적 감지됨", "Manipulation Detected", accent=(239, 68, 68))
    for _ in range(10):
        frames.append(lbl_ov)

    # ── Phase 4: Crossfade overlay → restored (16 frames) ──
    for i in range(16):
        t = i / 15
        blended = _crossfade(overlay, rest, t)
        frame = _add_label(blended, "원본 복원 중...", f"{'█' * (i+1)}{'░' * (15-i)}", accent=(168, 85, 247))
        frames.append(frame)

    # ── Phase 5: Hold restored (12 frames) ─────────────────
    lbl_rest = _add_label(rest, "추정 원본 이미지", "Estimated Original", accent=(16, 185, 129))
    for _ in range(12):
        frames.append(lbl_rest)

    # ── Phase 6: Crossfade restored → original (8 frames, loop) ──
    for i in range(8):
        t = i / 7
        blended = _crossfade(rest, orig, t)
        frame = _add_label(blended, "비교", "Before / After", accent=(99, 102, 241))
        frames.append(frame)

    # Encode as animated GIF
    buf = io.BytesIO()
    frames[0].save(
        buf,
        format="GIF",
        save_all=True,
        append_images=frames[1:],
        duration=frame_duration_ms,
        loop=0,
        optimize=False,
    )
    return buf.getvalue()


def gif_to_base64(gif_bytes: bytes) -> str:
    return base64.b64encode(gif_bytes).decode("utf-8")
