/* ===================================================
   ForensicLens v2.0 — Frontend App Logic
   Consent | History | i18n | 3-Panel | GIF | B/A Slider
   =================================================== */

// Auto-detect API endpoint: use env var (Vercel) or fall back to localhost
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:5001/api'
  : (window._FORENSICLENS_API || window.location.origin + '/api');

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
  state = { file: null, forensicsResult: null, restorationResult: null };
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
  loadingOverlay.style.display = 'flex';
  analyzeBtn.disabled = true;
  startLoadingSteps();

  const fd = new FormData();
  fd.append('file', state.file);

  try {
    const res  = await fetch(`${API_BASE}/analyze`, { method: 'POST', body: fd });
    const data = await res.json();

    stopLoadingSteps();
    loadingOverlay.style.display = 'none';  // 분석 완료 즉시 오버레이 닫기
    analyzeBtn.disabled = false;

    if (!data.success) {
      alert('분석 오류: ' + (data.error || '알 수 없는 오류'));
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
    alert('서버 연결 오류: ' + err.message);
  }
});


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

  // 자동 실행: restore 섹션 표시
  const restoreSec = document.getElementById('restoreSection');
  if (restoreSec) restoreSec.style.display = 'block';

  // Show video section loading
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

    if (!data.success) { alert('복원 오류: ' + (data.error || '')); return; }

    state.restorationResult = data.restoration;
    renderRestoration(data.restoration);
  } catch (err) {
    stopLoadingSteps();
    loadingOverlay.style.display = 'none';
    document.getElementById('restoreLoading').style.display = 'none';
    if (restoreBtn) restoreBtn.disabled = false;
    if (restoreBtnCta) restoreBtnCta.disabled = false;
    console.error('복원 오류:', err.message);
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
  textCard.innerHTML = `
    <h2>🤖 AI 심층 분석 보고서</h2>
    ${va.visual_analysis ? `<h3>👁 시각적 분석</h3><p>${va.visual_analysis}</p>` : ''}
    ${va.manipulation_details?.length ? `<h3>🔍 감지된 조작 상세</h3><ul>${va.manipulation_details.map(d => `<li>${d}</li>`).join('')}</ul>` : ''}
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
