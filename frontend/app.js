/* ===================================================
   ForensicLens v2.0 — Frontend App Logic
   Consent | History | i18n | 3-Panel | GIF | B/A Slider
   =================================================== */

// Auto-detect API endpoint
// - localhost → Flask dev server on :5001
// - Vercel/production → same-origin /api (proxied to Python serverless)
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:5001/api'
  : (window.location.origin + '/api');

let state = {
  file: null,
  forensicsResult: null,
  restorationResult: null,
  consentGiven: false,
};

// DOM Refs
const fileInput       = document.getElementById('fileInput');
const uploadZone      = document.getElementById('uploadZone');
const uploadCard      = document.getElementById('uploadCard');
const previewCard     = document.getElementById('previewCard');
const previewImg      = document.getElementById('previewImg');
const resetBtn        = document.getElementById('resetBtn');
const analyzeBtn      = document.getElementById('analyzeBtn');
const loadingOverlay  = document.getElementById('loadingOverlay');
const resultsSection  = document.getElementById('resultsSection');
const restoreBtn      = document.getElementById('restoreBtn');
const restoreBtnCta   = document.getElementById('restoreBtnCta');
const apiStatusBadge  = document.getElementById('apiStatusBadge');
const imgModal        = document.getElementById('imgModal');
const modalImg        = document.getElementById('modalImg');

// ── i18n Init ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (typeof applyTranslations === 'function') applyTranslations();
  initConsent();
  renderHistory();
});

// ── Consent Modal ──────────────────────────────────────
const CONSENT_KEY = 'forensiclens_consent_v1';
const consentOverlay = document.getElementById('consentOverlay');

function initConsent() {
  // Apply i18n to consent modal
  if (typeof T !== 'undefined') {
    const el = (id, txt) => { const e = document.getElementById(id); if(e) e.textContent = txt; };
    el('consentTitleEl', T.consentTitle);
    el('consentBodyEl', T.consentBody);
    el('consent1El', T.consent1);
    el('consent2El', T.consent2);
    el('consent3El', T.consent3);
    el('consentGDPREl', T.consentGDPR);
    const acc = document.getElementById('consentAcceptBtn');
    if (acc) acc.textContent = T.consentAccept;
    const dec = document.getElementById('consentDeclineBtn');
    if (dec) dec.textContent = T.consentDecline;
  }

  // Check if already consented (session-only, not persistent for GDPR)
  if (sessionStorage.getItem(CONSENT_KEY) === 'true') {
    state.consentGiven = true;
    if (consentOverlay) consentOverlay.style.display = 'none';
    return;
  }
  if (consentOverlay) consentOverlay.style.display = 'flex';

  // Checkbox validation
  const checks = ['check1','check2','check3'].map(id => document.getElementById(id));
  const acceptBtn = document.getElementById('consentAcceptBtn');
  checks.forEach(cb => {
    if (cb) cb.addEventListener('change', () => {
      if (acceptBtn) acceptBtn.disabled = !checks.every(c => c && c.checked);
    });
  });

  if (acceptBtn) acceptBtn.addEventListener('click', () => {
    state.consentGiven = true;
    sessionStorage.setItem(CONSENT_KEY, 'true');
    if (consentOverlay) consentOverlay.style.display = 'none';
  });

  const declineBtn = document.getElementById('consentDeclineBtn');
  if (declineBtn) declineBtn.addEventListener('click', () => {
    if (consentOverlay) consentOverlay.style.display = 'none';
  });
}

// ── History (localStorage) ─────────────────────────────
const HISTORY_KEY = 'forensiclens_history_v1';
const MAX_HISTORY = 20;

function saveToHistory(filename, score, level, label) {
  const hist = loadHistory();
  hist.unshift({
    id: Date.now(),
    filename: filename.length > 30 ? filename.slice(0,28)+'…' : filename,
    score,
    level,
    label,
    ts: new Date().toLocaleString(),
  });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(hist.slice(0, MAX_HISTORY)));
  renderHistory();
}

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
}

function renderHistory() {
  const list = document.getElementById('historyList');
  const empty = document.getElementById('historyEmpty');
  if (!list) return;
  const hist = loadHistory();
  if (hist.length === 0) {
    if (empty) empty.style.display = 'block';
    list.innerHTML = '';
    if (empty) list.appendChild(empty);
    return;
  }
  if (empty) empty.style.display = 'none';
  list.innerHTML = hist.map(h => `
    <div class="history-item">
      <div class="history-item-left">
        <span class="history-badge history-${h.level?.toLowerCase()}">${h.score}/100</span>
        <div>
          <div class="history-filename">${h.filename}</div>
          <div class="history-label">${h.label || h.level}</div>
        </div>
      </div>
      <div class="history-ts">${h.ts}</div>
    </div>
  `).join('');
}

// History panel toggle
const historyToggleBtn = document.getElementById('historyToggleBtn');
const historyPanel = document.getElementById('historyPanel');
if (historyToggleBtn) historyToggleBtn.addEventListener('click', () => {
  if (historyPanel) historyPanel.style.display = historyPanel.style.display === 'none' ? 'block' : 'none';
});
const historyCloseBtn = document.getElementById('historyCloseBtn');
if (historyCloseBtn) historyCloseBtn.addEventListener('click', () => {
  if (historyPanel) historyPanel.style.display = 'none';
});
const historyClearBtn = document.getElementById('historyClearBtn');
if (historyClearBtn) historyClearBtn.addEventListener('click', () => {
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
});



// ── Health Check ───────────────────────────────────────
async function checkHealth() {
  try {
    const res  = await fetch(`${API_BASE}/health`);
    const data = await res.json();
    const txt  = apiStatusBadge.querySelector('.badge-text');
    if (data.gemini_enabled) {
      txt.textContent = 'Gemini 2.5 Flash 활성';
      apiStatusBadge.className = 'header-badge online';
    } else if (data.openai_enabled) {
      txt.textContent = 'GPT-4o + DALL-E 3 활성';
      apiStatusBadge.className = 'header-badge online';
    } else {
      txt.textContent = '로컬 모드 (Mock AI)';
      apiStatusBadge.className = 'header-badge offline';
    }
  } catch {
    const txt = apiStatusBadge.querySelector('.badge-text');
    txt.textContent = '서버 연결 실패';
    apiStatusBadge.className = 'header-badge';
  }
}
checkHealth();
setInterval(checkHealth, 30000);

// ── File Upload ────────────────────────────────────────
uploadZone.addEventListener('click', () => fileInput.click());
uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadCard.classList.add('drag-over'); });
uploadZone.addEventListener('dragleave', () => uploadCard.classList.remove('drag-over'));
uploadZone.addEventListener('drop', e => {
  e.preventDefault(); uploadCard.classList.remove('drag-over');
  const f = e.dataTransfer.files[0];
  if (f) handleFile(f);
});
fileInput.addEventListener('change', () => { if (fileInput.files[0]) handleFile(fileInput.files[0]); });

function handleFile(file) {
  state.file = file;
  const reader = new FileReader();
  reader.onload = e => {
    previewImg.src = e.target.result;
    uploadCard.style.display = 'none';
    previewCard.style.display = 'block';
    resultsSection.style.display = 'none';
  };
  reader.readAsDataURL(file);
}

resetBtn.addEventListener('click', () => {
  state = { file: null, forensicsResult: null, restorationResult: null, consentGiven: !!sessionStorage.getItem('forensiclens_consent_v1') };
  uploadCard.style.display = 'block';
  previewCard.style.display = 'none';
  resultsSection.style.display = 'none';
  fileInput.value = '';
  // 패널3 완전 초기화
  const panelRestored = document.getElementById('panelRestored');
  if (panelRestored) { panelRestored.src = ''; panelRestored.style.display = 'none'; }
  const placeholder = document.getElementById('panelRestorePlaceholder');
  if (placeholder) placeholder.style.display = 'flex';
  const caption = document.getElementById('panelRestoredCaption');
  if (caption) caption.textContent = 'AI 분석 진행 중';
  document.getElementById('videoSection').style.display = 'none';
  document.getElementById('sliderSection').style.display = 'none';
  const rs = document.getElementById('restoreSection');
  if (rs) rs.style.display = 'none';
  const rr = document.getElementById('restoreResults');
  if (rr) rr.style.display = 'none';
});


// ── Loading Steps ──────────────────────────────────────
let stepInterval = null;
function startLoadingSteps() {
  const steps = document.querySelectorAll('.loading-step');
  steps.forEach(s => { s.className = 'loading-step'; });
  let i = 0;
  // 8 steps × 1200ms ≈ covers full analyze+restore (~20-30s)
  stepInterval = setInterval(() => {
    if (i > 0) steps[i - 1].className = 'loading-step done';
    if (i < steps.length) { steps[i].className = 'loading-step active'; i++; }
    else clearInterval(stepInterval);
  }, 1200);
}
function stopLoadingSteps() {
  clearInterval(stepInterval);
  document.querySelectorAll('.loading-step').forEach(s => s.className = 'loading-step done');
}

// ── Analyze ────────────────────────────────────────────
analyzeBtn.addEventListener('click', async () => {
  if (!state.file) return;

  // 에러 배너 초기화
  hideErrorBanner();

  loadingOverlay.style.display = 'flex';
  analyzeBtn.disabled = true;
  startLoadingSteps();

  const fd = new FormData();
  fd.append('file', state.file);

  try {
    const res  = await fetch(`${API_BASE}/analyze`, { method: 'POST', body: fd });
    const data = await res.json();

    stopLoadingSteps();
    loadingOverlay.style.display = 'none';
    analyzeBtn.disabled = false;

    if (!data.success) {
      const msg = data.error || '알 수 없는 오류';
      // Rate limit 특별 처리
      if (res.status === 429) {
        showErrorBanner(`⏱ 요청이 너무 많습니다. ${data.retry_after || 60}초 후 다시 시도해주세요.`);
      } else {
        showErrorBanner('분석 오류: ' + msg);
      }
      return;
    }

    state.forensicsResult = data.forensics;
    renderResults(data.forensics);

    // 히스토리에 저장 (이미지 내용 제외, 메타데이터만)
    const o = data.forensics.overall;
    saveToHistory(state.file.name, o.score, o.level, o.label);

    runRestore();

  } catch (err) {
    stopLoadingSteps();
    loadingOverlay.style.display = 'none';
    analyzeBtn.disabled = false;
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      showErrorBanner('🔌 서버에 연결할 수 없습니다. 백엔드 서버가 실행 중인지 확인하세요.');
    } else {
      showErrorBanner('오류: ' + err.message);
    }
  }
});

// ── Error Toast / Banner ────────────────────────────────
function showErrorBanner(msg) {
  let banner = document.getElementById('errorBanner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'errorBanner';
    banner.style.cssText = 'position:fixed;top:72px;left:50%;transform:translateX(-50%);z-index:900;background:rgba(239,68,68,.95);color:#fff;padding:14px 24px;border-radius:12px;font-size:14px;font-weight:500;max-width:500px;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.4);backdrop-filter:blur(10px);animation:fadeUp .2s ease';
    document.body.appendChild(banner);
  }
  banner.textContent = msg;
  banner.style.display = 'block';
  // 8초 후 자동 숨김
  clearTimeout(banner._timeout);
  banner._timeout = setTimeout(() => hideErrorBanner(), 8000);
}
function hideErrorBanner() {
  const b = document.getElementById('errorBanner');
  if (b) b.style.display = 'none';
}


// ── Render Results ─────────────────────────────────────
function renderResults(f) {
  resultsSection.style.display = 'block';
  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // 수동 버튼 숨기기 (자동 실행이므로)
  if (restoreBtn) restoreBtn.style.display = 'none';
  if (restoreBtnCta) restoreBtnCta.style.display = 'none';

  renderScore(f.overall);
  renderThreePanels(f);
  renderTabs(f);
  renderInfoBar(f);
}

function renderScore(o) {
  const val    = document.getElementById('scoreValue');
  const bar    = document.getElementById('scoreBar');
  const badge  = document.getElementById('scoreBadge');
  const cls    = o.level === 'HIGH' ? 'score-high' : o.level === 'MEDIUM' ? 'score-medium' : 'score-low';
  const badgeCls = o.level === 'HIGH' ? 'badge-high' : o.level === 'MEDIUM' ? 'badge-medium' : 'badge-low';

  val.textContent = o.score.toFixed(1);
  val.className = 'score-value ' + cls;
  badge.textContent = o.label;
  badge.className = 'score-badge ' + badgeCls;
  setTimeout(() => { bar.style.width = o.score + '%'; }, 100);

  // Breakdown
  const bd = document.getElementById('scoreBreakdown');
  const refs = o.references || {};
  const items = [
    { key: 'multi_ela',  label: '다중 ELA',   color: '#ef4444' },
    { key: 'srm',        label: 'SRM 잔차',   color: '#a855f7' },
    { key: 'noise',      label: '노이즈',      color: '#f59e0b' },
    { key: 'jpeg_block', label: 'JPEG 블록',  color: '#06b6d4' },
    { key: 'ela',        label: 'ELA',         color: '#f97316' },
    { key: 'copy_move',  label: 'Copy-Move',   color: '#8b5cf6' },
    { key: 'fft',        label: 'FFT',         color: '#10b981' },
  ];
  bd.innerHTML = items.map(it => {
    const v = o.breakdown?.[it.key] ?? 0;
    const ref = refs[it.key];
    const tooltip = ref ? `${ref.authors} (${ref.venue})` : '';
    return `<div class="breakdown-item" title="${tooltip}">
      <span class="breakdown-label">${it.label}</span>
      <div class="breakdown-bar-wrap"><div class="breakdown-bar" style="width:${v}%;background:${it.color}"></div></div>
      <span class="breakdown-val">${v.toFixed(0)}</span>
    </div>`;
  }).join('');
  setTimeout(() => {
    document.querySelectorAll('.breakdown-bar').forEach(b => {
      b.style.transition = 'width 1s ease';
    });
  }, 50);
}

function renderThreePanels(f) {
  // Panel 1: Original
  if (f.original_b64) {
    document.getElementById('panelOriginal').src = 'data:image/png;base64,' + f.original_b64;
    document.getElementById('panelOriginalSmall').src = 'data:image/png;base64,' + f.original_b64;
    document.getElementById('baOriginal').src = 'data:image/png;base64,' + f.original_b64;
  }
  // Panel 2: Composite overlay
  if (f.composite_overlay_b64) {
    document.getElementById('panelComposite').src = 'data:image/png;base64,' + f.composite_overlay_b64;
  }
}

// ── Restore ────────────────────────────────────────────
function stripB64Fields(obj) {
  const skip = new Set(['heatmap_b64', 'overlay_b64', 'enhanced_b64', 'original_b64', 'composite_overlay_b64']);
  if (Array.isArray(obj)) return obj.map(stripB64Fields);
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (!skip.has(k)) out[k] = stripB64Fields(v);
    }
    return out;
  }
  return obj;
}

async function runRestore() {
  if (!state.file || !state.forensicsResult) return;

  const restoreSec = document.getElementById('restoreSection');
  if (restoreSec) restoreSec.style.display = 'block';

  document.getElementById('videoSection').style.display = 'block';
  document.getElementById('videoLoading').style.display = 'flex';
  document.getElementById('transitionGif').style.display = 'none';

  document.getElementById('restoreResults').style.display = 'block';
  document.getElementById('restoreLoading').style.display = 'flex';
  document.getElementById('restoreContent').style.display = 'none';
  if (restoreBtn) restoreBtn.disabled = true;
  if (restoreBtnCta) restoreBtnCta.disabled = true;

  const fd = new FormData();
  fd.append('file', state.file);
  fd.append('forensics', JSON.stringify(stripB64Fields(state.forensicsResult)));

  try {
    const res  = await fetch(`${API_BASE}/restore`, { method: 'POST', body: fd });
    const data = await res.json();

    document.getElementById('restoreLoading').style.display = 'none';
    if (restoreBtn) restoreBtn.disabled = false;
    if (restoreBtnCta) restoreBtnCta.disabled = false;

    if (!data.success) {
      // 복원 실패 시 패널3에 오류 표시 (alert 대신)
      const placeholder = document.getElementById('panelRestorePlaceholder');
      if (placeholder) placeholder.innerHTML = `<div style="color:var(--warn);font-size:13px;padding:20px;text-align:center">⚠️ ${data.error || '복원 실패'}</div>`;
      document.getElementById('videoSection').style.display = 'none';
      return;
    }

    state.restorationResult = data.restoration;
    renderRestoration(data.restoration);
  } catch (err) {
    document.getElementById('restoreLoading').style.display = 'none';
    if (restoreBtn) restoreBtn.disabled = false;
    if (restoreBtnCta) restoreBtnCta.disabled = false;
    document.getElementById('videoSection').style.display = 'none';
    console.error('복원 오류:', err.message);
    // 패널3에 조용히 오류 표시
    const placeholder = document.getElementById('panelRestorePlaceholder');
    if (placeholder) placeholder.innerHTML = `<div style="color:var(--muted);font-size:12px;padding:20px;text-align:center">복원 서버 연결 오류</div>`;
  }
}

if (restoreBtn) restoreBtn.addEventListener('click', runRestore);
if (restoreBtnCta) restoreBtnCta.addEventListener('click', runRestore);

function renderRestoration(rest) {
  // Panel 3: Restored image
  const local = rest.local || {};
  if (local.restored_b64) {
    const img = document.getElementById('panelRestored');
    img.src = 'data:image/png;base64,' + local.restored_b64;
    img.style.display = 'block';
    document.getElementById('panelRestorePlaceholder').style.display = 'none';
    document.getElementById('panelRestoredCaption').textContent =
      rest.mode === 'gemini' ? 'Gemini 2.5 Flash 추정 원본' :
      rest.mode === 'openai' ? 'GPT-4o 추정 원본' : 'OpenCV 인페인팅 복원';

    // B/A Slider
    document.getElementById('baRestored').src = 'data:image/png;base64,' + local.restored_b64;
    document.getElementById('sliderSection').style.display = 'block';
    initBASlider();
  }

  // Transition GIF
  if (rest.transition_gif_b64) {
    const gif = document.getElementById('transitionGif');
    gif.src = 'data:image/gif;base64,' + rest.transition_gif_b64;
    gif.style.display = 'block';
    document.getElementById('videoLoading').style.display = 'none';
  } else {
    document.getElementById('videoLoading').style.display = 'none';
    document.getElementById('videoSection').style.display = 'none';
  }

  // AI Analysis text
  document.getElementById('restoreContent').style.display = 'block';
  const mockWrap = document.getElementById('mockNoticeWrap');
  if (rest.mock_notice) {
    mockWrap.innerHTML = `<div class="mock-notice">⚠️ ${rest.mock_notice}</div>`;
  } else {
    mockWrap.innerHTML = rest.mode === 'gemini'
      ? `<div class="mock-notice" style="background:rgba(16,185,129,.08);border-color:rgba(16,185,129,.3);color:#34d399">✅ Gemini 2.5 Flash Vision 분석 완료</div>`
      : '';
  }

  const textCard = document.getElementById('analysisTextCard');
  const va = rest.vision_analysis || {};
  const bm = va.body_manipulation_summary || '';
  const ra = va.restoration_approach || '';
  textCard.innerHTML = `
    <h2>🤖 AI 심층 분석 보고서</h2>
    ${va.visual_analysis ? `<h3>👁 시각적 분석</h3><p>${va.visual_analysis}</p>` : ''}
    ${va.manipulation_details?.length ? `<h3>🔍 감지된 조작 상세</h3><ul>${va.manipulation_details.map(d => `<li>${d}</li>`).join('')}</ul>` : ''}
    ${bm ? `<h3>🩻 신체 조작 요약</h3><p style="background:rgba(239,68,68,.08);padding:12px;border-radius:8px;border-left:3px solid #EF4444">${bm}</p>` : ''}
    ${ra ? `<h3>🔄 복원 방법론</h3><p style="background:rgba(99,102,241,.08);padding:12px;border-radius:8px;border-left:3px solid var(--accent)">${ra}</p>` : ''}
    ${va.original_estimation ? `<h3>💡 원본 추정</h3><p>${va.original_estimation}</p>` : ''}
    ${va.confidence ? `<h3>신뢰도</h3><p><strong>${va.confidence.toUpperCase()}</strong></p>` : ''}
  `;
}

// ── Before/After Slider ────────────────────────────────
function initBASlider() {
  const container = document.getElementById('baContainer');
  const divider   = document.getElementById('baDivider');
  const afterImg  = document.getElementById('baRestored');
  let dragging = false;

  function setPosition(x) {
    const rect = container.getBoundingClientRect();
    const pct  = Math.min(Math.max((x - rect.left) / rect.width, 0.05), 0.95);
    divider.style.left = (pct * 100) + '%';
    afterImg.style.clipPath = `inset(0 ${(1 - pct) * 100}% 0 0)`;
  }
  setPosition(container.getBoundingClientRect().left + container.getBoundingClientRect().width / 2);

  divider.addEventListener('mousedown', () => { dragging = true; });
  document.addEventListener('mousemove', e => { if (dragging) setPosition(e.clientX); });
  document.addEventListener('mouseup', () => { dragging = false; });
  divider.addEventListener('touchstart', e => { dragging = true; e.preventDefault(); }, { passive: false });
  document.addEventListener('touchmove', e => { if (dragging) setPosition(e.touches[0].clientX); }, { passive: true });
  document.addEventListener('touchend', () => { dragging = false; });
}

// ── Tabs ───────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab)?.classList.add('active');
  });
});

// ── Render Tabs Content ────────────────────────────────
function renderTabs(f) {
  const b64url = (b) => b ? 'data:image/png;base64,' + b : '';

  // ELA
  document.getElementById('elaDesc').textContent = f.ela?.description || '';
  document.getElementById('elaOriginal').src = b64url(f.original_b64);
  document.getElementById('elaHeatmap').src  = b64url(f.ela?.heatmap_b64);
  document.getElementById('elaOverlay').src  = b64url(f.ela?.overlay_b64);
  const regWrap = document.getElementById('elaRegions');
  const regs = f.ela?.suspicious_regions || [];
  regWrap.innerHTML = regs.length ? regs.map((r, i) => `<span class="region-chip">의심 영역 ${i+1}: x${r.x} y${r.y} (${r.w}×${r.h}px)</span>`).join('') : '';

  // Noise
  document.getElementById('noiseDesc').textContent   = f.noise?.description || '';
  document.getElementById('noiseHeatmap').src        = b64url(f.noise?.heatmap_b64);
  document.getElementById('noiseOverlay').src        = b64url(f.noise?.overlay_b64);

  // Copy-Move
  document.getElementById('copyMoveDesc').textContent = f.copy_move?.description || '';
  document.getElementById('copyMoveOverlay').src      = b64url(f.copy_move?.overlay_b64);

  // FFT
  document.getElementById('fftDesc').textContent  = f.fft?.description || '';
  document.getElementById('fftHeatmap').src       = b64url(f.fft?.heatmap_b64);

  // Stretch
  document.getElementById('stretchDesc').textContent = f.stretch?.description || '';
  document.getElementById('stretchHeatmap').src      = b64url(f.stretch?.heatmap_b64);
  document.getElementById('stretchOverlay').src      = b64url(f.stretch?.overlay_b64);

  // Body Manipulation (SNOW/FaceTune)
  const bd = f.body_manipulation || {};
  const bdOverall = bd.overall || {};
  const bodyTab = document.getElementById('tab-body');
  if (bodyTab) {
    const bdScore = (bdOverall.score || 0) * 100;
    const bdLevel = bdScore > 60 ? 'HIGH' : bdScore > 30 ? 'MEDIUM' : 'LOW';
    const bdColor = bdLevel === 'HIGH' ? '#EF4444' : bdLevel === 'MEDIUM' ? '#F59E0B' : '#10B981';
    const zones = bdOverall.suspicious_zones || [];
    const hints = bdOverall.manipulation_hints || '탐지된 신체 조작 없음';

    const zoneCards = [
      { key: 'gradient_warp', label: '🌀 Mesh Warp (Liquify)' },
      { key: 'line_curvature', label: '📏 배경선 굴곡' },
      { key: 'skin_texture', label: '✨ 피부 스무딩' },
      { key: 'resampling', label: '🔁 리샘플링 아티팩트' },
      { key: 'local_distortion', label: '🧩 국소 기하 왜곡' },
    ];

    bodyTab.innerHTML = `
      <div class="panel-header">
        <h3>🩻 신체 조작 탐지 (SNOW / FaceTune / BeautyPlus)</h3>
        <div class="ref-pill">Mahdian & Saic IEEE TIFS 2008 · Kirchner & Fridrich SPIE 2010</div>
        <p>허리·다리 슬리밍, 얼굴 소형화, 눈 확대, 피부 스무딩 등 모바일 뷰티 앱 조작을 탐지합니다.</p>
      </div>
      <div class="body-score-wrap">
        <div class="body-score-bar" style="background:linear-gradient(90deg,${bdColor}88,${bdColor});width:${Math.min(bdScore,100)}%;height:8px;border-radius:4px;margin-bottom:12px"></div>
        <div style="color:${bdColor};font-weight:700;font-size:18px">${bdScore.toFixed(0)}/100 <span style="font-size:13px;font-weight:400">${bdLevel}</span></div>
      </div>
      ${zones.length ? `<div class="body-zones">${zones.map(z => `<span class="region-chip">${z}</span>`).join('')}</div>` : ''}
      <div class="body-hints" style="background:var(--bg3);border-radius:10px;padding:14px;margin:12px 0;font-size:13px;white-space:pre-wrap;color:var(--muted)">${hints}</div>
      <div class="image-grid two-col">
        ${bd.gradient_warp?.overlay_b64 ? `<div class="image-card"><div class="image-card-label">🌀 Warp 히트맵</div><img src="data:image/jpg;base64,${bd.gradient_warp.overlay_b64}" /></div>` : ''}
        ${bd.local_distortion?.overlay_b64 ? `<div class="image-card"><div class="image-card-label">🧩 국소 왜곡 맵</div><img src="data:image/jpg;base64,${bd.local_distortion.overlay_b64}" /></div>` : ''}
        ${bd.skin_texture?.heatmap_b64 ? `<div class="image-card"><div class="image-card-label">✨ 피부 스무딩 맵</div><img src="data:image/jpg;base64,${bd.skin_texture.heatmap_b64}" /></div>` : ''}
      </div>
      <div class="body-detail-table">${zoneCards.map(zc => {
        const det = bd[zc.key] || {};
        const s = ((det.score || 0)*100).toFixed(0);
        const c = s > 60 ? '#EF4444' : s > 30 ? '#F59E0B' : '#10B981';
        return `<div class="body-detail-row"><span>${zc.label}</span><span style="color:${c};font-weight:700">${s}/100</span><span style="color:var(--muted);font-size:12px">${det.description||''}</span></div>`;
      }).join('')}</div>
    `;
  }

  // AI Generation Detection Tab
  const ag = f.ai_generation || {};
  const agOverall = ag.overall || {};
  const aigenTab = document.getElementById('tab-aigen');
  if (aigenTab) {
    const agScore = (agOverall.score || 0) * 100;
    const agLevel = agOverall.level || 'LOW';
    const agColor = agLevel === 'HIGH' ? '#EF4444' : agLevel === 'MEDIUM' ? '#F59E0B' : '#10B981';
    const verdict = agOverall.verdict || '분석 중...';
    const aiType = agOverall.estimated_ai_type;

    const detectors = [
      { key: 'spectral',   label: '📡 GAN 스펙트럼 아티팩트', ref: 'Frank et al. ICML 2020' },
      { key: 'prnu',       label: '📷 PRNU 카메라 노이즈 부재', ref: 'Lukas et al. IEEE TIFS 2006' },
      { key: 'dct',        label: '🔢 DCT 고주파 분포', ref: 'Durall et al. CVPR 2020' },
      { key: 'color_corr', label: '🎨 채널간 상관도', ref: 'Gragnaniello et al. ICME 2021' },
      { key: 'texture',    label: '🧵 텍스처 균일도', ref: 'Wang et al. CVPR 2020' },
    ];

    aigenTab.innerHTML = `
      <div class="panel-header">
        <h3>🤖 AI 생성 이미지 탐지</h3>
        <div class="ref-pill">Frank et al. ICML 2020 · Durall et al. CVPR 2020 · Lukas et al. IEEE TIFS 2006</div>
        <p>Midjourney, DALL-E 3, Stable Diffusion, Adobe Firefly 등으로 생성된 이미지를 탐지합니다.</p>
      </div>
      <div style="background:var(--bg3);border-radius:14px;padding:20px;margin-bottom:16px">
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:12px">
          <div style="font-size:36px;font-weight:800;color:${agColor}">${agScore.toFixed(0)}<span style="font-size:14px;font-weight:400;color:var(--muted)">/100</span></div>
          <div>
            <div style="font-size:16px;font-weight:700;color:${agColor}">${agLevel}</div>
            <div style="font-size:13px;color:var(--text);margin-top:3px">${verdict}</div>
            ${aiType ? `<div style="margin-top:6px;padding:4px 10px;background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.3);border-radius:6px;font-size:12px;color:#EF4444;display:inline-block">추정 툴: ${aiType}</div>` : ''}
          </div>
        </div>
        <div style="height:8px;background:var(--bg2);border-radius:4px;overflow:hidden">
          <div style="height:100%;width:${Math.min(agScore,100)}%;background:linear-gradient(90deg,${agColor}88,${agColor});border-radius:4px;transition:.5s"></div>
        </div>
      </div>
      ${ag.spectral?.heatmap_b64 ? `
      <div class="image-grid two-col" style="margin-bottom:16px">
        <div class="image-card"><div class="image-card-label">📡 FFT 스펙트럼 (GAN 아티팩트)</div><img src="data:image/jpg;base64,${ag.spectral.heatmap_b64}" /></div>
      </div>` : ''}
      <div class="body-detail-table">
        ${detectors.map(d => {
          const det = ag[d.key] || {};
          const s = ((det.score || 0)*100).toFixed(0);
          const c = s > 60 ? '#EF4444' : s > 30 ? '#F59E0B' : '#10B981';
          return `<div class="body-detail-row">
            <span>${d.label}<br/><span style="font-size:10px;color:var(--muted)">${d.ref}</span></span>
            <span style="color:${c};font-weight:700">${s}/100</span>
            <span style="color:var(--muted);font-size:12px">${det.description||''}</span>
          </div>`;
        }).join('')}
      </div>
      <div style="margin-top:16px;padding:12px;background:rgba(99,102,241,.08);border-radius:10px;font-size:12px;color:var(--muted)">
        ⚠️ AI 생성 탐지는 통계적 분석이므로 100% 정확하지 않습니다. 여러 지표를 종합적으로 판단하세요.<br/>
        특히 AI 이미지를 후처리(압축, 크기 조정)한 경우 탐지율이 낮아질 수 있습니다.
      </div>
    `;
  }

  // Metadata
  renderMeta(f.metadata);

  // References
  renderRefs(f.overall?.references);
}

function renderMeta(meta) {
  if (!meta) return;
  const flags  = meta.suspicious_flags || [];
  const flagsEl = document.getElementById('metaFlags');
  if (flags.length) {
    flagsEl.innerHTML = flags.map(fl =>
      `<div class="meta-flag">⚠️ ${fl}</div>`
    ).join('');
  } else {
    flagsEl.innerHTML = '<div class="meta-flag meta-ok">✅ 메타데이터 이상 없음</div>';
  }

  // EXIF thumbnail
  if (meta.thumbnail_b64) {
    document.getElementById('exifThumbSection').style.display = 'block';
    document.getElementById('exifThumb').src = 'data:image/jpeg;base64,' + meta.thumbnail_b64;
    const mseNote = document.getElementById('exifMseNote');
    if (meta.thumbnail_differs) {
      mseNote.textContent = `⚠️ 썸네일-본체 불일치 감지 (MSE=${meta.thumbnail_mse}) — 편집 전 원본 프리뷰가 내장되어 있을 가능성 있음`;
    } else {
      mseNote.textContent = `✅ 썸네일-본체 일치 (MSE=${meta.thumbnail_mse}) — 편집 흔적 없음`;
    }
  }

  // Table
  const tbody = document.getElementById('metaTableBody');
  const entries = Object.entries(meta.metadata || {});
  tbody.innerHTML = entries.length
    ? entries.map(([k, v]) => `<tr><td><strong>${k}</strong></td><td>${v}</td></tr>`).join('')
    : '<tr><td colspan="2" style="color:var(--muted)">EXIF 데이터 없음</td></tr>';
}

function renderRefs(refs) {
  if (!refs) return;
  const grid = document.getElementById('refsGrid');
  grid.innerHTML = Object.entries(refs).map(([key, r]) => `
    <div class="ref-card">
      <div class="ref-card-title">${r.title}</div>
      <div class="ref-card-authors">${r.authors}</div>
      <div class="ref-card-venue">${r.venue}</div>
      <div class="ref-card-note">${r.note}</div>
      <a href="${r.url}" target="_blank" rel="noopener">🔗 논문 원문 보기</a>
    </div>
  `).join('');
}

function renderInfoBar(f) {
  const bar = document.getElementById('infoBar');
  bar.textContent = `분석 시간: ${f.analysis_time_sec}초 | 이미지 크기: ${f.image_size?.[0]}×${f.image_size?.[1]}px | EXIF 항목: ${Object.keys(f.metadata?.metadata || {}).length}개`;
}

// ── New Analysis ───────────────────────────────────────
document.getElementById('newAnalysisBtn').addEventListener('click', () => {
  resetBtn.click();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ── Image Zoom Modal ───────────────────────────────────
document.addEventListener('click', e => {
  const img = e.target.closest('.image-card img, .panel-img-wrap img, #baContainer img');
  if (img && img.src) {
    modalImg.src = img.src;
    imgModal.classList.add('open');
  }
});
imgModal.addEventListener('click', () => imgModal.classList.remove('open'));
