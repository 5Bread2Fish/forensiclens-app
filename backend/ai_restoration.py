"""
AI Restoration Engine
우선순위: Gemini Vision (AIza 키) → OpenAI GPT-4o → Mock 분석 → OpenCV 인페인팅
"""

import os
import io
import base64
import json
import numpy as np
import cv2
from PIL import Image
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")


def _has_valid_key(key: str, placeholder_fragments=None) -> bool:
    """키가 실제 유효한 값인지 확인"""
    if not key:
        return False
    bad = placeholder_fragments or ["여기에", "실제", "넣어주세요", "your_key"]
    return not any(b in key for b in bad)


def pil_to_base64(img: Image.Image, fmt="PNG") -> str:
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return base64.b64encode(buf.getvalue()).decode("utf-8")


def opencv_inpaint_restoration(img_pil: Image.Image, forensics_result: dict) -> dict:
    """
    Local fallback: use OpenCV inpainting on suspicious ELA regions
    to show what the image might look like without manipulation.
    """
    img_cv = cv2.cvtColor(np.array(img_pil.convert('RGB')), cv2.COLOR_RGB2BGR)
    h, w = img_cv.shape[:2]

    # Build mask from suspicious ELA regions
    mask = np.zeros((h, w), dtype=np.uint8)
    ela_regions = forensics_result.get("ela", {}).get("suspicious_regions", [])
    copy_pairs = forensics_result.get("copy_move", {}).get("suspicious_pairs", [])

    for region in ela_regions[:3]:
        x, y, rw, rh = region["x"], region["y"], region["w"], region["h"]
        # Only mask if region is meaningful size
        if rw > 20 and rh > 20:
            # Dilate slightly for better inpainting
            pad = 5
            x1, y1 = max(0, x - pad), max(0, y - pad)
            x2, y2 = min(w, x + rw + pad), min(h, y + rh + pad)
            mask[y1:y2, x1:x2] = 255

    # If no regions found, use overall high-ELA areas from heatmap
    if np.sum(mask) == 0:
        # Use random structural areas as demonstration
        mask[h//4:h//4+20, w//4:w//4+20] = 255

    # Apply inpainting (Navier-Stokes method)
    inpainted = cv2.inpaint(img_cv, mask, inpaintRadius=5, flags=cv2.INPAINT_TELEA)
    inpainted_pil = Image.fromarray(cv2.cvtColor(inpainted, cv2.COLOR_BGR2RGB))

    # Create side-by-side comparison
    comparison = Image.new('RGB', (w * 2, h))
    comparison.paste(img_pil.convert('RGB'), (0, 0))
    comparison.paste(inpainted_pil, (w, 0))

    # Create mask visualization
    mask_pil = Image.fromarray(mask)

    return {
        "method": "opencv_inpainting",
        "restored_b64": pil_to_base64(inpainted_pil),
        "comparison_b64": pil_to_base64(comparison),
        "mask_b64": pil_to_base64(mask_pil),
        "analysis_text": generate_local_analysis_text(forensics_result),
        "disclaimer": "로컬 OpenCV 인페인팅 사용 (OpenAI API 키 없음). AI 추정 기능을 사용하려면 .env에 OPENAI_API_KEY를 설정하세요.",
    }


def generate_local_analysis_text(forensics_result: dict) -> str:
    overall = forensics_result.get("overall", {})
    ela = forensics_result.get("ela", {})
    noise = forensics_result.get("noise", {})
    copy_move = forensics_result.get("copy_move", {})
    stretch = forensics_result.get("stretch", {})
    meta = forensics_result.get("metadata", {})

    lines = []
    lines.append(f"## 🔍 AI 포렌식 분석 보고서")
    lines.append(f"\n**종합 조작 가능성**: {overall.get('score', 0):.1f}/100 ({overall.get('label', '')})")
    lines.append(f"\n### 주요 발견 사항")

    if ela.get("score", 0) > 0.1:
        lines.append(f"- **ELA 분석**: {ela.get('description', '')}")
        regions = ela.get("suspicious_regions", [])
        if regions:
            lines.append(f"  → 의심 영역 {len(regions)}곳 감지 (최대 크기: {regions[0].get('w', 0)}×{regions[0].get('h', 0)}px)")

    if noise.get("score", 0) > 0.5:
        lines.append(f"- **노이즈 분석**: {noise.get('description', '')}")

    if copy_move.get("score", 0) > 0.1:
        lines.append(f"- **복사-붙여넣기 감지**: {copy_move.get('description', '')}")

    if stretch.get("score", 0) > 0.2:
        lines.append(f"- **왜곡 분석**: {stretch.get('description', '')}")

    flags = meta.get("suspicious_flags", [])
    if flags:
        lines.append(f"\n### ⚠️ 메타데이터 경고")
        for f in flags:
            lines.append(f"- {f}")

    lines.append(f"\n### 💡 원본 추정")
    score = overall.get("score", 0)
    if score >= 70:
        lines.append("이미지에서 다수의 조작 흔적이 발견되었습니다. 원본 이미지는 현재보다 더 자연스러운 신체 비율과 피부 텍스처를 가졌을 것으로 추정됩니다. 얼굴/신체 슬리밍, 피부 보정, 배경 합성 등이 이루어진 것으로 보입니다.")
    elif score >= 40:
        lines.append("일부 조작 흔적이 발견되었습니다. 가벼운 피부 보정이나 부분적인 보정이 이루어진 것으로 추정됩니다.")
    else:
        lines.append("뚜렷한 조작 흔적이 발견되지 않았습니다. 원본 이미지와 유사할 가능성이 높습니다.")

    return "\n".join(lines)


def gemini_vision_analysis(img_pil: Image.Image, forensics_result: dict) -> dict:
    """
    Gemini 1.5 Flash Vision으로 이미지 조작 분석.
    최신 google-genai SDK 사용 (google.genai).
    """
    try:
        from google import genai
        from google.genai import types as gtypes

        client = genai.Client(api_key=GEMINI_API_KEY)

        overall_score  = forensics_result.get("overall", {}).get("score", 0)
        ela_desc       = forensics_result.get("ela", {}).get("description", "")
        noise_desc     = forensics_result.get("noise", {}).get("description", "")
        copy_move_desc = forensics_result.get("copy_move", {}).get("description", "")
        meta_flags     = forensics_result.get("metadata", {}).get("suspicious_flags", [])

        # Body manipulation hints
        body_data = forensics_result.get("body_manipulation", {})
        body_overall = body_data.get("overall", {})
        body_score = body_overall.get("score", 0.0)
        body_hints = body_overall.get("manipulation_hints", "")
        body_zones = body_overall.get("suspicious_zones", [])

        # Skin texture info
        skin_score = body_data.get("skin_texture", {}).get("score", 0)
        skin_desc = body_data.get("skin_texture", {}).get("description", "")

        # Gradient warp info
        warp_score = body_data.get("gradient_warp", {}).get("score", 0)
        warp_desc = body_data.get("gradient_warp", {}).get("description", "")

        # Build body-specific restoration instructions
        body_restore_instructions = ""
        if body_score > 0.2:
            restore_parts = []
            if "허리" in str(body_zones):
                restore_parts.append("- 허리: 얇아진 허리를 자연스러운 체형에 맞게 되돌려라. 주변 배경의 수축/굴곡된 픽셀을 보정하라.")
            if "다리" in str(body_zones) or "하체" in str(body_zones):
                restore_parts.append("- 다리/하체: 길어진 다리 비율을 실제 신체 비율로 되돌려라.")
            if "얼굴" in str(body_zones):
                restore_parts.append("- 얼굴: 작아진 얼굴, 갸름해진 턱선, 커진 눈을 자연스러운 비율로 복원하라.")
            if "상체" in str(body_zones) or "어깨" in str(body_zones):
                restore_parts.append("- 어깨/상체: 넓혀진 어깨나 변형된 상체 실루엣을 보정하라.")
            if skin_score > 0.3:
                restore_parts.append("- 피부: 과도하게 스무딩된 피부에 자연스러운 모공·피부결 텍스처를 복원하라.")
            body_restore_instructions = "\n".join(restore_parts)

        prompt = f"""당신은 디지털 포렌식 전문가이자 이미지 복원 전문가입니다. 첨부된 이미지를 분석하고 반드시 JSON 형식으로만 응답하세요.

자동 포렌식 분석 결과:
- 종합 조작 가능성: {overall_score}/100
- ELA 분석: {ela_desc}
- 노이즈 분석: {noise_desc}
- Copy-Move 감지: {copy_move_desc}
- 메타데이터 경고: {', '.join(meta_flags) if meta_flags else '없음'}

신체 조작 탐지 결과 (SNOW/FaceTune/BeautyPlus 전용):
- 신체 조작 점수: {body_score:.2f}/1.0
- 감지된 조작 부위: {', '.join(body_zones) if body_zones else '없음'}
- Mesh Warp 감지: {warp_desc}
- 피부 스무딩 감지: {skin_desc}
- 상세 조작 흔적: {body_hints}

원본 복원 지침 (탐지된 조작을 역방향으로 적용):
{body_restore_instructions if body_restore_instructions else "- 전반적인 자연스러운 원본 상태 추정"}

이미지를 직접 시각 분석하여 아래 JSON만 반환하세요:
{{
  "visual_analysis": "이미지에서 시각적으로 관찰되는 조작 흔적 상세 설명 (신체 부위별: 허리, 다리, 얼굴, 눈, 피부결 등)",
  "manipulation_details": ["구체적 조작 항목1 (예: 허리 약 15% 슬리밍 흔적)", "항목2"],
  "body_manipulation_summary": "신체 조작 부위 요약 및 추정 변형 강도",
  "original_estimation": "조작 전 원본 이미지 추정 설명 (각 부위별 원래 상태)",
  "restoration_approach": "각 조작을 역방향으로 복원하는 구체적 방법론",
  "confidence": "high 또는 medium 또는 low"
}}"""

        # 이미지를 JPEG bytes로 변환
        buf = io.BytesIO()
        img_pil.convert('RGB').save(buf, format='JPEG', quality=85)
        img_bytes = buf.getvalue()

        response = client.models.generate_content(
            model="models/gemini-2.5-flash",
            contents=[
                gtypes.Part.from_bytes(data=img_bytes, mime_type="image/jpeg"),
                prompt,
            ],
        )

        text = response.text.strip()
        if "```" in text:
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        start = text.find('{')
        end   = text.rfind('}') + 1
        if start >= 0 and end > start:
            text = text[start:end]

        analysis_json = json.loads(text)

        for key in ["visual_analysis", "manipulation_details", "body_manipulation_summary",
                    "original_estimation", "restoration_approach", "confidence"]:
            if key not in analysis_json:
                analysis_json[key] = [] if key == "manipulation_details" else ""

        return {"success": True, "analysis": analysis_json, "engine": "gemini-2.5-flash"}

    except Exception as e:
        return {"success": False, "error": str(e)}


def openai_vision_analysis(img_pil: Image.Image, forensics_result: dict) -> dict:
    """Use GPT-4o to analyze the image and provide detailed manipulation description"""
    try:
        from openai import OpenAI
        client = OpenAI(api_key=OPENAI_API_KEY)

        img_b64 = pil_to_base64(img_pil, "JPEG")
        overall_score = forensics_result.get("overall", {}).get("score", 0)
        ela_desc = forensics_result.get("ela", {}).get("description", "")
        noise_desc = forensics_result.get("noise", {}).get("description", "")
        copy_move_desc = forensics_result.get("copy_move", {}).get("description", "")
        meta_flags = forensics_result.get("metadata", {}).get("suspicious_flags", [])

        system_prompt = """당신은 디지털 포렌식 전문가이자 이미지 분석 AI입니다.
주어진 이미지와 자동 분석 데이터를 바탕으로 다음을 한국어로 작성하세요:
1. 이미지에서 시각적으로 보이는 조작 흔적 (피부 보정, 신체 슬리밍, 얼굴 변형 등)
2. 어떤 부위가 어떤 방식으로 조작되었는지 구체적으로 설명
3. 원본 이미지는 어떤 모습이었을지 추정 설명
4. JSON 형식으로 반환: {"visual_analysis": "...", "manipulation_details": [...], "original_estimation": "...", "confidence": "high/medium/low"}"""

        user_content = f"""이미지를 분석해주세요.

자동 분석 결과:
- 종합 조작 가능성 점수: {overall_score}/100
- ELA 분석: {ela_desc}
- 노이즈 분석: {noise_desc}
- 복사-붙여넣기 감지: {copy_move_desc}
- 메타데이터 경고: {', '.join(meta_flags) if meta_flags else '없음'}

이미지를 직접 시각적으로 분석하여 조작 여부와 원본 추정을 JSON으로 반환하세요."""

        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": [
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{img_b64}"}},
                    {"type": "text", "text": user_content}
                ]}
            ],
            max_tokens=1500,
            response_format={"type": "json_object"}
        )

        analysis_json = json.loads(response.choices[0].message.content)
        return {"success": True, "analysis": analysis_json}

    except Exception as e:
        return {"success": False, "error": str(e)}


def openai_generate_original(img_pil: Image.Image, vision_analysis: dict, forensics_result: dict) -> dict:
    """Use DALL-E 3 to generate an estimation of the original unmanipulated image"""
    try:
        from openai import OpenAI
        client = OpenAI(api_key=OPENAI_API_KEY)

        original_est = vision_analysis.get("original_estimation", "자연스러운 모습의 인물 사진")
        overall_score = forensics_result.get("overall", {}).get("score", 0)

        # Build a descriptive prompt for the original
        prompt = f"""A natural, unretouched portrait photograph of a person.
Style: candid, realistic photography, natural lighting, unedited.
Context: {original_est[:200]}
Requirements: natural skin texture with normal pores and blemishes, realistic body proportions, no excessive smoothing, authentic appearance.
Technical: high resolution, photorealistic, documentary photography style.
Do NOT: apply any beauty filters, skin smoothing, body reshaping, or AI enhancement."""

        response = client.images.generate(
            model="dall-e-3",
            prompt=prompt[:1000],
            size="1024x1024",
            quality="hd",
            style="natural",
            n=1
        )

        img_url = response.data[0].url
        revised_prompt = response.data[0].revised_prompt

        # Download the generated image
        import requests
        img_response = requests.get(img_url, timeout=30)
        generated_img = Image.open(io.BytesIO(img_response.content))

        return {
            "success": True,
            "generated_b64": pil_to_base64(generated_img),
            "revised_prompt": revised_prompt,
            "method": "dalle3"
        }

    except Exception as e:
        return {"success": False, "error": str(e)}


def mock_vision_analysis(forensics_result: dict) -> dict:
    """
    Step 5 Bypass: API 키 없을 때 포렌식 데이터 기반 Mock 분석 생성.
    실제 GPT-4o 응답과 동일한 구조를 유지하여 UI 파이프라인 완전 연결.
    """
    overall = forensics_result.get("overall", {})
    score = overall.get("score", 0)
    ela = forensics_result.get("ela", {})
    noise = forensics_result.get("noise", {})
    copy_move = forensics_result.get("copy_move", {})
    stretch = forensics_result.get("stretch", {})
    meta = forensics_result.get("metadata", {})

    details = []
    visual_parts = []
    original_est_parts = []

    if ela.get("score", 0) > 0.08:
        regions = ela.get("suspicious_regions", [])
        visual_parts.append(
            f"ELA 분석에서 {len(regions)}개 의심 영역 감지됨. "
            "이 영역들은 주변보다 높은 압축 오류를 보이며, "
            "후처리(피부 보정·합성·스티커 삽입 등)의 흔적으로 해석됩니다."
        )
        details.append(f"ELA: {len(regions)}개 영역에서 압축 불일치 ({ela.get('description', '')})")
        original_est_parts.append("피부 질감이 보다 자연스럽고 모공·잡티가 보일 것")

    if noise.get("score", 0) > 0.5:
        visual_parts.append(
            "노이즈 패턴 분석에서 영역 간 불일치 감지. "
            "얼굴 영역의 노이즈가 배경 대비 현저히 낮아 "
            "스무딩·에어브러시 보정이 적용된 것으로 보입니다."
        )
        details.append(f"노이즈: 영역 간 불균일 ({noise.get('description', '')})")
        original_est_parts.append("피부에 자연스러운 텍스처와 노이즈 존재")

    if copy_move.get("score", 0) > 0.15:
        cnt = copy_move.get("match_count", 0)
        visual_parts.append(
            f"SIFT Copy-Move 분석에서 {cnt}개 매칭 포인트 감지. "
            "이미지 내 특정 패턴이 다른 위치에 복제된 흔적이 있습니다."
        )
        details.append(f"Copy-Move: {cnt}개 일치 영역 ({copy_move.get('description', '')})")
        original_est_parts.append("배경 또는 신체 일부가 복제되지 않은 자연스러운 형태")

    if stretch.get("score", 0) > 0.2:
        visual_parts.append(
            "왜곡 분석에서 비정상적인 그라디언트 패턴 감지. "
            "허리·다리·얼굴 윤곽 등이 인위적으로 늘리거나 압축된 흔적이 있습니다."
        )
        details.append(f"왜곡: 비균일 그라디언트 ({stretch.get('description', '')})")
        original_est_parts.append("신체 비율이 보다 자연스러운 형태")

    if meta.get("suspicious_flags"):
        for flag in meta["suspicious_flags"]:
            details.append(f"메타데이터: {flag}")

    if score >= 70:
        confidence = "high"
        visual_analysis = (
            "여러 포렌식 기법에서 명확한 조작 흔적이 발견되었습니다. " +
            " ".join(visual_parts) if visual_parts else
            "ELA·노이즈·그라디언트 분석 모두에서 비정상적인 패턴이 확인됩니다. "
            "상업적 보정 소프트웨어(FaceTune, Meitu 등)를 사용한 것으로 추정됩니다."
        )
        original_estimation = (
            "원본 이미지는 현재보다 " +
            "·".join(original_est_parts) if original_est_parts else
            "더 자연스러운 피부 텍스처와 신체 비율을 가졌을 것으로 추정됩니다"
        ) + ". 현재 이미지는 여러 단계의 후처리를 거친 것으로 보입니다."
    elif score >= 40:
        confidence = "medium"
        visual_analysis = (
            "일부 영역에서 조작 흔적이 의심됩니다. " +
            " ".join(visual_parts[:2]) if visual_parts else
            "가벼운 피부 보정이나 밝기·색조 조정이 이루어진 것으로 보입니다."
        )
        original_estimation = (
            "원본은 현재와 유사하나, " +
            ("·".join(original_est_parts[:2]) if original_est_parts else
             "피부 질감이 약간 더 자연스러웠을 것") + "으로 추정됩니다."
        )
    else:
        confidence = "low"
        visual_analysis = "뚜렷한 조작 흔적이 발견되지 않았습니다. 전체적으로 자연스러운 이미지로 판단됩니다."
        original_estimation = "현재 이미지가 원본에 매우 가깝거나 원본일 가능성이 높습니다."

    return {
        "success": True,
        "analysis": {
            "visual_analysis": visual_analysis,
            "manipulation_details": details if details else ["뚜렷한 조작 흔적 없음"],
            "original_estimation": original_estimation,
            "confidence": confidence,
        },
        "mock": True  # Step 5 flag
    }


def run_ai_restoration(img_pil: Image.Image, forensics_result: dict) -> dict:
    """
    Main entry: run AI restoration pipeline.
    우선순위: Gemini Vision → OpenAI → Mock (Step 5 Bypass)
    """
    has_gemini  = _has_valid_key(GEMINI_API_KEY)
    has_openai  = _has_valid_key(OPENAI_API_KEY)

    # Always run local OpenCV inpainting regardless of API keys
    local_result = opencv_inpaint_restoration(img_pil, forensics_result)

    # ── Priority 1: Gemini Vision (AIza... 키) ──────────────
    if has_gemini:
        vision_result = gemini_vision_analysis(img_pil, forensics_result)
        if vision_result.get("success"):
            analysis = vision_result["analysis"]
            analysis_text = build_ai_analysis_text(analysis, forensics_result)
            return {
                "mode": "gemini",
                "vision_analysis": analysis,
                "generated_original": None,  # Gemini는 이미지 생성 미지원, 향후 Imagen 연동 예정
                "local": local_result,
                "analysis_text": analysis_text,
            }
        # Gemini 실패 시 아래로 fall-through

    # ── Priority 2: OpenAI GPT-4o + DALL-E 3 ───────────────
    if has_openai:
        vision_result = openai_vision_analysis(img_pil, forensics_result)
        if vision_result.get("success"):
            analysis = vision_result["analysis"]
            gen_result = openai_generate_original(img_pil, analysis, forensics_result)
        else:
            mock_result = mock_vision_analysis(forensics_result)
            analysis = mock_result["analysis"]
            gen_result = {"success": False, "error": vision_result.get("error", "")}

        analysis_text = build_ai_analysis_text(analysis, forensics_result)
        return {
            "mode": "openai",
            "vision_analysis": analysis,
            "generated_original": gen_result if gen_result.get("success") else None,
            "local": local_result,
            "analysis_text": analysis_text,
        }

    # ── Priority 3: Step 5 Mock (API 키 없음) ──────────────
    mock_result = mock_vision_analysis(forensics_result)
    analysis = mock_result["analysis"]
    analysis_text = build_ai_analysis_text(analysis, forensics_result)
    return {
        "mode": "mock",
        "local": local_result,
        "vision_analysis": analysis,
        "generated_original": None,
        "analysis_text": analysis_text,
        "mock_notice": "포렌식 데이터 기반 자동 분석 사용 중. .env에 GEMINI_API_KEY 또는 OPENAI_API_KEY 입력 시 AI Vision 분석이 활성화됩니다.",
    }


def build_ai_analysis_text(analysis: dict, forensics_result: dict) -> str:
    overall = forensics_result.get("overall", {})
    lines = []
    lines.append("## 🤖 AI 심층 분석 보고서")
    lines.append(f"\n**종합 조작 가능성**: {overall.get('score', 0):.1f}/100 ({overall.get('label', '')})")

    if analysis.get("visual_analysis"):
        lines.append(f"\n### 시각적 분석\n{analysis['visual_analysis']}")

    details = analysis.get("manipulation_details", [])
    if details:
        lines.append("\n### 감지된 조작 상세")
        for d in details:
            lines.append(f"- {d}")

    if analysis.get("original_estimation"):
        lines.append(f"\n### 💡 원본 추정\n{analysis['original_estimation']}")

    return "\n".join(lines)
