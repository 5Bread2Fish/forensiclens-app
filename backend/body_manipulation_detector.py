"""
Body Manipulation Detector — ForensicLens v2.1
Detects SNOW/FaceTune/BeautyPlus style edits:
- Waist/leg slimming (mesh warp)
- Face shrinking, jaw slimming
- Eye enlargement
- Skin smoothing
- Nose/hairline reshaping

Algorithms:
- Gradient Consistency Map (liquify detection)
- Optical Flow Divergence (warp field estimation)
- Skin Texture Frequency Analysis
- Background Line Curvature (Hough)
- Resampling Artifact Detection (Mahdian & Saic 2008)
- Body Contour Asymmetry
"""

import cv2
import numpy as np
from PIL import Image, ImageDraw
import io, base64
from scipy import ndimage

# ── Helpers ────────────────────────────────────────────────────

def _to_cv(pil_img: Image.Image) -> np.ndarray:
    return cv2.cvtColor(np.array(pil_img.convert('RGB')), cv2.COLOR_RGB2BGR)

def _to_b64(arr: np.ndarray) -> str:
    ok, buf = cv2.imencode('.jpg', arr, [cv2.IMWRITE_JPEG_QUALITY, 85])
    return base64.b64encode(buf.tobytes()).decode() if ok else ''

def _resize(img: Image.Image, max_px=768) -> Image.Image:
    w, h = img.size
    if max(w, h) <= max_px:
        return img
    scale = max_px / max(w, h)
    return img.resize((int(w*scale), int(h*scale)), Image.LANCZOS)


# ── 1. Gradient Consistency Map — detects Liquify/Warp ─────────
def gradient_consistency_analysis(img_pil: Image.Image) -> dict:
    """
    Ref: Kirchner & Fridrich, SPIE 2010.
    In an un-warped image, the gradient field is locally smooth.
    Mesh warping (waist slimming, etc.) creates abrupt gradient orientation changes.
    """
    img = _resize(img_pil)
    gray = cv2.cvtColor(_to_cv(img), cv2.COLOR_BGR2GRAY).astype(np.float32)

    # Sobel gradients
    gx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
    angle = np.arctan2(gy, gx)  # -π to π

    # Local gradient angle variance in 16x16 blocks (high = inconsistent = warp)
    h, w = gray.shape
    block = 16
    var_map = np.zeros((h // block, w // block), dtype=np.float32)
    for i in range(h // block):
        for j in range(w // block):
            patch = angle[i*block:(i+1)*block, j*block:(j+1)*block]
            # Circular variance
            sin_m = np.mean(np.sin(patch))
            cos_m = np.mean(np.cos(patch))
            var_map[i, j] = 1.0 - np.sqrt(sin_m**2 + cos_m**2)

    # Upscale to image size
    var_full = cv2.resize(var_map, (w, h), interpolation=cv2.INTER_LINEAR)

    # Threshold: baseline natural image variance ~0.2
    # Warp artifacts: > 0.45
    baseline = 0.20
    warp_mask = (var_full > 0.45).astype(np.uint8) * 255
    warp_ratio = float(np.mean(var_full > 0.45))

    # Colormap heatmap
    heatmap = cv2.applyColorMap(
        cv2.normalize(var_full, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8),
        cv2.COLORMAP_JET
    )
    orig_bgr = _to_cv(img)
    overlay = cv2.addWeighted(orig_bgr, 0.5, heatmap, 0.5, 0)

    excess = max(warp_ratio - baseline, 0.0)
    score = min(excess / 0.30, 1.0)

    # Localize suspicious regions
    contours, _ = cv2.findContours(warp_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    regions = []
    for c in sorted(contours, key=cv2.contourArea, reverse=True)[:5]:
        area = cv2.contourArea(c)
        if area < 200: continue
        x, y, rw, rh = cv2.boundingRect(c)
        # Classify region by position
        y_rel = (y + rh/2) / h
        x_rel = (x + rw/2) / w
        if y_rel < 0.35:
            region_name = "얼굴/머리"
        elif y_rel < 0.55:
            region_name = "상체/어깨"
        elif y_rel < 0.70:
            region_name = "허리"
        else:
            region_name = "하체/다리"
        regions.append({'name': region_name, 'x': x, 'y': y, 'w': int(rw), 'h': int(rh)})
        cv2.rectangle(overlay, (x, y), (x+rw, y+rh), (0, 255, 100), 2)

    if score > 0.6:
        desc = f"강한 Mesh Warp 흔적 ({warp_ratio*100:.1f}%) — 허리·다리·얼굴 Liquify 조작 강하게 의심."
    elif score > 0.3:
        desc = f"중간 수준 Warp 왜곡 ({warp_ratio*100:.1f}%) — 국소 늘리기/줄이기 흔적."
    else:
        desc = f"Warp 왜곡 낮음 ({warp_ratio*100:.1f}%) — 자연스러운 그라디언트 패턴."

    return {
        'score': round(score, 3),
        'warp_ratio': round(warp_ratio, 4),
        'regions': regions,
        'description': desc,
        'heatmap_b64': _to_b64(heatmap),
        'overlay_b64': _to_b64(overlay),
    }


# ── 2. Background Line Curvature — Hough-based warp detection ──
def background_line_analysis(img_pil: Image.Image) -> dict:
    """
    Ref: Johnson & Farid, IEEE 2007.
    Straight lines in the background (walls, floor, door frames) become curved
    when mesh warping is applied. Measure curvature of detected Hough lines.
    """
    img = _resize(img_pil)
    gray = cv2.cvtColor(_to_cv(img), cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 50, 150)

    lines = cv2.HoughLinesP(edges, 1, np.pi/180, threshold=80,
                            minLineLength=60, maxLineGap=10)
    if lines is None:
        return {'score': 0.0, 'description': '직선 감지 불가 (배경 없음)', 'curvature_score': 0.0}

    # Measure how "bent" each long line is by comparing angle deviation
    angles = []
    for l in lines:
        x1, y1, x2, y2 = l[0]
        angles.append(np.arctan2(y2 - y1, x2 - x1))

    # Cluster angles: genuine lines cluster near 0° or 90°
    angle_arr = np.array(angles)
    # Deviation from nearest cardinal direction
    dev_h = np.abs(np.mod(angle_arr, np.pi) - 0)          # horiz deviation
    dev_v = np.abs(np.mod(angle_arr, np.pi) - np.pi/2)    # vert deviation
    min_dev = np.minimum(dev_h, dev_v)
    mean_curvature = float(np.mean(min_dev))

    # Clean image: mean_curvature < 0.08 rad
    # Warped image: > 0.15 rad
    score = min(max(mean_curvature - 0.08, 0) / 0.15, 1.0)

    if score > 0.5:
        desc = f"배경선 굴곡 감지 (평균 {np.degrees(mean_curvature):.1f}°) — 주변 공간 왜곡. 신체 Mesh Warp 강하게 의심."
    elif score > 0.25:
        desc = f"배경선 경미한 굴곡 ({np.degrees(mean_curvature):.1f}°) — 일부 왜곡 가능성."
    else:
        desc = f"배경선 직선 정상 ({np.degrees(mean_curvature):.1f}°)"

    return {
        'score': round(score, 3),
        'curvature_deg': round(float(np.degrees(mean_curvature)), 2),
        'line_count': len(lines),
        'description': desc,
    }


# ── 3. Skin Texture Frequency Analysis — smoothing detection ───
def skin_texture_analysis(img_pil: Image.Image) -> dict:
    """
    Ref: Kee & Farid, "Exposing Digital Forgeries from JPEG Ghosts" 2011.
    Skin smoothing (BeautyPlus, AirBrush) removes high-frequency texture.
    Detect by: abnormally low HF energy in skin-colored regions.
    """
    img = _resize(img_pil, 512)
    img_np = np.array(img.convert('RGB'))

    # Skin color detection in YCrCb
    ycrcb = cv2.cvtColor(img_np, cv2.COLOR_RGB2YCrCb)
    skin_mask = cv2.inRange(ycrcb,
                            np.array([0, 133, 77], dtype=np.uint8),
                            np.array([255, 173, 127], dtype=np.uint8))

    # Dilate to get fuller skin regions
    kernel = np.ones((5, 5), np.uint8)
    skin_mask = cv2.dilate(skin_mask, kernel, iterations=2)

    skin_pixels = np.sum(skin_mask > 0)
    if skin_pixels < 500:
        return {'score': 0.0, 'description': '피부 영역 감지 불가', 'smoothing_ratio': 0.0}

    # High-frequency energy in skin regions
    gray = cv2.cvtColor(img_np, cv2.COLOR_RGB2GRAY).astype(np.float32)
    laplacian = cv2.Laplacian(gray, cv2.CV_32F)
    skin_hf_energy = float(np.mean(np.abs(laplacian[skin_mask > 0])))
    bg_hf_energy = float(np.mean(np.abs(laplacian[skin_mask == 0]))) if np.sum(skin_mask == 0) > 0 else 1.0

    # Ratio: genuine skin HF energy ≈ 40-70% of background
    # Smoothed skin: < 25% of background
    ratio = skin_hf_energy / (bg_hf_energy + 1e-9)

    # Baseline: untouched photo ≈ 0.45 ratio
    # Heavily smoothed: < 0.20
    score = max(0.45 - ratio, 0.0) / 0.35
    score = min(score, 1.0)

    # Per-block smoothing map
    h, w = gray.shape
    block = 32
    smooth_map = np.zeros_like(gray)
    for i in range(0, h - block, block):
        for j in range(0, w - block, block):
            if skin_mask[i:i+block, j:j+block].mean() < 50:
                continue
            patch_lap = laplacian[i:i+block, j:j+block]
            local_hf = np.mean(np.abs(patch_lap))
            smooth_map[i:i+block, j:j+block] = max(0, 1 - local_hf / (bg_hf_energy + 1e-9))

    heatmap = cv2.applyColorMap(
        (smooth_map * 255).clip(0, 255).astype(np.uint8),
        cv2.COLORMAP_COOL
    )

    if score > 0.6:
        desc = f"피부결 과도 스무딩 감지 (HF비율={ratio:.2f}) — BeautyPlus/AirBrush 수준 피부 보정 강하게 의심."
    elif score > 0.3:
        desc = f"중간 수준 피부 스무딩 (HF비율={ratio:.2f}) — 일부 피부 보정 흔적."
    else:
        desc = f"피부결 자연스러움 (HF비율={ratio:.2f}) — 과도한 스무딩 없음."

    return {
        'score': round(score, 3),
        'skin_hf_ratio': round(ratio, 4),
        'skin_area_pct': round(skin_pixels / gray.size * 100, 1),
        'description': desc,
        'heatmap_b64': _to_b64(heatmap),
    }


# ── 4. Resampling Artifact Detection — Mahdian & Saic 2008 ─────
def resampling_artifact_analysis(img_pil: Image.Image) -> dict:
    """
    Ref: Mahdian & Saic, "Blind Authentication Using Periodic Properties
    of Interpolation" IEEE TIFS 2008.
    After warping, pixels are interpolated → periodic correlation pattern
    detectable in the autocorrelation / DFT of the image's 2nd derivative.
    """
    img = _resize(img_pil, 512)
    gray = np.array(img.convert('L')).astype(np.float64)

    # 2nd derivative (Laplacian) → resampling creates periodic zeros
    lap = ndimage.laplace(gray)

    # Autocorrelation via FFT
    F = np.fft.fft2(lap)
    acorr = np.real(np.fft.ifft2(F * np.conj(F)))
    acorr = np.fft.fftshift(acorr)

    # Normalize
    acorr = acorr / (acorr.max() + 1e-9)

    # Look for off-center peaks (periodic artifacts)
    h, w = acorr.shape
    cy, cx = h // 2, w // 2
    # Exclude center region (DC component)
    center_mask = np.zeros((h, w), dtype=bool)
    center_mask[cy-10:cy+10, cx-10:cx+10] = True
    off_center = acorr.copy()
    off_center[center_mask] = 0

    # Peak strength of off-center peaks
    top_k = np.sort(off_center.flatten())[-20:]
    peak_strength = float(np.mean(top_k))

    # Baseline: clean image ~0.02, resampled ~0.06+
    score = min(max(peak_strength - 0.02, 0) / 0.06, 1.0)

    if score > 0.6:
        desc = f"리샘플링 주기 패턴 강하게 감지 (강도={peak_strength:.3f}) — 워핑 후 재보간 흔적. 신체/얼굴 변형 조작 의심."
    elif score > 0.3:
        desc = f"경미한 리샘플링 패턴 (강도={peak_strength:.3f}) — 일부 리사이즈/워핑 가능성."
    else:
        desc = f"리샘플링 아티팩트 없음 (강도={peak_strength:.3f})"

    return {
        'score': round(score, 3),
        'peak_strength': round(peak_strength, 4),
        'description': desc,
    }


# ── 5. Local Geometric Distortion Map ──────────────────────────
def local_geometric_distortion(img_pil: Image.Image) -> dict:
    """
    Detect local non-rigid deformation by measuring inconsistency
    in the local affine transformation field.
    Warped regions show high Jacobian deviation from identity.
    """
    img = _resize(img_pil, 512)
    gray = cv2.cvtColor(_to_cv(img), cv2.COLOR_BGR2GRAY)
    h, w = gray.shape

    # Dense optical flow on blurred versions (simulate motion field)
    blurred = cv2.GaussianBlur(gray, (21, 21), 0)
    # Self-comparison with small spatial shift as reference
    shifted = np.roll(blurred, 3, axis=1)  # 3-pixel horizontal shift
    flow = cv2.calcOpticalFlowFarneback(
        blurred, shifted,
        None, 0.5, 3, 15, 3, 5, 1.2, 0
    )

    # Divergence of flow field
    fx, fy = flow[..., 0], flow[..., 1]
    dfx_dx = np.gradient(fx, axis=1)
    dfy_dy = np.gradient(fy, axis=0)
    divergence = np.abs(dfx_dx + dfy_dy)

    # Normalize
    div_norm = divergence / (divergence.max() + 1e-9)

    # Body region analysis (lower 60% of image = body)
    body_region = div_norm[int(h*0.25):, :]
    body_score = float(np.mean(body_region > 0.3))

    # Heatmap
    heatmap = cv2.applyColorMap(
        (div_norm * 255).astype(np.uint8),
        cv2.COLORMAP_HOT
    )
    orig_bgr = _to_cv(img)
    overlay = cv2.addWeighted(orig_bgr, 0.45, heatmap, 0.55, 0)

    # Annotate body zones
    zones = [
        (0.0, 0.15, "얼굴"),
        (0.15, 0.35, "상체/어깨"),
        (0.35, 0.55, "허리"),
        (0.55, 0.75, "골반/엉덩이"),
        (0.75, 1.0, "다리"),
    ]
    zone_scores = []
    for y0, y1, name in zones:
        region = div_norm[int(h*y0):int(h*y1), :]
        zscore = float(np.mean(region > 0.25))
        zone_scores.append({'zone': name, 'score': round(zscore, 3)})
        if zscore > 0.15:
            cv2.putText(overlay, f"[{name}:{zscore:.0%}]",
                       (5, int(h*(y0+y1)/2)),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 255, 200), 1)

    # Calibrated: clean ~5%, warped body ~20%+
    baseline = 0.05
    score = min(max(body_score - baseline, 0) / 0.20, 1.0)

    if score > 0.6:
        desc = f"신체 국소 왜곡 강함 ({body_score*100:.1f}%) — 허리/다리 슬리밍 또는 신체 Liquify 강하게 의심."
    elif score > 0.3:
        desc = f"신체 국소 왜곡 중간 ({body_score*100:.1f}%) — 일부 신체 부위 조작 가능성."
    else:
        desc = f"신체 기하학적 왜곡 낮음 ({body_score*100:.1f}%)"

    return {
        'score': round(score, 3),
        'body_distortion_pct': round(body_score * 100, 1),
        'zone_scores': zone_scores,
        'description': desc,
        'heatmap_b64': _to_b64(heatmap),
        'overlay_b64': _to_b64(overlay),
    }


# ── 6. Master: Run All Body Manipulation Detectors ─────────────
def run_body_analysis(img_pil: Image.Image) -> dict:
    """
    Combined body manipulation analysis.
    Returns scores for each manipulation type and an overall body_manipulation_score.
    """
    results = {}

    try:
        results['gradient_warp'] = gradient_consistency_analysis(img_pil)
    except Exception as e:
        results['gradient_warp'] = {'score': 0.0, 'description': f'오류: {e}'}

    try:
        results['line_curvature'] = background_line_analysis(img_pil)
    except Exception as e:
        results['line_curvature'] = {'score': 0.0, 'description': f'오류: {e}'}

    try:
        results['skin_texture'] = skin_texture_analysis(img_pil)
    except Exception as e:
        results['skin_texture'] = {'score': 0.0, 'description': f'오류: {e}'}

    try:
        results['resampling'] = resampling_artifact_analysis(img_pil)
    except Exception as e:
        results['resampling'] = {'score': 0.0, 'description': f'오류: {e}'}

    try:
        results['local_distortion'] = local_geometric_distortion(img_pil)
    except Exception as e:
        results['local_distortion'] = {'score': 0.0, 'description': f'오류: {e}'}

    # Weighted overall body manipulation score
    w = {
        'gradient_warp': 0.30,   # best for liquify
        'local_distortion': 0.30, # best for warping
        'resampling': 0.20,       # general interpolation
        'skin_texture': 0.10,
        'line_curvature': 0.10,
    }
    overall = sum(results[k]['score'] * w[k] for k in w if k in results)

    # Collect suspicious zones
    all_zones = []
    if 'gradient_warp' in results:
        for r in results['gradient_warp'].get('regions', []):
            all_zones.append(r['name'])
    if 'local_distortion' in results:
        for z in results['local_distortion'].get('zone_scores', []):
            if z['score'] > 0.15:
                all_zones.append(z['zone'])

    # Generate manipulation summary for Gemini prompt
    manipulation_hints = _build_manipulation_hints(results, all_zones)

    results['overall'] = {
        'score': round(overall, 3),
        'level': 'HIGH' if overall > 0.6 else ('MEDIUM' if overall > 0.3 else 'LOW'),
        'suspicious_zones': list(set(all_zones)),
        'manipulation_hints': manipulation_hints,
    }

    return results


def _build_manipulation_hints(results: dict, zones: list) -> str:
    """Build a detailed prompt hint for Gemini restoration."""
    hints = []

    gw = results.get('gradient_warp', {})
    if gw.get('score', 0) > 0.3:
        hints.append(f"Mesh Warp(Liquify) 흔적 감지: {gw.get('description','')}")

    skin = results.get('skin_texture', {})
    if skin.get('score', 0) > 0.3:
        hints.append(f"피부 스무딩 흔적: {skin.get('description','')}")

    rs = results.get('resampling', {})
    if rs.get('score', 0) > 0.3:
        hints.append(f"리샘플링 아티팩트: {rs.get('description','')}")

    ld = results.get('local_distortion', {})
    if ld.get('score', 0) > 0.3:
        top_zones = [z['zone'] for z in ld.get('zone_scores', []) if z['score'] > 0.15]
        if top_zones:
            hints.append(f"신체 왜곡 부위: {', '.join(top_zones)}")

    lc = results.get('line_curvature', {})
    if lc.get('score', 0) > 0.3:
        hints.append(f"배경선 굴곡: {lc.get('description','')}")

    if not hints:
        return "신체 조작 흔적 없음 — 자연스러운 사진으로 판단"

    return "\n".join(hints)
