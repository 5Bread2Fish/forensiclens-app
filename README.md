# ForensicLens — AI 이미지 포렌식 분석 서비스

> **Gemini 2.5 Flash Vision** 기반 사진 조작 탐지 & 원본 추정 서비스

## 🔬 기능

- **ELA** (Error Level Analysis) — Krawetz 2007
- **노이즈 분석** (Luminance-band CV) — Pan & Lyu 2010  
- **Copy-Move 탐지** (SIFT + RANSAC) — Christlein 2012
- **FFT Ghost** (8x8 DCT 마스킹) — Farid 2009
- **SRM 잔차 분석** — Fridrich & Kodovsky 2012
- **JPEG 블록 일관성** — Lin et al. 2009
- **다중-quality ELA** — Krawetz 2007 extension
- **Gemini 2.5 Flash Vision** AI 원본 추정
- **트랜지션 GIF** 생성
- **7개 언어 자동 번역** (ko/en/zh/ja/th/id/es)
- **GDPR · CCPA · 개인정보보호법** 준수 동의 모달
- **분석 기록** (localStorage, 이미지 저장 없음)

## 🛡 보안

- Rate limiting (분석 10회/분, 복원 5회/분)
- Magic bytes 검증 (확장자 위조 방지)
- 보안 헤더 (CSP, X-Frame-Options, etc.)
- GDPR: IP 마스킹, 이미지 서버 미저장
- 파일 크기 제한 20MB

## 🚀 로컬 실행

```bash
cd AI_Photo_Detector
cp .env.example .env
# .env에 GEMINI_API_KEY 설정

python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

python backend/app.py
# → http://localhost:5001
```

## ☁️ Vercel 배포 (Frontend)

```bash
npx vercel --prod
```

> **Note**: Python 백엔드(OpenCV/scipy ~200MB)는 Vercel 서버리스 한도 초과.  
> Railway 또는 Render에 백엔드 배포 후 `API_BASE`를 환경변수로 설정하세요.

## 📁 구조

```
AI_Photo_Detector/
├── backend/
│   ├── app.py              # Flask API (보안 강화)
│   ├── forensics_engine.py # 7가지 포렌식 알고리즘
│   ├── ai_restoration.py   # Gemini/OpenAI/Mock 복원
│   └── video_generator.py  # GIF 생성
├── frontend/
│   ├── index.html          # 동의 모달 + 히스토리 포함
│   ├── style.css
│   ├── app.js
│   └── i18n.js             # 7개 언어
├── .env
├── requirements.txt
└── vercel.json
```
