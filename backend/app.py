"""
Flask API Server for AI Photo Detector
Security: Rate limiting, magic bytes validation, CSP headers, GDPR compliance
"""

import os
import io
import json
import time
import hashlib
import logging
from functools import wraps
from collections import defaultdict
from flask import Flask, request, jsonify, send_from_directory, make_response
from flask_cors import CORS
from werkzeug.utils import secure_filename
from PIL import Image
from dotenv import load_dotenv

# Load env
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

# Import engines
import sys
sys.path.insert(0, os.path.dirname(__file__))
from forensics_engine import run_full_analysis
from ai_restoration import run_ai_restoration
from video_generator import create_transition_gif, gif_to_base64

# ── Logging (GDPR: mask IPs) ───────────────────────────────────
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
logger = logging.getLogger(__name__)

def mask_ip(ip: str) -> str:
    """GDPR-compliant IP masking: keep only first 2 octets"""
    parts = ip.split('.')
    if len(parts) == 4:
        return f"{parts[0]}.{parts[1]}.x.x"
    return "x.x.x.x"

# ── Rate Limiter (in-memory, no Redis needed) ──────────────────
_rate_store: dict = defaultdict(list)
RATE_LIMIT_ANALYZE = (10, 60)   # 10 requests per 60 seconds
RATE_LIMIT_RESTORE = (5, 60)    # 5 requests per 60 seconds

def rate_limit(max_calls: int, period: int):
    def decorator(f):
        @wraps(f)
        def wrapped(*args, **kwargs):
            ip = request.headers.get('X-Forwarded-For', request.remote_addr or '').split(',')[0].strip()
            key = f.__name__ + ':' + ip
            now = time.time()
            _rate_store[key] = [t for t in _rate_store[key] if now - t < period]
            if len(_rate_store[key]) >= max_calls:
                logger.warning(f"Rate limit hit: {mask_ip(ip)} on {f.__name__}")
                return jsonify({
                    "error": "Too many requests. Please wait a moment.",
                    "retry_after": period
                }), 429
            _rate_store[key].append(now)
            return f(*args, **kwargs)
        return wrapped
    return decorator

# ── Security Headers ───────────────────────────────────────────
def add_security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    response.headers['Permissions-Policy'] = 'camera=(), microphone=(), geolocation=()'
    response.headers['Content-Security-Policy'] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com; "
        "font-src 'self' https://fonts.gstatic.com; "
        "img-src 'self' data: blob:; "
        "connect-src 'self' http://localhost:5001; "
        "frame-ancestors 'none';"
    )
    # GDPR: No tracking, no caching of user data
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate'
    response.headers['Pragma'] = 'no-cache'
    return response

app = Flask(__name__)
app.after_request(add_security_headers)

# CORS: restrict to same origin in production, allow localhost in dev
ALLOWED_ORIGINS = os.getenv('ALLOWED_ORIGINS', 'http://localhost:5001,http://127.0.0.1:5001').split(',')
CORS(app, origins=ALLOWED_ORIGINS, supports_credentials=False)

app.config['MAX_CONTENT_LENGTH'] = 20 * 1024 * 1024  # 20MB max (was 50MB)

ALLOWED_EXTENSIONS = {'jpg', 'jpeg', 'png', 'webp', 'bmp'}
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), '..', 'frontend')

# ── Magic Bytes Validation ─────────────────────────────────────
MAGIC_BYTES = {
    b'\xff\xd8\xff': 'jpeg',
    b'\x89PNG': 'png',
    b'RIFF': 'webp',     # RIFF....WEBP
    b'BM': 'bmp',
    b'GIF8': 'gif',
}

def validate_image_magic(data: bytes) -> bool:
    """Check actual file magic bytes, not just extension"""
    if data[:3] in MAGIC_BYTES or data[:4] in MAGIC_BYTES or data[:2] in MAGIC_BYTES:
        return True
    # WEBP: RIFF????WEBP
    if data[:4] == b'RIFF' and data[8:12] == b'WEBP':
        return True
    return False

def allowed_file(filename: str) -> bool:
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_request_hash(image_bytes: bytes) -> str:
    """Anonymous hash for logging — no personal data stored"""
    return hashlib.sha256(image_bytes[:1024]).hexdigest()[:16]

# ── Routes ─────────────────────────────────────────────────────
@app.route('/')
def index():
    return send_from_directory(FRONTEND_DIR, 'index.html')

@app.route('/<path:filename>')
def static_files(filename):
    return send_from_directory(FRONTEND_DIR, filename)

@app.route('/api/health', methods=['GET'])
def health():
    from ai_restoration import _has_valid_key
    openai_key  = os.getenv("OPENAI_API_KEY", "")
    gemini_key  = os.getenv("GEMINI_API_KEY", "")
    has_openai  = _has_valid_key(openai_key)
    has_gemini  = _has_valid_key(gemini_key)
    active_mode = "gemini" if has_gemini else ("openai" if has_openai else "mock")
    return jsonify({
        "status": "ok",
        "openai_enabled": has_openai,
        "gemini_enabled": has_gemini,
        "active_mode": active_mode,
        "version": "2.0.0"
    })

@app.route('/api/analyze', methods=['POST'])
@rate_limit(*RATE_LIMIT_ANALYZE)
def analyze():
    ip = mask_ip(request.headers.get('X-Forwarded-For', request.remote_addr or ''))

    if 'file' not in request.files:
        return jsonify({"success": False, "error": "파일이 업로드되지 않았습니다."}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"success": False, "error": "파일명이 없습니다."}), 400

    # Extension check
    if not allowed_file(file.filename):
        return jsonify({"success": False, "error": "지원하지 않는 파일 형식. JPG, PNG, WEBP, BMP만 허용됩니다."}), 400

    try:
        image_bytes = file.read()

        # Size check (belt & suspenders)
        if len(image_bytes) > 20 * 1024 * 1024:
            return jsonify({"success": False, "error": "파일 크기가 20MB를 초과합니다."}), 400

        # Magic bytes validation (prevent polyglot/path traversal attacks)
        if not validate_image_magic(image_bytes):
            logger.warning(f"Invalid magic bytes from {ip}")
            return jsonify({"success": False, "error": "유효하지 않은 이미지 파일입니다."}), 400

        # PIL validation
        try:
            img_test = Image.open(io.BytesIO(image_bytes))
            img_test.verify()
        except Exception:
            return jsonify({"success": False, "error": "이미지 파일이 손상되었거나 유효하지 않습니다."}), 400

        req_hash = get_request_hash(image_bytes)
        logger.info(f"analyze request from {ip} hash={req_hash} size={len(image_bytes)}")

        forensics_result = run_full_analysis(image_bytes)

        # GDPR: do not log or store image content, only anonymous hash
        logger.info(f"analyze complete hash={req_hash} score={forensics_result['overall']['score']}")

        return jsonify({"success": True, "forensics": forensics_result})

    except Exception as e:
        logger.error(f"analyze error from {ip}: {str(e)}")
        return jsonify({"success": False, "error": f"분석 중 오류 발생: {str(e)}"}), 500


@app.route('/api/restore', methods=['POST'])
@rate_limit(*RATE_LIMIT_RESTORE)
def restore():
    ip = mask_ip(request.headers.get('X-Forwarded-For', request.remote_addr or ''))

    if 'file' not in request.files:
        return jsonify({"success": False, "error": "파일이 업로드되지 않았습니다."}), 400

    data = request.form.get('forensics')
    if not data:
        return jsonify({"success": False, "error": "포렌식 분석 데이터가 없습니다."}), 400

    try:
        forensics_result = json.loads(data)

        _strip_b64_keys = {'heatmap_b64', 'overlay_b64', 'enhanced_b64', 'original_b64', 'composite_overlay_b64'}
        def strip_b64(d):
            if isinstance(d, dict):
                return {k: strip_b64(v) for k, v in d.items() if k not in _strip_b64_keys}
            return d
        forensics_slim = strip_b64(forensics_result)

        file = request.files['file']
        image_bytes = file.read()

        # Re-validate on restore endpoint too
        if not validate_image_magic(image_bytes):
            return jsonify({"success": False, "error": "유효하지 않은 이미지 파일입니다."}), 400

        img_pil = Image.open(io.BytesIO(image_bytes))
        restoration_result = run_ai_restoration(img_pil, forensics_slim)

        # Transition GIF
        try:
            import base64 as _b64
            rest_local = restoration_result.get("local", {})
            rest_b64   = rest_local.get("restored_b64", "")
            if rest_b64:
                quick = run_full_analysis(image_bytes)
                orig_pil = Image.open(io.BytesIO(_b64.b64decode(quick["original_b64"])))
                comp_pil = Image.open(io.BytesIO(_b64.b64decode(quick["composite_overlay_b64"])))
                rest_pil = Image.open(io.BytesIO(_b64.b64decode(rest_b64)))
                gif_bytes = create_transition_gif(orig_pil, comp_pil, rest_pil)
                restoration_result["transition_gif_b64"] = gif_to_base64(gif_bytes)
        except Exception as gif_err:
            restoration_result["transition_gif_b64"] = None
            restoration_result["gif_error"] = str(gif_err)

        logger.info(f"restore complete from {ip} mode={restoration_result.get('mode')}")
        return jsonify({"success": True, "restoration": restoration_result})

    except Exception as e:
        logger.error(f"restore error from {ip}: {str(e)}")
        return jsonify({"success": False, "error": f"복원 중 오류 발생: {str(e)}"}), 500


if __name__ == '__main__':
    print("\n" + "="*60)
    print("  🔍 ForensicLens Backend v2.0")
    print("="*60)
    from ai_restoration import _has_valid_key
    gemini_key = os.getenv("GEMINI_API_KEY", "")
    openai_key = os.getenv("OPENAI_API_KEY", "")
    print(f"  {'✅' if _has_valid_key(gemini_key) else '⚪'} Gemini API: {'활성화 (gemini-2.5-flash)' if _has_valid_key(gemini_key) else '미설정'}")
    print(f"  {'✅' if _has_valid_key(openai_key) else '⚪'} OpenAI API: {'활성화 (GPT-4o + DALL-E 3)' if _has_valid_key(openai_key) else '미설정'}")
    print(f"  🔒 Rate limit: analyze={RATE_LIMIT_ANALYZE}, restore={RATE_LIMIT_RESTORE}")
    print(f"  🛡  Security headers: CSP, X-Frame-Options, GDPR-compliant logging")
    print(f"\n  🌐 서버 주소: http://localhost:5001")
    print("="*60 + "\n")
    app.run(debug=True, port=5001, host='0.0.0.0')
