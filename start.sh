#!/bin/bash
# ForensicLens 서버 시작 스크립트

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║     🔍 ForensicLens — AI 이미지 포렌식       ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# venv 활성화
if [ -f "venv/bin/activate" ]; then
  source venv/bin/activate
  echo "✅ Python 가상환경 활성화"
else
  echo "❌ venv 없음. 다음 명령 실행 후 다시 시도:"
  echo "   python3 -m venv venv && source venv/bin/activate"
  echo "   pip install flask flask-cors pillow opencv-python numpy scipy matplotlib scikit-image openai python-dotenv requests"
  exit 1
fi

# .env 체크
if [ -f ".env" ]; then
  echo "✅ .env 파일 확인됨"
else
  echo "⚠️  .env 파일 없음 (로컬 Mock 모드로 동작)"
fi

echo ""
echo "🚀 서버 시작 중... → http://localhost:5001"
echo "   (종료: Ctrl+C)"
echo ""

python backend/app.py
