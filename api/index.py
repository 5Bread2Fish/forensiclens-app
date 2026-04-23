"""
Vercel Serverless Entry Point — ForensicLens Backend
Vercel Python runtime: @vercel/python
모든 /api/* 요청을 이 Flask 앱으로 라우팅
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))
from app import app as application

# Vercel WSGI handler
handler = application
